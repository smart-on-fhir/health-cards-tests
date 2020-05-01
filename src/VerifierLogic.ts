import base64url from 'base64url';
import qs from 'querystring';
import { serverBase } from './config';
import { VerifierState } from './VerifierState';
import { sampleVc } from './fixtures';
import * as crypto from 'crypto'
import { encryptFor, verifyJws } from './dids';
import axios from 'axios';

export async function verifierReducer(state: VerifierState, event: any): Promise<VerifierState> {
    if (event.type === 'siop-request-created') {
        return { ...state, siopRequest: event.siopRequest };
    }
    if (event.type === 'siop-response-received') {
        return { ...state, siopResponse: event.siopResponse };
    }

    console.log("Unrecogized event type", event)
    return state;
}
export async function prepareSiopRequest(state: VerifierState) {
    const siopState = base64url.encode(crypto.randomBytes(16));
    const siopRequestHeader = {
        kid: state.did + '#signing-key-1'
    };
    // TODO read window.location from state rather than browser global
    const responseUrl = state.config.requestMode === 'form_post' ? `${state.config.serverBase}/siop` : window.location.href.split('?')[0];
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
    const siopRequestCreated = await state.config.postRequest(`${serverBase}/siop/begin`, {
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
            siopResponsePollingUrl: siopRequestCreated.responsePollingUrl
        }
    });
}

export const issueVcToHolder = async (state: VerifierState): Promise<any> => {
    const vcPayload = JSON.parse(JSON.stringify(sampleVc))
    const subjectDid = state.siopResponse.idTokenPayload.did
    vcPayload.credentialSubject.id = subjectDid

    const vcSigned = await state.sk.sign({ kid: state.did + '#signing-key-1' }, vcPayload);
    const vcEncrypted = await encryptFor(vcSigned, subjectDid, state.config.keyGenerators)

    if (!state.config.skipPostToServer) {
        const vcCreated = await axios.post(`${serverBase}/lab/vcs/${encodeURIComponent(subjectDid)}`, {
            vcs: [vcEncrypted]
        })
    }

    return ({
        type: 'credential-ready',
        vcs: [vcEncrypted]
    })

}

export async function parseSiopResponse(idTokenRetrieved: string, state: VerifierState) {
    const idTokenRetrievedDecrypted = await state.ek.decrypt(idTokenRetrieved);
    const idTokenVerified = await verifyJws(idTokenRetrievedDecrypted, state.config.keyGenerators);
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


export async function issuerReducer(state: VerifierState, event: any): Promise<VerifierState> {
    console.log("Reduce in", event)
    if (event.type === 'credential-ready') {
        return {
            ...state,
            issuedCredentials: event.vcs
        }
    }

    return await verifierReducer.call(null, ...arguments);
}





















