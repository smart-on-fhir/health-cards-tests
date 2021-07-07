const secDecodeJWS = (() => {

    const sec = new Section('decodeJWS', "Decode Compact-JWS");
    sec.setDocs(verifierDocs.decodeJWS.l, verifierDocs.decodeJWS.r);
    sec.addTextField("JWS Header");
    sec.addTextField("JWS Payload");
    sec.addTextField("JWS Signature");

    sec.process = async function () {

        const numericEncoded = secDecodeNumeric.getValue();
        if (!numericEncoded) return;

        const jws = numericEncoded.replace(/\s*\.\s*/g, '.');

        const parts = jws.split('.');
        if (parts.length !== 3) return;

        try {
            await sec.setValue(decodeBase64Url(parts[0]), 0 /*header*/);
        } catch { return; }

        let url = '/inflate-payload';
        const inflatedPayload = await restCall(url, { payload: parts[1] }, 'POST', "text");
        await sec.setValue(inflatedPayload, 1 /*payload*/);

        await sec.setValue(parts[2], 2 /*signature*/);

    };


    sec.validate = async function (field) {

        const text = field.value;
        if (!text) { this.clearErrors(field.index); this.next?.clear(); return }

        switch (field.index) {
            case 0: // header
                this.setErrors(validate.jwsHeader(text), 0);
                break;

            case 1: // payload
                this.setErrors(await validate.jwsPayload(text), 1);
                break;

            case 2: // signature
                this.setErrors(validate.jwsSignature(text), 2);
                break;
        }

        sec.valid() ? sec.goNext() : sec.next?.clear();
    }

    return sec;

})();
