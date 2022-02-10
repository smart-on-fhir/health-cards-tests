const secDecodeJWS = (() => {

    const sec = new Section('decodeJWS', "Decode Compact-JWS");
    sec.setDocs(verifierDocs.decodeJWS.l, verifierDocs.decodeJWS.r);
    sec.addTextField("JWS Header");
    sec.addTextField("JWS Payload");
    sec.addTextField("JWS Signature");

    sec.process = async function () {

        if (this.disabled) return;

        const numericEncoded = secDecodeNumeric.getValue();
        if (!numericEncoded) return;

        const jws = numericEncoded.replace(/\s*\.\s*/g, '.');

        const parts = jws.split('.');
        if (parts.length !== 3) return;

        try {
            await sec.setValue(decodeBase64Url(parts[0]), 0 /*header*/, false);
        } catch { return; }

        let url = '/inflate-payload';
        const inflatedPayload = await restCall(url, { payload: parts[1] }, 'POST', "text");

        if (inflatedPayload === undefined) {
            this.setErrors('Failed to inflate payload');
            return;
        }

        await sec.setValue(inflatedPayload, 1 /*payload*/, false);

        await sec.setValue(parts[2], 2 /*signature*/, false);

        // the validator only checks the updated field, we'll do this to make it check all the fields
        // we skipped validation for all three fields above and need this hack to check all 3 at once.
        // TODO: refactor to not need this hack
        this.validate({ value: 'hack', index: 4 });
    };


    sec.validate = async function (field) {

        // clearing one of the 3 fields removes the errors and clears the child sections
        const text = field.value;
        if (!text) { this.clearErrors(field.index); this.next?.clear(); return }

        switch (field.index) {
            case 0: // header
                this.setErrors(validate.jwsHeader(sec.fields[0].value), 0);
                break;

            case 1: // payload
                if (tryParse(sec.fields[1].value) === undefined) {
                    this.setErrors(['Payload is not valid JSON'], 1);
                    break;
                }
                const errors = await validate.jwsPayload(sec.fields[1].value);
                this.setErrors(errors, 1);
                break;

            case 2: // signature
                this.setErrors(validate.jwsSignature(sec.fields[2].value), 2);
                break;

            // if not checking a single field, check all 3 of them
            default:
                this.setErrors(validate.jwsHeader(sec.fields[0].value), 0);
                if( sec.fields[1].value === '') {
                    this.setErrors(['Failed to INFLATE payload'], 1);
                    break;
                }
                else if (tryParse(sec.fields[1].value) === undefined) {
                    this.setErrors(['Payload is not valid JSON'], 1);
                    break;
                } else {
                    this.setErrors(await validate.jwsPayload(sec.fields[1].value), 1);
                }
                this.setErrors(validate.jwsSignature(sec.fields[2].value), 2)
        }

        return sec.valid() ? await sec.goNext() : sec.next?.clear();
    }

    return sec;

})();




