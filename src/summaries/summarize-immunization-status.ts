import base64url from 'base64url';
import cbor from 'cbor';
import csvParse from 'csv-parse/lib/sync';
import fs from 'fs';
import vcExample from '../fixtures/vc-covid-immunization.json';
import jsonschema from 'jsonschema';
import schema from './summarize-immunization-status.schema.json'
import { generateEncryptionKey, generateSigningKey } from '../keys';
import { generateDid } from '../dids';

var Validator = jsonschema.Validator;
var v = new Validator();

const vc = vcExample.vc;
const fhirBundle: any = vc.credentialSubject.fhirBundle

const CVX = 'http://hl7.org/fhir/sid/cvx';
const MODERNA = '207';

const modernaImmunizations: [any] = fhirBundle.entry
    .map(e => e.resource)
    .filter(r => r.resourceType === 'Immunization')
    .filter(r => r.vaccineCode.coding.filter(c => c.system === CVX && c.code === MODERNA).length > 0)
    .sort((i1, i2) => new Date(i2.date).getTime() - new Date(i1.date).getTime());

enum ImmunizationStatus {
    Never = 0,
    Partial = 1,
    Full = 2
}

enum IdentityProofing {
    P2 = 2,
    P1 = 1,
    P0 = 0
}

const patient = fhirBundle.entry.map(e => e.resource).filter(r => r.resourceType === 'Patient')[0]
const output = {
    alg: "#c19-immunization-status",
    ver: "0.0.1",
    ptName: patient.name.map(n =>
        [n.prefix || ""]
            .concat(n.given)
            .concat(n.family)
            .concat([n.suffix || ""])
            .filter(n => n).join(" "))
    [0],
    ptPhone: patient.telecom
        .filter(p => p.system === 'phone')
        .map(p => p.value)
    [0],
    ial: patient
        .extension
        .filter(e => e.url === "https://github.com/TransparentHealth/800-63-3-trustmark#P")
        .map(e => {
            switch (e.valueCode) {
                case "P2": return IdentityProofing.P2;
                case "P1": return IdentityProofing.P1;
                default: return IdentityProofing.P0;
            }
        })
    [0],
    result: [{
        effective: modernaImmunizations[0].date,
        status: modernaImmunizations.length
    }]
}



async function summarize() {
    // TODO remove the "as" when fix for https://github.com/tdegrunt/jsonschema/issues/315 is released
    if (!v.validate(output, schema as unknown as jsonschema.Schema).valid) {
        console.log("Invalid!");
        console.log(v.validate(output, schema as unknown as jsonschema.Schema));
        process.exit(1);
    }

    console.log("FHIR Bundle size", JSON.stringify(fhirBundle).length, "\n")

    console.log("Summary JSON", output, "\n")
    console.log("Summary JSON size", JSON.stringify(output).length)

    const e: Buffer = cbor.encode(output)
    console.log("Summary CBOR", e)
    console.log("Summary CBOR size", e.length)

    const ek = await generateEncryptionKey();
    const sk = await generateSigningKey();
    const uk = await generateSigningKey();
    const rk = await generateSigningKey();
    const did = await generateDid({
        encryptionPublicJwk: ek.publicJwk,
        signingPublicJwk: sk.publicJwk,
        recoveryPublicJwk: rk.publicJwk,
        updatePublicJwk: uk.publicJwk
    });
 
    let k = await generateSigningKey();
    let vcContents = {
        "iss": did.didShort,
        "iat": Math.floor(new Date().getTime()/1000),
        "vc": {
            "credentialSubject": {
                ...output
            }
        }
    }

    let signed = await k.sign({kid: "#signing-key-1"}, vcContents);
    console.log("Signed", signed.length, signed);
}

summarize();
