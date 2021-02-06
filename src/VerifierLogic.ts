import axios from 'axios';
import base64url from 'base64url';
import * as crypto from 'crypto';
import qs from 'querystring';
import { privateJwks, publicJwks, serverBase } from './config';
import * as CredentialManager from './CredentialManager';
import sampleVcCovidPcr from './fixtures/vc-c19-pcr-jwt-payload.json';
import sampleVcCovidImmunization from './fixtures/vc-covid-immunization.json';
import sampleVcCovidAb from './fixtures/vc-jwt-payload.json';
import { SiopRequest, SiopResponse } from './holder';
import { VerifierState } from './VerifierState';


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
    // TODO read window.location from state rather than browser global
    const responseUrl = state.config.responseMode === 'form_post' ? `${state.config.serverBase}/siop` : window.location.href.split('?')[0];
    const siopRequestPayload: VerifierState["siopRequest"]["siopRequestPayload"] = {
        state: siopState,
        'iss': state.config.serverBase.slice(0, -4) + '/verifier',
        'response_type': 'id_token',
        'client_id': responseUrl,
        'claims': state.config.claimsRequired.length === 0 ? undefined : {
            'id_token': state.config.claimsRequired.reduce((acc, next) => ({
                ...acc,
                [next]: { 'essential': true }
            }), {})
        },
        'scope': 'healthwallet_authn',
        'response_mode': state.config.responseMode,
        'response_context': state.config.responseMode === 'form_post' ? 'wallet' : 'rp',
        'nonce': base64url.encode(crypto.randomBytes(16)),
        'registration': {
            'id_token_encrypted_response_alg': state.config.skipEncryptedResponse ? undefined : 'ECDH-ES',
            'id_token_encrypted_response_enc': state.config.skipEncryptedResponse ? undefined : 'A256GCM',
            'id_token_signed_response_alg': 'ES256',
            'client_uri': serverBase
        }
    };

    const verifierKey = privateJwks.verifier.keys[0]

    const siopRequestPayloadSigned = await state.siopManager.signJws(siopRequestPayload);
    const siopRequestCreated = await state.config.postRequest(`${serverBase}/siop/begin`, {
        siopRequest: siopRequestPayloadSigned
    });
    const siopRequestQrCodeUrl = 'openid://?' + qs.encode({
        response_type: 'id_token',
        scope: 'healthwallet_authn',
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

// TODO: move to issuer logic file
export interface CredentialGenerationDetals {
    type: string,
    presentationContext: string,
    compressForQr?: boolean,
    identityClaims?: string[],
    holderDid?: string
}

export const defaultIdentityClaims = {
    "https://smarthealth.cards#qr": [
        "Patient.telecom",
        "Patient.name",
    ],
    "https://smarthealth.cards#presentation-context-online": [
        "Patient.telecom",
        "Patient.name",
        "Patient.gender",
        "Patient.birthDate",
        "Patient.telecom",
        "Patient.address",
    ],
    "https://smarthealth.cards#presentation-context-in-person": [
        "Patient.name",
        "Patient.photo"
    ]
}

export const createHealthCards = async (state: VerifierState, details: CredentialGenerationDetals = {
    type: 'https://smarthealth.cards#covid19',
    presentationContext: 'https://smarthealth.cards#presentation-context-online',
    identityClaims: null,
}): Promise<{
    type: 'credential-ready',
    vcs: string[]
}> => {


    let examplePatient, exampleClinicalResults;

    const vcsAvailableToIssue = [
        sampleVcCovidAb,
        sampleVcCovidImmunization,
        sampleVcCovidPcr,
    ]

    const vcs: string[] = [];
    for (const vcAvailable of vcsAvailableToIssue) {
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

            const holderDid: string | null = state.siopResponse ? state.siopResponse.idTokenPayload.did : null


            let issuerOrigin = new URL(state.config.serverBase).origin;

        
            const vc = CredentialManager.createHealthCard(details.presentationContext, vcAvailable.vc.type, state.config.issuerUrl, examplePatientRestricted, exampleClinicalResults)
            const vcPayload = CredentialManager.vcToJwtPayload(vc)
            const vcSigned = await state.siopManager.signJws(vcPayload, true);

            vcs.push(vcSigned)
        }
    }

    return ({
        type: 'credential-ready',
        vcs
    });


}
export const issueHealthCardsToHolder = async (state: VerifierState, details: CredentialGenerationDetals = {
    type: 'https://smarthealth.cards#covid19',
    presentationContext: 'https://smarthealth.cards#presentation-context-online',
    identityClaims: null,
}): Promise<{
    type: 'credential-ready',
    vcs: string[]
}> => {

    const vcs = await createHealthCards(state, details);

    if (!state.config.skipVcPostToServer) {
        const subjectDid: string | null = state.siopResponse ? state.siopResponse.idTokenPayload.did : null;
        const vcCreated = await axios.post(`${serverBase}/lab/vcs/${encodeURIComponent(subjectDid)}`, {
            vcs
        });
    }

    return vcs;
};



export async function parseSiopResponse(idTokenRetrieved: string, state: VerifierState) {

    const idTokenSigned = await state.siopManager.decryptJws(idTokenRetrieved);
    const idTokenPayload: SiopResponse = await state.siopManager.validateSiopResponse(idTokenSigned, state.siopRequest!.siopRequestPayload as SiopRequest);
    return ({
        type: 'siop-response-received',
        siopResponse: {
            idTokenSigned: idTokenRetrieved,
            idTokenPayload,
            idTokenVcs: (await Promise.all((idTokenPayload.vp?.verifiableCredential || []).map(vc => state.siopManager.verifyHealthCardJws(vc))))
        }
    });
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
