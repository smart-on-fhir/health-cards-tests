import axios from 'axios';
import base64 from 'base-64';
import { JWKECKey } from 'jose';
import qs from 'querystring';
import { privateJwks, publicJwks, serverBase } from './config';
import { SiopManager } from './siop';
import { simulatedOccurrence } from './verifier';
import { ClaimType } from './VerifierState';

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

    const vcs = (await axios.post(`${serverBase}/fhir/Patient/123/$HealthWallet.issueVc`, {
                "resourceType": "Parameters",
                "parameter": [{
                    "name": "credentialType",
                    "valueUri": "https://smarthealth.cards#covid19"
                }]
            })).data.parameter.map(p => base64.decode(p.valueAttachment.data));
    
    await dispatch(receiveVcs(vcs, state))


    await dispatch({ 'type': 'begin-interaction', who: 'verifier' })

    interaction = currentInteraction(state)
    qrCodeUrl = (await simulatedOccurrence({ who: interaction.siopPartnerRole, type: 'display-qr-code' })).url;
    await dispatch(receiveSiopRequest(qrCodeUrl, state))
    await dispatch(prepareSiopResponse(state))

}

export interface SiopRequest {
    response_type: 'id_token';
    scope: string;
    nonce: string;
    registration: {
        id_token_encrypted_response_alg?: string;
        id_token_encrypted_response_enc?: string;
        id_token_signed_response_alg: string;
        client_uri: string;
    };
    response_mode: 'form_post' | 'fragment' | 'query';
    response_context?: 'wallet' | 'rp';
    claims?: any;
    client_id: string;
    state: string;
    iss: string;
}

export interface SiopResponse {
  "iss": "https://self-issued.me",
  "aud": string,
  "nonce": string,
  "exp": number,
  "iat": number,
  "sub_jwk": JWKECKey,
  "vp": {
    "@context": string[],
    "type": string[],
    "verifiableCredential": string[]
  }
}

export interface SiopInteraction {
    siopRequest?: {
        response_type: 'id_token';
        scope: string;
        nonce: string;
        registration: {
            id_token_encrypted_response_alg?: string;
            id_token_encrypted_response_enc?: string;
            id_token_signed_response_alg: string;
            client_uri: string;
        };
        response_mode: 'form_post' | 'fragment' | 'query';
        response_context?: 'wallet' | 'rp';
        claims?: any;
        client_id: string;
        state: string;
        iss: string;
    };
    siopResponse?: any;
    siopPartnerRole?: 'verifier' | 'issuer'
    status: 'need-qrcode' | 'need-request' | 'need-approval' | 'need-redirect' | 'complete'
}

export interface HolderState {
    siopRequestManager: SiopManager;
    qrCodeUrl?: string;
    interactions: SiopInteraction[];
    vcStore: {
        type: ClaimType[],
        vcSigned: string,
        vcPayload: any;
    }[]
}

export const currentInteraction = (state: HolderState): SiopInteraction =>
    state.interactions.filter(i => !i.siopResponse)[0]

export const initializeHolder = async (): Promise<HolderState> => {
    return {
        interactions: [],
        vcStore: [],
        siopRequestManager: new SiopManager({signingKey: privateJwks.holder.keys[0] as JWKECKey})
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
            vcStore: [...state.vcStore, ...event.vcs.map(vcDetails => ({
                type: vcDetails.type,
                vcSigned: vcDetails.vcSigned,
                vcPayload: vcDetails.vcPayload
            }))]
        }

    }
    console.log('Unhandled event!', event);
    return state;
}

export async function receiveSiopRequest(qrCodeUrl: string, state: HolderState) {
    const qrCodeParams = qs.parse(qrCodeUrl.split('?')[1]);
    const requestUri = qrCodeParams.request_uri as string;
    const siopRequestRaw = (await axios.get(requestUri)).data;
    const siopRequestVerified = await state.siopRequestManager.validateSiopRequest(siopRequestRaw);
    return ({
        type: 'siop-request-received',
        siopRequest: siopRequestVerified,
    });
}

const claimsForType = (k: ClaimType, vcStore: HolderState["vcStore"]) => {
    return vcStore.filter(({ type }) => type.find(t => t === k)).map(({ vcSigned }) => vcSigned)
}

const presentationForEssentialClaims = (vcStore: HolderState["vcStore"], claims: {
    id_token: {
        string: { essential: boolean }
    }
}): {vp: SiopResponse['vp']} => {

    const id_token = claims?.id_token;

    const essentialClaims: string[] = Object
        .entries(id_token || {})
        .filter(([k, v]) => v.essential)
        .flatMap(([k, v]) => claimsForType(k as ClaimType, vcStore))

    return {
        'vp': {
            '@context': [
                'https://www.w3.org/2018/credentials/v1',
            ],
            'type': ['VerifiablePresentation'],
            'verifiableCredential': essentialClaims
        }
    }
}

export async function prepareSiopResponse(state: HolderState) {
    const interaction = currentInteraction(state)
    const idTokenPayload = {
        'iss': 'https://self-issued.me' as 'https://self-issued.me',
        'aud': interaction.siopRequest.client_id,
        'nonce': interaction.siopRequest?.nonce,
        'iat': new Date().getTime() / 1000,
        'exp': new Date().getTime() / 1000 + 120,
        'sub_jwk': publicJwks.holder.keys[0],
        ...presentationForEssentialClaims(state.vcStore, currentInteraction(state).siopRequest.claims)
    };
    const idTokenSigned = await state.siopRequestManager.signJws(idTokenPayload);

    let idTokenEncrypted
    if (interaction?.siopRequest?.registration?.id_token_encrypted_response_alg) {
        idTokenEncrypted = await state.siopRequestManager.encryptJwsToIssuer(idTokenSigned, interaction.siopRequest.iss);
    }
    const siopResponse = {
        state: interaction.siopRequest.state,
        id_token: idTokenEncrypted || idTokenSigned
    };
    const responseUrl = interaction.siopRequest.client_id;

    console.log(" holder responding", interaction)
    if (interaction.siopRequest.response_mode === 'form_post' && interaction.siopRequest.response_context === 'wallet') {
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
        needRedirect: interaction.siopRequest.response_context !== 'wallet'
    });
}

export async function receiveVcs(vcs: string[], state: HolderState) {
    const vcsExpanded = await Promise.all(vcs.map(async (vcSigned) => {
        const vcVerified = await state.siopRequestManager.verifyHealthCardJws(vcSigned);
        return {
            type: vcVerified.vc.type,
            vcSigned,
            vcPayload: vcVerified
        }
    }))

    return ({ 'type': 'vc-retrieved', vcs: vcsExpanded })
}