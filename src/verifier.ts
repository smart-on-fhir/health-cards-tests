import axios from 'axios';
import base64url from 'base64url';
import * as crypto from 'crypto';
import QRCode from 'qrcode';
import qs from 'querystring';
import { serverBase } from './config';
import { generateDid, verifyJws } from './dids';
import { EncryptionKey, generateEncryptionKey, generateSigningKey, SigningKey } from './keys';


export type ClaimType = 'vc-health-passport-stamp-covid19-serology' | 'vc-health-passport-stamp'

export async function verifierWorld(role = 'verifier', requestMode: SiopRequestMode = 'form_post', reset = false) {
    let state = await initializeVerifier({ role, claimsRequired: ["vc-health-passport-stamp-covid19-serology"], requestMode, reset });
    const dispatch = async (ePromise) => {
        const e = await ePromise;
        const pre = state;
        state = await verifierReducer(state, e);
        console.log('Verifier Event', e.type, e, state);
    };
    console.log('Verifier initial state', state);

    if (!state.siopRequest) {
        await dispatch(prepareSiopRequest(state));
        displayRequest(state)
    }

    if (!state.siopResponse) {
        if (state.config.requestMode === 'form_post') {
            await dispatch(receiveSiopResponse(state));
        }
    }

    if (state.fragment?.id_token) {
        displayThanks(state)
    } 

}

function displayThanks(state) {
    const link = document.getElementById('redirect-link');
    if (link) {
        window['clickRedirect'] = function () {
            window.localStorage[state.config.role + '_state'] = JSON.stringify(state)
            window.close()
        }
        link.innerHTML = "Thanks for sharing your COVID card! You're confirmed. <button  onclick=\"clickRedirect()\">Close</button>";
    }
}

export function displayRequest(state) {
    console.log("Display req", state.siopRequest)
    simulate({
        'type': 'display-qr-code',
        'who': state.config.role,
        'url': state.siopRequest.siopRequestQrCodeUrl
    });

    const canvas = document.getElementById('qrcode-canvas');
    if (canvas) {
        QRCode.toCanvas(canvas, state.siopRequest.siopRequestQrCodeUrl, { scale: 20 }, (error) => {
            if (error) console.error(error);
            console.log('success!');
        });
    }

    const link = document.getElementById('redirect-link');
    if (link) {
        link.innerHTML = "<button  onclick=\"clickRedirect()\">Connect to Health Wallet</button>";
    }

    window['clickRedirect'] = function () {
        window.localStorage[state.config.role + '_state'] = JSON.stringify(state)
        window.opener.postMessage(state.siopRequest.siopRequestQrCodeUrl, "*")
        window.close()
    }
}

// Cheap-o polling-based event simuation for the occasional
// cross-talk between holderWorld and verifierWorld
// (these are things where the user would act, in real life)
const simulatedInteractions = [];
export const simulate = (e) => {
    simulatedInteractions.push(e)
}
export const simulatedOccurrence = async ({ who, type }, rateMs = 200) => {
    while (true) {
        const matches = simulatedInteractions
            .filter(e => e.who === who && e.type === type);
        if (matches.length) {
            return matches[0];
        }
        await new Promise((resolve) => setTimeout(resolve, rateMs));
    }
};

export type SiopRequestMode = 'form_post' | 'fragment';

export interface VerifierState {
    ek: EncryptionKey;
    sk: SigningKey;
    did: string;
    config: {
        role: string;
        claimsRequired: ClaimType[],
        reset?: boolean;
        requestMode: SiopRequestMode
    };
    siopRequest?: {
        siopRequestPayload: any;
        siopRequestPayloadSigned: string;
        siopRequestQrCodeUrl: string;
        siopResponsePollingUrl: string;
    };
    siopResponse?: {
        idTokenRaw: string;
        idTokenDecrypted: string;
        idTokenPayload: {
            did: string;
        };
    };
    issuedCredentials?: string[];
    fragment?: {
        id_token: string;
        state: string;
    };
}
export const initializeVerifier = async (config: VerifierState["config"]): Promise<VerifierState> => {
    const stateKey = `${config.role}_state`
    const existingState = window.localStorage[stateKey]

    if (existingState && config.reset !== true) {
        const existingStateParsed = JSON.parse(existingState)
        const fragment_parts = qs.decode(window.location.hash.slice(1))
        return {
            ...existingStateParsed,
            config,
            ek: await generateEncryptionKey(existingStateParsed.ek.publicJwk, existingStateParsed.ek.privateJwk),
            sk: await generateSigningKey(existingStateParsed.sk.publicJwk, existingStateParsed.sk.privateJwk),
            did: existingStateParsed.did,
            fragment: {
                id_token: fragment_parts.id_token as string,
                state: fragment_parts.state as string,
            }
        }
    }

    const ek = await generateEncryptionKey();
    const sk = await generateSigningKey();
    const did = await generateDid({
        encryptionPublicKey: ek.publicJwk,
        signingPublicKey: sk.publicJwk
    });
    return {
        config,
        ek,
        sk,
        did,
    };
};

export async function verifierReducer(state: VerifierState, event: any): Promise<VerifierState> {
    if (event.type === 'siop-request-created') {
        return { ...state, siopRequest: event.siopRequest };
    }
    if (event.type === 'siop-response-received') {
        return { ...state, siopResponse: event.siopResponse };
    }
    return state;
}

export async function prepareSiopRequest(state: VerifierState) {
    const siopState = base64url.encode(crypto.randomBytes(16));
    const siopRequestHeader = {
        kid: state.did + '#signing-key-1'
    };
    // TODO read window.location from state rather than browser global
    const responseUrl =  state.config.requestMode === 'form_post' ? `${serverBase}/siop` : window.location.href.split('?')[0]
    const siopRequestPayload = {
        state: siopState,
        'iss': state.did,
        'response_type': 'id_token',
        'client_id': responseUrl,
        'claims': state.config.claimsRequired.length == 0 ? undefined : {
            'id_token': state.config.claimsRequired.reduce((acc, next) => ({
                ...acc,
                [next]: { 'essential': true }
            }), {})
        },
        'scope': 'did_authn',
        'response_mode': state.config.requestMode,
        'nonce': base64url.encode(crypto.randomBytes(16)),
        'registration': {
            'id_token_signed_response_alg': ['ES256K'],
            'client_uri': serverBase
        }
    };
    const siopRequestPayloadSigned = await state.sk.sign(siopRequestHeader, siopRequestPayload);
    const siopRequestCreated = await axios.post(`${serverBase}/siop/begin`, {
        siopRequest: siopRequestPayloadSigned
    });
    const siopRequestQrCodeUrl = 'openid://?' + qs.encode({
        response_type: 'id_token',
        scope: 'did_authn',
        request_uri: serverBase + '/siop/' + siopRequestPayload.state,
        client_id: siopRequestPayload.client_id
    });

    return ({
        type: 'siop-request-created',
        siopRequest: {
            siopRequestPayload,
            siopRequestPayloadSigned,
            siopRequestQrCodeUrl,
            siopResponsePollingUrl: siopRequestCreated.data.responsePollingUrl
        }
    });

}

export async function receiveSiopResponse(state: VerifierState) {
    const POLLING_RATE_MS = 500; // Obviously replace this with websockets, SSE, etc
    let responseRetrieved;
    do {
        if (state.config.requestMode === 'form_post') {
            responseRetrieved = await axios.get(serverBase + state.siopRequest.siopResponsePollingUrl);
        } else if (state.config.requestMode === 'fragment') {
            responseRetrieved = {
                data: state.fragment
            }
        }
        await new Promise((resolve) => setTimeout(resolve, POLLING_RATE_MS));
    } while (!responseRetrieved.data);

    const idTokenRetrieved = responseRetrieved.data.id_token;
    const idTokenRetrievedDecrypted = await state.ek.decrypt(idTokenRetrieved);
    const idTokenVerified = await verifyJws(idTokenRetrievedDecrypted);
    if (idTokenVerified.valid) {
        const idToken = idTokenVerified.payload;
        return ({
            type: 'siop-response-received',
            siopResponse: {
                idTokenEncrypted: idTokenRetrieved,
                idTokenSigned: idTokenRetrievedDecrypted,
                idTokenPayload: idTokenVerified.payload
            }
        });
    }
}
