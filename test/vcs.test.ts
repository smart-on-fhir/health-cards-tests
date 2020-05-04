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

    test('Does not alter inpupts', () => {
        const asVc = CredentialManager.createVc(issuer, subject, idResource, [clinicalResource])

        expect(asVc.issuer).toEqual(issuer)
        expect(asVc.credentialSubject.id).toEqual(subject)
        expect(asVc.credentialSubject.fhirBundle.entry).toHaveLength(2)

        const patientUrl = asVc.credentialSubject.fhirBundle.entry[0].fullUrl
        const referenceToPatient = asVc.credentialSubject.fhirBundle.entry[1].resource.subject.reference
        expect(referenceToPatient).toEqual(patientUrl)
    })
         
    test('creates a VC from FHIR payloads', () => {
        const asVc = CredentialManager.createVc(issuer, subject, idResource, [clinicalResource])

        expect(asVc.issuer).toEqual(issuer)
        expect(asVc.credentialSubject.id).toEqual(subject)
        expect(asVc.credentialSubject.fhirBundle.entry).toHaveLength(2)

        const patientUrl = asVc.credentialSubject.fhirBundle.entry[0].fullUrl
        const referenceToPatient = asVc.credentialSubject.fhirBundle.entry[1].resource.subject.reference
        expect(referenceToPatient).toEqual(patientUrl)
    })

    test('creates a JWT payload from a VC', () => {
        const asVc = CredentialManager.createVc(issuer, subject, idResource, [clinicalResource])
        const asJwtPayload = CredentialManager.vcToJwtPayload(asVc) as any;

        expect(asJwtPayload.id).toBeUndefined()
        expect(asJwtPayload.issuer).toBeUndefined()
        expect(asJwtPayload.credentialSubject).toBeUndefined()
        expect(asJwtPayload.vc.id).toBeUndefined()
        expect(asJwtPayload.iss).toEqual(asVc.issuer)
        expect(asJwtPayload.iat).toEqual(asVc.issuanceDate)
        expect(asJwtPayload.nbf).toEqual(asVc.issuanceDate)
        expect(asJwtPayload.jti).toEqual(asVc.id)
        expect(asJwtPayload.vc).toEqual({
            ...asVc.credentialSubject,
            id: undefined
        })
    })

    test('recovers a VC from JWT payload', () => {
        const asVc = CredentialManager.createVc(issuer, subject, idResource, [clinicalResource])
        const asVcCloned = deepcopy(asVc)

        const asJwtPayload = CredentialManager.vcToJwtPayload(asVc) as any;
        const asVcAgain = CredentialManager.jwtPayloadToVc(asJwtPayload);

        expect(asVc).toEqual(asVcCloned)
        expect(asVcAgain).toEqual(asVc)

    })


});