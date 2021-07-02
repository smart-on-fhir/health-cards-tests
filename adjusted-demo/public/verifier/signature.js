const secVerifySignature = (() => {

    const sec = new Section('verifySignature', "Verify Signature");
    sec.setDocs(verifierDocs.verifySignature.l, verifierDocs.verifySignature.r);
    sec.addTextField("Validation Result");
    sec.fields[0].textArea.readOnly = true;

    sec.process = async function () {

        let data = secDecodeNumeric.getValue().replace(/\s*\.\s*/g, '.').split('.');
        if (!data) return;

        let signature = secDecodeJWS.getValue(2 /*signature*/);
        if (!signature) return;

        if (!secDecodeJWS.fields[2].valid()) return sec.setErrors(["JWS/Signature not valid"]);;

        data.pop(); // removes the signature segment leaving header.payload
        data = data.join('.');
        const enc = new TextEncoder();
        data = enc.encode(data);

        signature = decodeBase64Url(signature);
        signature = signature.split('').map(c => c.charCodeAt(0));
        signature = new Uint8Array(signature);

        let key = selectKey();

        if (!key) return;

        await window.crypto.subtle.importKey("jwk", key, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"])
            .then(
                function (publicKey) {
                    return window.crypto.subtle.verify({ name: "ECDSA", hash: { name: "SHA-256" } }, publicKey, signature, data);
                },
                function (err) { /* catch */
                    sec.setErrors([`Error importing key. name:'${err.name}' message:'${err.message}' code:'${err.code}'`])
                    return Promise.reject(null);
                }
            )
            .then(
                async function (validationResult) {
                    validationResult ? sec.clearErrors() : sec.setErrors(["Signature Verification Failed"]);
                    await sec.setValue(validationResult.toString());
                },
                function (err) { /* catch */
                    if (err === null) return; /* error already handled */
                    sec.setErrors([`Error verifying signature. name:'${err.name}' message:'${err.message}' code:'${err.code}'`])
                }
            );

    };

    sec.validate = async function (field) {
        sec.valid() ? sec.goNext() : sec.next?.clear();
    }


    //
    // Select the first key in the key collection where 'kid' equals the 'kid' in the Jws-Header
    //
    function selectKey() {

        let keySet = secDownloadKey.getValue();
        keySet = tryParse(keySet)

        if (!keySet) {
            sec.clear();
            sec.setErrors(["Cannot parse KeySet"]);
            return;
        };

        let jwsHeader = secDecodeJWS.getValue(0 /*header*/);
        jwsHeader = tryParse(jwsHeader);

        if (!jwsHeader) {
            sec.clear();
            sec.setErrors(["Cannot parse JWS header"]);
            return;
        };

        for (let i = 0; i < keySet.keys.length; i++) {
            const key = keySet.keys[i];
            delete key["alg"];
            if (key.kid.toUpperCase() === jwsHeader.kid.toUpperCase()) {
                return key;
            }
        }

        sec.clear();
        sec.setErrors(["Cannot find key with matching \'kid\'."]);

        return null;
    }

    return sec;

})();
