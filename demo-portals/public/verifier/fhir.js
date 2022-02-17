class FhirSection extends Section {

    constructor() {
        super("extractFhirBundle", "Extract FHIR Bundle");
        this.setDocs(verifierDocs.extractFhirBundle.l, verifierDocs.extractFhirBundle.r);
        this.addTextField("FHIR Bundle");
    }

    async process() {
        if (this.disabled) return;

        const jwsPayloadText = secDecodeJWS.getValue(1 /*payload*/);
        if (!jwsPayloadText) return;

        const jwsPayload = tryParse(jwsPayloadText);
        if (!jwsPayload) return;

        const fhirBundle = jwsPayload?.vc?.credentialSubject?.fhirBundle;
        if (!fhirBundle) return;

        await this.setValue(JSON.stringify(fhirBundle, null, 2));
    }

    async validate(field) {
        const profile = document.getElementById('profile-select').value;
        const slow = profile === 'validator:fhirvalidator';

        this.disabled = true;

        // display the progress meter 
        slow && this.progress(true, 'HL7 FHIR Validator (slow)');

        const errors = await validate.fhirBundle(field.value, profile);

        slow && this.progress(true, 'HL7 FHIR Validator (complete)', 100);

        // let the progress bar linger for another second at 100% before hidding it
        slow && setTimeout(() => {
            this.progress(false, '', 0);
        }, 1000);

        this.disabled = false;

        this.setErrors(errors);
    }
}

const secExtractFhirBundle = new FhirSection();
