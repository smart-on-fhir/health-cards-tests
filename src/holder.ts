import axios from 'axios';
import base64url from 'base64url';
import * as crypto from 'crypto';
import qs from 'querystring';
import { encryptFor, generateDid, verifyJws } from './dids';
import { sampleVc } from './fixtures';
import { EncryptionKey, generateEncryptionKey, generateSigningKey, SigningKey } from './keys';
import { simulatedOccurrence, ClaimType } from './verifier';
import { serverBase } from './config';

export async function holderWorld(simulated) {
    let state = await initializeHolder(simulated);
    let qrCodeUrl;
    let interaction;

    const dispatch = async (ePromise) => {
        const pre = state;
        const e = await ePromise
        state = await holderEvent(state, e);
        console.log('Holder event', e.type, e, state);
    };
    console.log('Holder initial state', state);

    await dispatch({ 'type': 'begin-interaction', who: 'issuer' })

    interaction = currentInteraction(state)
    qrCodeUrl = (await simulatedOccurrence({ who: interaction.simulateBarcodeScanFrom, type: 'display-qr-code' })).url;


    await dispatch(receiveSiopRequest(qrCodeUrl, state))
    await dispatch(prepareSiopResponse(state))

    await dispatch(simulatedOccurrence({ who: 'issuer', type: 'notify-credential-ready' }))
    await dispatch(retrieveVcs(state))


    await dispatch({ 'type': 'begin-interaction', who: 'verifier' })

    interaction = currentInteraction(state)
    qrCodeUrl = (await simulatedOccurrence({ who: interaction.simulateBarcodeScanFrom, type: 'display-qr-code' })).url;
    await dispatch(receiveSiopRequest(qrCodeUrl, state))
    await dispatch(prepareSiopResponse(state))

}

export interface SiopInteraction {
    siopRequest?: any;
    siopResponse?: any;
    simulateBarcodeScanFrom?: 'verifier' | 'issuer'
    status: 'need-qrcode' | 'need-request' | 'need-approval' | 'complete'
}

export interface HolderState {
    simulated: boolean;
    ek: EncryptionKey;
    sk: SigningKey;
    did: string;
    qrCodeUrl?: string;
    interactions: SiopInteraction[];
    vcStore: {
        type: ClaimType,
        vc: string
    }[]
}

export const currentInteraction = (state: HolderState): SiopInteraction =>
    state.interactions.filter(i => !i.siopResponse)[0]

export const initializeHolder = async (simulated: boolean): Promise<HolderState> => {
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
        interactions: [],
        vcStore: []
    };
};
export async function holderEvent(state: HolderState, event: any): Promise<HolderState> {
    if (event.type === 'begin-interaction') {
        return {
            ...state,
            interactions: [...(state.interactions), {
                simulateBarcodeScanFrom: event.who,
                status: 'need-qrcode'
            }]
        }
    }
    if (event.type === 'siop-request-received') {
        const interaction = currentInteraction(state)
        return {
            ...state,
            interactions: [...state.interactions.slice(0, -1), {
                ...interaction,
                siopRequest: event.siopRequest,
                status: "need-approval"
            }]
        };
    }
    if (event.type === 'siop-response-submitted') {
        const currentInteraction = state.interactions[state.interactions.length - 1]
        return {
            ...state,
            interactions: [...state.interactions.slice(0, -1), {
                ...currentInteraction,
                siopResponse: event.siopResponse,
                status: "complete"
            }]
        };
    }
    if (event.type === 'vc-retrieved') {
        return {
            ...state,
            vcStore: [...state.vcStore, {
                type: ClaimType.CovidSerology, // TODO inspect VC for type
                vc: event.vc
            }]
        }

    }
    console.log('Unhandled event!', event);
    return state;
}

export async function receiveSiopRequest(qrCodeUrl: string, state: HolderState) {
    let qrCodeParams = qs.parse(qrCodeUrl.split('?')[1]);
    let requestUri = qrCodeParams.request_uri as string;
    const siopRequestRaw = (await axios.get(requestUri)).data;
    const siopRequestVerified = await verifyJws(siopRequestRaw);
    if (siopRequestVerified.valid) {
        return ({
            type: 'siop-request-received',
            siopRequest: siopRequestVerified.payload
        });
    }
}

const claimsForType = (k: ClaimType, vcStore: HolderState["vcStore"]) => {
    return vcStore.filter(({ type }) => type === k).map(({ vc }) => vc)
}

const presentationForEssentialClaims = (vcStore: HolderState["vcStore"], claims: {
    id_token: {
        string: { essential: boolean }
    }
}): object => {

    const id_token = claims?.id_token;

    const essential: string[] = Object
        .entries(id_token || {})
        .filter(([k, v]) => v.essential)
        .map(([k, v]) => claimsForType(k as ClaimType, vcStore)[0])
    // TODO call flatMap to include all claims rather than 1st

    if (!essential.length) return {};

    return {
        'vp': {
            'verifiableCredential': essential
        }
    }
}

export async function prepareSiopResponse(state: HolderState) {
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
        ...presentationForEssentialClaims(state.vcStore, currentInteraction(state).siopRequest.claims)
    };
    const idTokenSigned = await state.sk.sign({ kid: state.did + '#signing-key-1' }, idTokenPayload);
    const idTokenEncrypted = await encryptFor(idTokenSigned, interaction.siopRequest.iss);
    const siopResponse = {
        state: interaction.siopRequest.state,
        id_token: idTokenEncrypted
    };
    const responseUrl = interaction.siopRequest.client_id;
    const siopResponseCreated = await axios.post(responseUrl, qs.stringify(siopResponse));
    return ({
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

export async function retrieveVcs(state: HolderState) {
    const vcs = (await axios.get(`${serverBase}/lab/vcs/${encodeURIComponent(state.did)}`)).data.vcs
    const vcRetrieved = vcs[0]
    const vcDecrypted = await state.ek.decrypt(vcs[0]);
    const vcVerified = await verifyJws(vcDecrypted);

    return ({ 'type': 'vc-retrieved', vc: vcDecrypted, verified: vcVerified.valid })
}
