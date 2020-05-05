import sampleVc from './fixtures/vc.json';
import deepcopy from 'deepcopy';
import * as uuid from 'uuid';
import crypto from 'crypto'

import { randomBytes } from 'crypto';
import base64url from 'base64url';

const generateUri = () => `urn:uuid:${uuid.v4()}`

interface Entry {
    fullUrl: string;
    resource: any;
}

export const createVc = (issuer: string, subject: string, fhirIdentityResource: any, fhirClniicalResources: any[]) => {
    const vc = deepcopy(sampleVc);

    const identityEntry: Entry = {
        fullUrl: generateUri(),
        resource: fhirIdentityResource
    }

    const clinicalEntries = fhirClniicalResources.map(r => ({
        fullUrl: generateUri(),
        resource: {
            ...r,
            subject: {
                reference: identityEntry.fullUrl
            }
        }
    }))

    vc.issuer = issuer;
    vc.credentialSubject.id = subject;
    vc.credentialSubject.fhirBundle.entry = [identityEntry, ...clinicalEntries]
    return vc
}

interface VC {
    id?: string;
    issuer?: string;
    issuanceDate?: number;
    expirationDate?: number;
    credentialSubject: {
        id: string
    }
}

interface VcJWTPayload {
    sub: string;
    jti?: string;
    iss: string;
    iat: number;
    exp?: number;
    nbf?: number;
    nonce: string;
    vc: any;
}

export const vcToJwtPayload = (vcIn: VC): VcJWTPayload => {
    const vc = deepcopy(vcIn)

    const ret = {
        ...vc,
        iss: vc.issuer,
        nbf: vc.issuanceDate,
        iat: vc.issuanceDate,
        exp: vc.expirationDate,
        jti: vc.id,
        sub: vc.credentialSubject.id,
        nonce: base64url.encode(crypto.randomBytes(16)),
        vc: {
            ...vc.credentialSubject,
        }
    }

    delete ret.credentialSubject
    delete ret.vc.id
    delete ret.issuer
    delete ret.issuanceDate
    delete ret.expirationDate
    delete ret.id

    return ret
}

export const jwtPayloadToVc = (pIn: VcJWTPayload): VC => {
    const p = deepcopy(pIn)

    const ret ={
        ...p,
        issuer: p.iss,
        issuanceDate: p.nbf,
        expirationDate: p.exp,
        id: p.jti,
        credentialSubject: {
            ...(p.vc),
            id: p.sub
        }
    }

    delete ret.iss;
    delete ret.iat;
    delete ret.nbf;
    delete ret.exp;
    delete ret.jti;
    delete ret.sub;
    delete ret.nonce;
    delete ret.vc;

    return JSON.parse(JSON.stringify(ret))

}