import axios from 'axios';
import * as crypto from 'crypto';
import QRCode from 'qrcode';
import qs from 'querystring';
import { serverBase } from './config';
import { generateDid, verifyJws } from './dids';
import { generateEncryptionKey, generateSigningKey, keyGenerators } from './keys';
import { VerifierState, SiopResponseMode } from './VerifierState';
import { verifierReducer, prepareSiopRequest, parseSiopResponse } from './VerifierLogic';


export async function verifierWorld (role = 'verifier', requestMode: SiopResponseMode = 'form_post', reset = false) {
    let state = await initializeVerifier({
        role,
        claimsRequired: ['vc-health-passport-stamp-covid19-serology'],
        responseMode: requestMode,
        reset,
        displayQr: false,
        postRequest: async (url, r) => (await axios.post(url, r)).data,
        serverBase,
        keyGenerators
    });

    const dispatch = async (ePromise) => {
        const e = await ePromise;
        const pre = state;
        state = await verifierReducer(state, e);
        console.log('Verifier Event', e.type, e, state);
    };
    console.log('Verifier initial state', state);

    if (!state.siopRequest) {
        await dispatch(prepareSiopRequest(state));
        displayRequest(state);
    }

    if (!state.siopResponse) {
        if (state.config.responseMode === 'form_post') {
            await dispatch(receiveSiopResponse(state));
        }
    }

    if (state.fragment?.id_token) {
        displayThanks(state);
    }

}

function displayThanks (state) {
    const link = document.getElementById('redirect-link');
    if (link) {
        window['clickRedirect'] = () => {
            window.localStorage[state.config.role + '_state'] = JSON.stringify(state);
            window.close();
        };
        link.innerHTML = "Thanks for sharing your COVID card! You're confirmed. <button  onclick=\"clickRedirect()\">Close</button>";
    }
}

export function displayRequest (state) {
    simulate({
        'type': 'display-qr-code',
        'who': state.config.role,
        'url': state.siopRequest.siopRequestQrCodeUrl
    });

    const canvas = document.getElementById('qrcode-canvas');
    if (canvas && state.config.displayQr) {
        QRCode.toCanvas(canvas, state.siopRequest.siopRequestQrCodeUrl, { scale: 20 }, (error) => {
            if (error) console.error(error);
            console.log('success!');
        });
    }

    const link = document.getElementById('redirect-link');
    if (link) {
        link.innerHTML = '<button  onclick="clickRedirect()">Connect to Health Wallet</button>';
    }

    window['clickRedirect'] = () => {
        window.localStorage[state.config.role + '_state'] = JSON.stringify(state);
        window.opener.postMessage(state.siopRequest.siopRequestQrCodeUrl, '*');
        window.close();
    };
}

// Cheap-o polling-based event simuation for the occasional
// cross-talk between holderWorld and verifierWorld
// (these are things where the user would act, in real life)
const simulatedInteractions = [];
export const simulate = (e) => {
    simulatedInteractions.push(e);
};
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


export const initializeVerifier = async (config: VerifierState['config']): Promise<VerifierState> => {
    const stateKey = `${config.role}_state`;
    const existingState = window.localStorage[stateKey];

    if (existingState && config.reset !== true) {
        const existingStateParsed = JSON.parse(existingState);
        const fragmentParts = qs.decode(window.location.hash.slice(1));
        return {
            ...existingStateParsed,
            config,
            ek: await generateEncryptionKey(existingStateParsed.ek.publicJwk, existingStateParsed.ek.privateJwk),
            sk: await generateSigningKey(existingStateParsed.sk.publicJwk, existingStateParsed.sk.privateJwk),
            did: existingStateParsed.did,
            fragment: {
                id_token: fragmentParts.id_token as string,
                state: fragmentParts.state as string
            }
        };
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
        did
    };
};

export async function receiveSiopResponse (state: VerifierState) {
    const POLLING_RATE_MS = 500; // Obviously replace this with websockets, SSE, etc
    let responseRetrieved;
    do {
        if (state.config.responseMode === 'form_post') {
            responseRetrieved = await axios.get(serverBase + state.siopRequest.siopResponsePollingUrl);
        } else if (state.config.responseMode === 'fragment') {
            responseRetrieved = {
                data: state.fragment
            };
        }
        await new Promise((resolve) => setTimeout(resolve, POLLING_RATE_MS));
    } while (!responseRetrieved.data);

    return parseSiopResponse(responseRetrieved.data.id_token, state);

}
