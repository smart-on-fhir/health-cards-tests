const secHeader = (() => {

    const sec = new Section('addHeader', "Add JWS Header");
    sec.setDocs(developerDocs.addHeader.l, developerDocs.addHeader.r);
    sec.addTextField("JWS Header");
    sec.addTextField("JWS Payload");

    sec.process = async function() {

        const payload = secDeflatePayload.getValue();
        if (!payload) return;

        const textHeader = tryParse(sec.getValue(0));
        if (!textHeader) return;

        const b64urlHeader = toBase64Url(btoa(JSON.stringify(textHeader)));
        await sec.setValue([b64urlHeader, payload].join('\n.\n'), 1);

    };

    sec.validate = async function(field) {

        const text = field.value;

        switch (field.index) {
            case 0: /* Header */
                this.setErrors(validate.jwsHeader(text), 0);
                break;
            case 1: /* JWS */
                const jwsRegEx = /^[0-9a-z-_]+\s*\.\s*[0-9a-z-_]+$/i;
                this.setErrors(jwsRegEx.test(text) ? [] : [`Invalid JWS. Expect ${jwsRegEx.toString()}`], 1);
                break;
        }

        this.valid() ? this.goNext() : this.next?.clear();
    }

    //
    // override the clear method to populate the header field with 'kid' computed from the Key Section field
    //
    sec.clear = async function() {
        Section.prototype.clear.call(this);
        if (secInitKey.valid()) {
            const kid = await computeKid(secInitKey.getValue());
            await this.setValue(JSON.stringify({ "zip": "DEF", "alg": "ES256", "kid": kid }), 0);
        }
    }

    return sec;

})();