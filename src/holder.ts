import axios from 'axios';
import base64url from 'base64url';
import * as crypto from 'crypto';
import qs from 'querystring';
import { serverBase } from './config';
import { encryptFor, generateDid, verifyJws } from './dids';
import { keyGenerators } from './keys';
import { EncryptionKey, SigningKey } from './KeyTypes';
import { ClaimType, simulatedOccurrence } from './verifier';

export async function holderWorld() {
    let state = await initializeHolder();
    let qrCodeUrl;
    let interaction;

    const dispatch = async (ePromise) => {
        const pre = state;
        const e = await ePromise
        state = await holderReducer(state, e);
        console.log('Holder event', e.type, e, state);
    };
    console.log('Holder initial state', state);

    await dispatch({ 'type': 'begin-interaction', who: 'issuer' })

    interaction = currentInteraction(state)
    qrCodeUrl = (await simulatedOccurrence({ who: interaction.siopPartnerRole, type: 'display-qr-code' })).url;


    await dispatch(receiveSiopRequest(qrCodeUrl, state))
    await dispatch(prepareSiopResponse(state))

    await dispatch(simulatedOccurrence({ who: 'issuer', type: 'notify-credential-ready' }))

    const vcs = (await axios.get(`${serverBase}/lab/vcs/${encodeURIComponent(state.did)}`)).data.vcs
    await dispatch(retrieveVcs(vcs, state))


    await dispatch({ 'type': 'begin-interaction', who: 'verifier' })

    interaction = currentInteraction(state)
    qrCodeUrl = (await simulatedOccurrence({ who: interaction.siopPartnerRole, type: 'display-qr-code' })).url;
    await dispatch(receiveSiopRequest(qrCodeUrl, state))
    await dispatch(prepareSiopResponse(state))

}

export interface SiopInteraction {
    siopRequest?: any;
    siopResponse?: any;
    siopPartnerRole?: 'verifier' | 'issuer'
    status: 'need-qrcode' | 'need-request' | 'need-approval' | 'need-redirect' | 'complete'
}

export interface HolderState {
    ek: EncryptionKey;
    sk: SigningKey;
    did: string;
    qrCodeUrl?: string;
    interactions: SiopInteraction[];
    vcStore: {
        type: ClaimType,
        vcSigned: string,
        vcPayload: any;
    }[]
}

export const currentInteraction = (state: HolderState): SiopInteraction =>
    state.interactions.filter(i => !i.siopResponse)[0]

export const initializeHolder = async (): Promise<HolderState> => {
    const ek = await keyGenerators.generateEncryptionKey();
    const sk = await keyGenerators.generateSigningKey();
    const did = await generateDid({
        encryptionPublicKey: ek.publicJwk,
        signingPublicKey: sk.publicJwk
    });
    return {
        ek,
        sk,
        did,
        interactions: [],
        vcStore: []
    };
};
export async function holderReducer(state: HolderState, event: any): Promise<HolderState> {
    if (event.type === 'begin-interaction') {
        return {
            ...state,
            interactions: [...(state.interactions), {
                siopPartnerRole: event.who,
                status: 'need-qrcode'
            }]
        }
    }
    if (event.type === 'siop-request-received') {
        const interaction = currentInteraction(state)
        if (interaction) {
            return {
                ...state,
                interactions: [...state.interactions.slice(0, -1), {
                    ...interaction,
                    siopRequest: event.siopRequest,
                    status: "need-approval"
                }]
            };
        } else {
            return {
                ...state,
                interactions: [...state.interactions, {
                    siopPartnerRole: 'issuer',
                    siopRequest: event.siopRequest,
                    status: "need-approval"
                }]
            }
        }
    }
    if (event.type === 'siop-response-prepared') {
        const interaction = currentInteraction(state)
        if (event.needRedirect) {
            return {
                ...state,
                interactions: [...state.interactions.slice(0, -1), {
                    ...interaction,
                    siopResponse: event.siopResponse,
                    status: "need-redirect"
                }]
            };
        } else {
            return {
                ...state,
                interactions: [...state.interactions.slice(0, -1), {
                    ...interaction,
                    siopResponse: event.siopResponse,
                    status: "complete"
                }]
            };

        }
    }
    if (event.type === 'siop-response-complete') {
        return {
            ...state,
            interactions: [...state.interactions.slice(0, -1), {
                ...(state.interactions.slice(-1)[0]),
                status: "complete"
            }]
        };


    }
    if (event.type === 'vc-retrieved') {
        return {
            ...state,
            vcStore: [...state.vcStore, {
                type: "vc-health-passport-stamp-covid19-serology", // TODO inspect VC for type
                vcSigned: event.vc,
                vcPayload: event.vcPayload
            }]
        }

    }
    console.log('Unhandled event!', event);
    return state;
}

export async function receiveSiopRequest(qrCodeUrl: string, state: HolderState) {
    const qrCodeParams = qs.parse(qrCodeUrl.split('?')[1]);
    const requestUri = qrCodeParams.request_uri as string;
    const siopRequestRaw = (await axios.get(requestUri)).data;
    const siopRequestVerified = await verifyJws(siopRequestRaw, keyGenerators);
    if (siopRequestVerified.valid) {
        return ({
            type: 'siop-request-received',
            siopRequest: siopRequestVerified.payload,
        });
    } else {
        console.log("IVALID SIOP REQUEST", siopRequestRaw, siopRequestVerified)
    }
}

const claimsForType = (k: ClaimType, vcStore: HolderState["vcStore"]) => {
    return vcStore.filter(({ type }) => type === k).map(({ vcSigned }) => vcSigned)
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
    const idTokenEncrypted = await encryptFor(idTokenSigned, interaction.siopRequest.iss, keyGenerators);
    const siopResponse = {
        state: interaction.siopRequest.state,
        id_token: idTokenEncrypted
    };
    const responseUrl = interaction.siopRequest.client_id;

    if (interaction.siopRequest.response_mode === 'form_post') {
        const siopResponseCreated = await axios.post(responseUrl, qs.stringify(siopResponse));
    }
    return ({
        type: 'siop-response-prepared',
        siopResponse: {
            idTokenPayload,
            idTokenSigned,
            idTokenEncrypted,
            formPostBody: siopResponse,
        },
        needRedirect: interaction.siopRequest.response_mode === 'fragment'
    });
}

export async function retrieveVcs(vcs: any, state: HolderState) {
    const vcRetrieved = vcs[0]
    const vcDecrypted = await state.ek.decrypt(vcs[0]);
    const vcVerified = await verifyJws(vcDecrypted, keyGenerators);
    if (vcVerified.valid){
        return ({ 'type': 'vc-retrieved', vc: vcDecrypted, verified: vcVerified.valid, vcPayload: vcVerified.payload })
    }
}
