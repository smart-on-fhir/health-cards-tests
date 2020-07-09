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
    const vc: VC = deepcopy(sampleVc);

    vc.issuanceDate = new Date(vc.issuanceDate).toISOString()

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
    issuanceDate?: string;
    expirationDate?: string;
    credentialSubject: {
        id: string,
        fhirBundle: any
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

export const isoToNumericDate = (isoDate: string): number => new Date(isoDate).getTime() / 1000
export const numericToIsoDate = (numericDate: number): string => new Date(numericDate*1000).toISOString()

export const vcToJwtPayload = (vcIn: VC): VcJWTPayload => {
    const vc = deepcopy(vcIn) as VC

    const ret: VcJWTPayload = {
        ...vc,
        iss: vc.issuer,
        nbf: isoToNumericDate( vc.issuanceDate),
        iat: isoToNumericDate(vc.issuanceDate),
        jti: vc.id,
        sub: vc.credentialSubject.id,
        nonce: base64url.encode(crypto.randomBytes(16)),
        vc: {
            ...vc.credentialSubject,
        }
    }

    if (vc.expirationDate){
        ret.exp = isoToNumericDate(vc.expirationDate);
    }

    delete ret["credentialSubject"]
    delete ret.vc["id"]
    delete ret["issuer"]
    delete ret["issuanceDate"]
    delete ret["expirationDate"]
    delete ret["id"]

    return ret
}

export const jwtPayloadToVc = (pIn: VcJWTPayload): VC => {
    const p = deepcopy(pIn)

    const ret ={
        ...p,
        issuer: p.iss,
        issuanceDate: numericToIsoDate(p.nbf),
        id: p.jti,
        credentialSubject: {
            ...(p.vc),
            id: p.sub
        }
    }
    if (p.exp) {
        ret.expirationDate = numericToIsoDate(p.exp)
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