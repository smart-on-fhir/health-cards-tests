const secDecodeNumeric = (() => {

    const sec = new Section('decodeNumeric', "Decode Numeric");
    sec.setDocs(verifierDocs.decodeNumeric.l, verifierDocs.decodeNumeric.r);
    sec.addTextField("Compact JSON Web Signature (JWS)");

    sec.process = async function () {

        const numericEncoded = secScanQr.getValue();

        if (!numericEncoded) return;

        const b64Offset = '-'.charCodeAt(0);
        const digitPairs = numericEncoded.match(/(\d\d?)/g) || [];

        const jws = digitPairs
            // for each number in array, add an offset and convert to a char in the base64 range
            .map((c) => String.fromCharCode(Number.parseInt(c) + b64Offset))
            // merge the array into a single base64 string
            .join('');

        await sec.setValue(jws.split('.').join('\n.\n'));

    };

    sec.validate = async function (field) {
        const jws = field.value.replace(/\s*\.\s*/g, '.');
        this.setErrors(validate.jws(jws));
        this.valid() ? this.goNext() : this.next?.clear();
    }

    return sec;

})();
