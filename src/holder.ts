import axios from 'axios';
import base64url from 'base64url';
import * as crypto from 'crypto';
import qs from 'querystring';
import { encryptFor, generateDid, verifyJws } from './dids';
import { sampleVc } from './fixtures';
import { EncryptionKey, generateEncryptionKey, generateSigningKey, SigningKey } from './keys';
import { simulatedOccurrence } from './verifier';
import QrScanner from 'qr-scanner';
QrScanner.WORKER_PATH = 'qr-scanner-worker.min.js';

export async function holderWorld(simulated) {
    let state = await initializeHolder(simulated);
    const event = async (e) => {
        const pre = state;
        state = await holderEvent(state, e);
        console.log('Holder event', e.type, e, state);
    };
    console.log('Holder initial state', state);
    await event({'type': 'begin-interaction', simulated, simulateBarcodeScanFrom: 'issuer'})
    await receiveSiopRequest(state, event);
    await prepareSiopResponse(state, event);

    await event({'type': 'begin-interaction', simulated, simulateBarcodeScanFrom: 'verifier'})
    await receiveSiopRequest(state, event);
    await prepareSiopResponse(state, event);

}

interface SiopInteraction {
    siopRequest?: any;
    siopResposne?: any;
    simulateBarcodeScanFrom?: 'verifier' | 'issuer'
}
interface HolderState {
    simulated: boolean;
    ek: EncryptionKey;
    sk: SigningKey;
    did: string;
    qrCodeUrl?: string;
    interactions: SiopInteraction[];
}

const currentInteraction = (state: HolderState) : SiopInteraction =>
    state.interactions.filter(i => !i.siopResposne)[0]

const initializeHolder = async (simulated: boolean): Promise<HolderState> => {
    const ek = await generateEncryptionKey();
    const sk = await generateSigningKey();
    const did = await generateDid({
        encryptionPublicKey: ek.publicJwk,
        signingPublicKey: sk.publicJwk
    });
    return {
        simulated,
        ek,
        sk,
        did,
        interactions: [
]
    };
};
async function holderEvent(state: HolderState, event: any): Promise<HolderState> {
    if (event.type === 'begin-interaction') {
        return {
            ...state,
            interactions: [...(state.interactions), {
                simulateBarcodeScanFrom:  state.simulated? event.simulateBarcodeScanFrom: undefined
            }]
        }
    }
    if (event.type === 'siop-request-received') {
        const interaction = currentInteraction(state)
        return {
            ...state,
            interactions: [...state.interactions.slice(0, -1), {
                ...interaction,
                siopRequest: event.siopRequest
            }]
        };
    }
    if (event.type === 'siop-response-submitted') {
        const currentInteraction = state.interactions[state.interactions.length - 1]
        return {
            ...state,
            interactions: [...state.interactions.slice(0, -1), {
                ...currentInteraction,
                siopResposne: event.siopResponse
            }]
        };
    }
    console.log('Unhandled event!', event);
    return state;
}

async function scanOneCode(): Promise<string> {
    return new Promise((resolve) => {
        const videoElement = window.document.getElementById('scanner-video') as HTMLVideoElement;
        console.log('Scanning in', videoElement);
        let qrScanner = new QrScanner(videoElement, result => {
            console.log('decoded qr code:', result);
            if (!result.length) { return; }
            qrScanner.destroy();
            qrScanner = null;
            resolve(result);
            videoElement.remove();
        });
        qrScanner.start();
    });
}
async function receiveSiopRequest(state: HolderState, event: (e: any) => Promise<void>) {
    let qrCodeUrl;
    const interaction = currentInteraction(state)
    if (state.simulated) {
        qrCodeUrl = (await simulatedOccurrence({ who: interaction.simulateBarcodeScanFrom, type: 'display-qr-code' })).url;
    } else {
        qrCodeUrl = await scanOneCode();
    }
    let qrCodeParams = qs.parse(qrCodeUrl.split('?')[1]);
    let requestUri = qrCodeParams.request_uri as string;
    const siopRequestRaw = (await axios.get(requestUri)).data;
    const siopRequestVerified = await verifyJws(siopRequestRaw);
    if (siopRequestVerified.valid) {
        await event({
            type: 'siop-request-received',
            siopRequest: siopRequestVerified.payload
        });
    }
}
async function prepareSiopResponse(state: HolderState, event: (e: any) => Promise<void>) {
    const interaction = currentInteraction(state)
    const idTokenHeader = {
        'kid': state.did + '#signing-key-1'
    };
    const idTokenPayload = {
        'iss': 'https://self-issued.me',
        'aud': interaction.siopRequest.client_id,
        'nonce': base64url.encode(crypto.randomBytes(16)),
        'iat': new Date().getTime() / 1000,
        'exp': new Date().getTime() / 1000 + 120,
        'did': state.did,
        'presentations': [{
            'placeholderForVerfiablePresentation': sampleVc.credentialSubject
        }]
    };
    const idTokenSigned = await state.sk.sign({ kid: state.did + '#signing-key-1' }, idTokenPayload);
    const idTokenEncrypted = await encryptFor(idTokenSigned, interaction.siopRequest.iss, state.ek);
    const siopResponse = {
        state: interaction.siopRequest.state,
        id_token: idTokenEncrypted
    };
    const responseUrl = interaction.siopRequest.client_id;
    const siopResponseCreated = await axios.post(responseUrl, qs.stringify(siopResponse));
    await event({
        type: 'siop-response-submitted',
        siopResponse: {
            idTokenPayload,
            idTokenSigned,
            idTokenEncrypted,
            formPostBody: siopResponse,
            success: siopResponseCreated.status === 200
        }
    });
}
