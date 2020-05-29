import base64url from 'base64url';
import cbor from 'cbor';
import csvParse from 'csv-parse/lib/sync';
import fs from 'fs';
import vc from '../fixtures/vc.pcr.json';


const codesCsv = fs.readFileSync(__dirname + '/Loinc_Sarscov2_Export_20200529.csv')
const codes = csvParse(codesCsv)
    .map(([LOINC_NUM, Component, Property, Time_Aspct, System, Scale_Typ, Method_Typ, Class, ClassType, LongCommonName, Shortname, External_Copyright_Notice, Status, VersionFirstReleased, VersionLastChanged]) => ({
        LOINC_NUM, Component, Property, Time_Aspct, System, Scale_Typ, Method_Typ, Class, ClassType, LongCommonName, Shortname, External_Copyright_Notice, Status, VersionFirstReleased, VersionLastChanged
    }))

const fhirBundle: any = vc.credentialSubject.fhirBundle

const pcrTestCodes: string[] = codes
    .filter(t => t.Component.startsWith('SARS coronavirus 2'))
    .filter(t => t.Method_Typ.match('.amp.tar'))
    .filter(t => t.Scale_Typ.match('Ord'))
    .map(t => t.LOINC_NUM)

console.log("LOINC PCR Tests in DB", pcrTestCodes)

const pcrResultCodesPositve = ['LA6576-8', 'LA11882-0']
const pcrResultCodesNegative = ['LA6577-6', 'LA11883-8']

enum PcrStatus {
    negative = 0,
    positive = 1,
    other = 2
}

enum IdentityProofing {
    P2 = 2,
    P1 = 1,
    P0 = 0
}

const hasCodeFrom = (codes) => (cc) => (cc.coding || [] as { code: string }[])
    .filter(c => codes.includes(c.code))
    .length > 0

const patient = fhirBundle.entry.map(e => e.resource).filter(r => r.resourceType === 'Patient')[0]

const output = {
    alg: "healthwallet.cards#summarize-pcr.v0",
    pt: {
        name: patient.name.map(n => 
            [n.prefix || ""]
            .concat(n.given)
            .concat(n.family)
            .concat([n.suffix || ""])
            .filter(n => n).join(" ")
       ),
        phone: patient.telecom
            .filter(p => p.system === 'phone')
            .map(p => p.value),
        ial: patient
            .extension
            .filter(e => e.url === "https://github.com/TransparentHealth/800-63-3-trustmark#P")
            .map(e => {
                switch (e.valueCode) {
                    case "P2": return IdentityProofing.P2;
                    case "P1": return IdentityProofing.P1;
                    default: return IdentityProofing.P0;
                }
            })[0],
    },
    result: fhirBundle
        .entry
        .map(e => e.resource)
        .filter(r => r.resourceType === 'Observation')
        .filter(r => hasCodeFrom(pcrTestCodes)(r.code))
        .map(r => {
            const positive = hasCodeFrom(pcrResultCodesPositve)(r.valueCodeableConcept)
            const negative = hasCodeFrom(pcrResultCodesNegative)(r.valueCodeableConcept)

            let pcrStatus = PcrStatus.other
            if (positive) {
                pcrStatus = PcrStatus.positive
            } else if (negative) {
                pcrStatus = PcrStatus.negative
            }

            return {
                effective: r.effectiveDateTime,
                pcrStatus
            }
        })
}

console.log("FHIR Bundle size", JSON.stringify(fhirBundle).length, "\n")

console.log("Summary JSON", output, "\n")
console.log("Summary JSON size",  JSON.stringify(output).length)

const e: Buffer = cbor.encode(output)
console.log("Summary CBOR", e)
console.log("Summary CBOR size", e.length)