import * as CredentialManager from '../src/CredentialManager'
import deepcopy from 'deepcopy'

const issuer = "did:test:0"
const subject = "did:test:1"

const idResource = {
    "resourceType": "Patient",
    "name": [{ "given": ["a"] }]
}

const clinicalResource = {
    "resourceType": "DiagnosticReport",
    "conclusion": "b"
}


describe('CredentialManager', () => {

    test('Does not alter inputs', () => {
        const asVc = CredentialManager.createVc("", [], issuer, subject, idResource, [clinicalResource])

        expect(asVc.issuer).toEqual(issuer)
        expect(asVc.credentialSubject.id).toEqual(subject)
        expect(asVc.credentialSubject.fhirBundle.entry).toHaveLength(2)

        expect(typeof asVc.issuanceDate).toBe('string')

        const patientUrl = asVc.credentialSubject.fhirBundle.entry[0].fullUrl
        const referenceToPatient = asVc.credentialSubject.fhirBundle.entry[1].resource.subject.reference
        expect(referenceToPatient).toEqual(patientUrl)
    })
         
    test('creates a VC from FHIR payloads', () => {
        const asVc = CredentialManager.createVc("", [], issuer, subject, idResource, [clinicalResource])


        expect(asVc.issuer).toEqual(issuer)
        expect(asVc.credentialSubject.id).toEqual(subject)
        expect(asVc.credentialSubject.fhirBundle.entry).toHaveLength(2)

        const patientUrl = asVc.credentialSubject.fhirBundle.entry[0].fullUrl
        const referenceToPatient = asVc.credentialSubject.fhirBundle.entry[1].resource.subject.reference
        expect(referenceToPatient).toEqual(patientUrl)
    })

    test('creates a JWT payload from a VC', () => {
        const asVc = CredentialManager.createVc("sample-context-type", ["sample-type-1", "sample-type-2"], issuer, subject, idResource, [clinicalResource])
        const asJwtPayload = CredentialManager.vcToJwtPayload(asVc) as any;

        expect(asJwtPayload.id).toBeUndefined()
        expect(asJwtPayload.issuer).toBeUndefined()
        expect(asJwtPayload.credentialSubject).toBeUndefined()
        expect(asJwtPayload.vc.id).toBeUndefined()
        expect(asJwtPayload.iss).toEqual(asVc.issuer)
        expect(asJwtPayload.vc.type).toHaveLength(3);
        expect(asJwtPayload.vc["@context"]).toBeDefined();

        expect(typeof asJwtPayload.iat).toBe('number')
        expect(asJwtPayload.iat).toEqual(CredentialManager.isoToNumericDate(asVc.issuanceDate))
        
        expect(typeof asJwtPayload.nbf).toBe('number')
        expect(asJwtPayload.nbf).toEqual(CredentialManager.isoToNumericDate(asVc.issuanceDate))

        expect(asJwtPayload.jti).toEqual(asVc.id)
        expect(asJwtPayload.vc.credentialSubject).toEqual({
            ...asVc.credentialSubject,
            id: undefined
        })
    })

    test('recovers a VC from JWT payload', () => {
        const asVc = CredentialManager.createVc("", [], issuer, subject, idResource, [clinicalResource])
        const asVcCloned = deepcopy(asVc)

        const asJwtPayload = CredentialManager.vcToJwtPayload(asVc) as any;
        const asVcAgain = CredentialManager.jwtPayloadToVc(asJwtPayload);

        expect(asVc).toEqual(asVcCloned)
        expect(asVcAgain).toEqual(asVc)
        
    })


    test('prints', ()=>{
        const x = require('../src/fixtures/vc.json')
        const asVc = CredentialManager.vcToJwtPayload(x)
        console.log(JSON.stringify(asVc, null, 2))
    })


});