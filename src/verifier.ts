import axios from 'axios';
import base64url from 'base64url';
import * as crypto from 'crypto';
import QRCode from 'qrcode';
import qs from 'querystring';
import { serverBase } from './config';
import { generateDid, verifyJws } from './dids';
import { EncryptionKey, generateEncryptionKey, generateSigningKey, SigningKey } from './keys';


export enum ClaimType {
    CovidSerology = 'vc-health-passport-stamp-covid19-serology',
    ImmunizationCard = 'vc-health-passport-stamp',
}

export async function verifierWorld(role = 'verifier') {
    let state = await initializeVerifier({ role, claimsRequired: [ClaimType.CovidSerology] });
    const dispatch = async (ePromise) => {
        const e = await ePromise;
        const pre = state;
        state = await verifierReducer(state, e);
        console.log('Verifier Event', e.type, e, state);
    };
    console.log('Verifier initial state', state);
    await dispatch(prepareSiopRequest(state));
    await dispatch(receiveSiopResponse(state));
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

export interface VerifierState {
    ek: EncryptionKey;
    sk: SigningKey;
    did: string;
    config: {
        role: string;
        claimsRequired: ClaimType[]
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
}
export const initializeVerifier = async (config: VerifierState["config"]): Promise<VerifierState> => {
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
    const siopRequestPayload = {
        state: siopState,
        'iss': state.did,
        'response_type': 'id_token',
        'client_id': `${serverBase}/siop`,
        'claims': state.config.claimsRequired.length == 0 ? undefined : {
            'id_token': state.config.claimsRequired.reduce((acc, next) => ({
                ...acc,
                [next]: { 'essential': true }
            }), {})
        },
        'scope': 'did_authn',
        'response_mode': 'form_post',
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

    simulate({
        'type': 'display-qr-code',
        'who': state.config.role,
        'url': siopRequestQrCodeUrl
    });

    const canvas = document.getElementById('qrcode-canvas');
    canvas && QRCode.toCanvas(canvas, siopRequestQrCodeUrl, { scale: 20 }, (error) => {
        if (error) console.error(error);
        console.log('success!');
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
        responseRetrieved = await axios.get(serverBase + state.siopRequest.siopResponsePollingUrl);
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
