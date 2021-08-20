const secExtractPublicKey = (() => {

    const sec = new Section('extractPublicKey', "Extract Public Key URL");
    sec.setDocs(verifierDocs.extractPublicKey.l, verifierDocs.extractPublicKey.r);
    sec.addComboBox("Trusted Issuer Directory (leave empty to skip trusted directory check)", [['', '-- none --  (no issuer validation)'], ['VCI', 'VCI directory'], ['test', 'Test directory (test issuers, including the one for the SMART Health Card specification examples)']]);
    sec.addTextField("Issuer Key URL");

    sec.process = async () => {

        const jwsPayloadText = secDecodeJWS.getValue(1 /*jws-payload*/);;
        const jwsPayload = tryParse(jwsPayloadText);

        if (jwsPayload === undefined) {
            return;
        }

        if (jwsPayload.iss === undefined) {
            sec.setErrors([secError("Cannot find .iss property")]);;
            return;
        }

        sec.fields[0].options.emptyIsValid = true;

        // override the valid() method on the 'trusted directory field'
        sec.fields[0].valid = function() {
            return !this.errors.some(err => err.level > 2);
        }

        sec.setValue('', 0);

        await sec.setValue(jwsPayload.iss + '/.well-known/jwks.json', 1 /* url */);

    };

    sec.validate = async function (field) {

        const url = this.fields[1].value.replace('/.well-known/jwks.json', '');
        if (!url) return;

        this.setErrors(/^https:\/\//.test(this.fields[1].value) ? [] : [`Issuer shall use https://`], 1);

        const directory = this.fields[0].value;
        directory && this.setErrors(await validate.checkTrustedDirectory(url, directory), 0);

        sec.valid() ? await sec.goNext() : sec.next?.clear();
    }

    return sec;

})();

