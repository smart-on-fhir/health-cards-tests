// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import pako from 'pako';
import got from 'got';
import path from 'path';
import {JWK, JWS} from 'node-jose';
import {qrChunksToJws} from './qr';
import {Bundle,toHealthCardData} from './fhir';

interface JWSPayload {
    "iss": string,
    "iat": number,
    "vc": {
        credentialSubject: {
            fhirBundle: FhirBundle
        }
    }
}
interface FhirBundle {
    text: string;
    Coding: {display: unknown};
    CodeableConcept: {text: unknown};
    meta: unknown;
    id: unknown;
    "resourceType": string,
    "type": string,
    "entry": BundleEntry[]
}
interface BundleEntry {
    id?: string,
    extension?: unknown[],
    modifierExtension?: unknown[],
    link?: string[],
    fullUrl?: string,
    resource: Resource,
    search?: unknown,
    request?: unknown,
    response?: unknown
}
type Resource = { resourceType: string } & Record<string, unknown>;

export type KeySet = {
    keys : JWK.Key[]
}

interface HealthCard {
    "verifiableCredential": string[]
}

function fhirBundleToValidationData() {

}

async function validateJWS(jws: string): Promise<ValidationResult> {
    let result: ValidationResult = {};

    if (!/[0-9a-zA-Z_-]+\.[0-9a-zA-Z_-]+\.[0-9a-zA-Z_-]+/g.test(jws.trim())) {
        throw "Invalid compact JWS";
    }

    // split into header[0], payload[1], key[2]
    const parts = jws.split('.');
    const rawPayload = parts[1];
    let inflatedPayload;
    try {
        inflatedPayload = pako.inflateRaw(Buffer.from(rawPayload, 'base64'), { to: 'string' });
    } catch (err) {
        throw "Invalid compact JWS";
    }
    
    let jwsPayload;
    try {
        jwsPayload = JSON.parse(inflatedPayload) as JWSPayload;
    } catch {
        throw "Invalid JWS payload";
    }
    if (!jwsPayload.iss || !jwsPayload.vc ||
        !jwsPayload.vc.credentialSubject ||
        !jwsPayload.vc.credentialSubject.fhirBundle) {
        throw "Invalid JWS payload";
    }

    const fhirBundle = JSON.stringify(jwsPayload.vc.credentialSubject.fhirBundle);
    if (fhirBundle) {
        result.fhirBundle = fhirBundle;
    }
    const cardData = toHealthCardData(JSON.parse(fhirBundle) as Bundle);
    if (cardData) {
        result.result = cardData;
    }

    // download the issuer key set
    let keySet;
    try {
        keySet = await got(path.join(jwsPayload.iss, '/.well-known/jwks.json')).json<KeySet>();
    } catch (err) {
        throw "Can't download issuer key: " + err;
    }

    // TODO: validate key, trusted key store, etc.
    const jwsVerifier = JWS.createVerify(JWK.asKeyStore(keySet));
    try {
    //    await jwsVerifier.verify(jws); FIXME: doesn't work!
    } catch (err) {
        throw "Invalid JWS: " + err;
    }

    return result;
}

export async function validateQRCodes(numericQrCodes: string[]): Promise<ValidationResult> {
    if (!numericQrCodes || numericQrCodes.length == 0) {
        return { error: "Invalid QR code" };
    }
    let jws;
    try {
        jws = qrChunksToJws(numericQrCodes);
    } catch (err) {
        return { error: "Invalid QR code: " + err};
    }
    if (!jws) {
        return { error: "Invalid QR code" + (numericQrCodes.length > 1 ? "s" : "") };
    }
    let result;
    try {
        result = await validateJWS(jws);
    } catch (err) {
        return {error: "Validation error: " + err};
    }
    return result;
}

export async function validateHealthCard(healthCard: any): Promise<ValidationResult> {
    let hcJson;
    try {
         hcJson = healthCard as HealthCard;
    } catch (err) {
        return { error: "Invalid SMART Health Card: " + err };
    }
    if (hcJson.verifiableCredential.length < 1) {
        return { error: "Invalid SMART Health Card" };
    }
    if (hcJson.verifiableCredential.length > 1) {
        return { error: "Can't support SMART Health Cards with multiple credentials" };
    }
    let result;
    try {
        result = await validateJWS(hcJson.verifiableCredential[0]);
    } catch (err) {
        return {error: "Validation error: " + err};
    }
    return result;
}
