const secExtractPublicKey = (() => {

    const sec = new Section('extractPublicKey', "Extract Public Key URL");
    sec.setDocs(verifierDocs.extractPublicKey.l, verifierDocs.extractPublicKey.r);
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

        // document.getElementById('keyDataExtract').innerHTML = (jwsPayload.iss + '/.well-known/jwks.json');
        document.getElementById('keyDataExtract').value = (jwsPayload.iss + '/.well-known/jwks.json');
        window.validateCode('keyDataExtract');
        await sec.setValue(jwsPayload.iss + '/.well-known/jwks.json');

    };

    sec.validate = async function (field) {
        this.setErrors(/^https:\/\//.test(field.value) ? [] : [`Issuer shall use https://`]);
        sec.valid() ? sec.goNext() : sec.next?.clear();
    }

    return sec;

})();
