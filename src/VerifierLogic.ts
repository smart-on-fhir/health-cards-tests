import axios from 'axios';
import base64url from 'base64url';
import * as crypto from 'crypto';
import qs from 'querystring';
import { ALLOW_INVALID_SIGNATURES, serverBase } from './config';
import * as CredentialManager from './CredentialManager';
import { encryptFor, verifyJws } from './dids';
import sampleVcCovidAb from './fixtures/vc-jwt-payload.json';
import sampleVcTdap from './fixtures/vc-tdap-jwt-payload.json'
import sampleVcCovidPcr from './fixtures/vc-c19-pcr-jwt-payload.json';
import { VerifierState } from './VerifierState';
import { VerificationResult } from './KeyTypes';


export async function verifierReducer(state: VerifierState, event: any): Promise<VerifierState> {
    if (event.type === 'siop-request-created') {
        return { ...state, siopRequest: event.siopRequest, siopResponse: undefined };
    }
    if (event.type === 'siop-response-received') {
        return { ...state, siopResponse: event.siopResponse };
    }

    console.log('Unrecogized event type', event);
    return state;
}
export async function prepareSiopRequest(state: VerifierState) {
    const siopState = base64url.encode(crypto.randomBytes(16));
    const siopRequestHeader = {
        kid: state.did + '#signing-key-1'
    };
    // TODO read window.location from state rather than browser global
    const responseUrl = state.config.responseMode === 'form_post' ? `${state.config.serverBase}/siop` : window.location.href.split('?')[0];
    const siopRequestPayload: VerifierState["siopRequest"]["siopRequestPayload"] = {
        state: siopState,
        'iss': state.did,
        'response_type': 'id_token',
        'client_id': responseUrl,
        'claims': state.config.claimsRequired.length === 0 ? undefined : {
            'id_token': state.config.claimsRequired.reduce((acc, next) => ({
                ...acc,
                [next]: { 'essential': true }
            }), {})
        },
        'scope': 'did_authn',
        'response_mode': state.config.responseMode,
        'response_context': state.config.responseMode === 'form_post' ? 'wallet' : 'rp',
        'nonce': base64url.encode(crypto.randomBytes(16)),
        'registration': {
            'id_token_encrypted_response_alg': state.config.skipEncryptedResponse ? undefined : 'RSA-OAEP',
            'id_token_encrypted_response_enc': state.config.skipEncryptedResponse ? undefined : 'A128CBC-HS256',
            'id_token_signed_response_alg': 'ES256K',
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

export interface CredentialGenerationDetals {
    type: string,
    presentationContext: string,
    identityClaims: string[],
    encryptVc?: boolean,
    encryptVcForKeyId?: string // just the id portion, i.e., `#` and everything after
}

export const defaultIdentityClaims = {
    "https://healthwallet.cards#presentation-context-online": [
        "Patient.telecom",
        "Patient.name",
    ],
    "https://healthwallet.cards#presentation-context-in-person": [
        "Patient.name",
        "Patient.photo"
    ]
}

export const issueVcsToHolder = async (state: VerifierState, details: CredentialGenerationDetals = {
    type: 'https://healthwallet.cards#covid19',
    presentationContext: 'https://healthwallet.cards#presentation-context-online',
    identityClaims: null,
    encryptVc: true,
}): Promise<{
    type: 'credential-ready',
    vcs: string[]
}> => {

    const subjectDid = state.siopResponse.idTokenPayload.did;
    let examplePatient, exampleClinicalResults;

    const vcsAvailableToIssue = [
        sampleVcCovidAb,
        sampleVcCovidPcr,
        sampleVcTdap,
    ]

    const vcs: string[] = [];
    for (const vcAvailable of vcsAvailableToIssue){
        if (vcAvailable.vc.type.find(t => t === details.type)) {
            examplePatient = vcAvailable.vc.credentialSubject.fhirBundle.entry[0].resource
            exampleClinicalResults = (vcAvailable as any).vc.credentialSubject.fhirBundle.entry.slice(1).map(r => r.resource)
            const examplePatientRestricted = defaultIdentityClaims[details.presentationContext]
                .filter(c => details.identityClaims === null || details.identityClaims.includes(c))
                .map(prop => prop.split(".")[1])
                .reduce((prev, element) => ({
                    ...prev,
                    [element]: examplePatient[element]
                }), {
                    resourceType: examplePatient.resourceType,
                    extension: examplePatient.extension
                })

                const vc = CredentialManager.createVc(details.presentationContext, vcAvailable.vc.type, state.did, subjectDid, examplePatientRestricted, exampleClinicalResults)
                const vcPayload = CredentialManager.vcToJwtPayload(vc)

                const vcSigned = await state.sk.sign({ kid: state.did + '#signing-key-1' }, vcPayload);

                const vcEncrypted = details.encryptVc ? 
                    await encryptFor(vcSigned, subjectDid, state.config.keyGenerators, details.encryptVcForKeyId):
                    vcSigned;

                vcs.push(vcEncrypted)
        }
    }


    if (!state.config.skipVcPostToServer) {
        const vcCreated = await axios.post(`${serverBase}/lab/vcs/${encodeURIComponent(subjectDid)}`, {
            vcs
        });
    }

    return ({
        type: 'credential-ready',
        vcs
    });

};



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
                idTokenPayload: idTokenVerified.payload,
                idTokenVcs: (await Promise.all((idTokenVerified.payload?.vp?.verifiableCredential || []).map(vc => verifyJws(vc, state.config.keyGenerators))))
                    .map((jws: VerificationResult) => jws.valid && jws.payload)
            }
        });
    }
}

export async function issuerReducer(state: VerifierState, event: any): Promise<VerifierState> {
    if (event.type === 'credential-ready') {
        return {
            ...state,
            issuedCredentials: event.vcs
        };
    }

    return verifierReducer.call(null, ...arguments);
}
