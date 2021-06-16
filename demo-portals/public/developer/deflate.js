const secDeflatePayload = (() => {
    
    const sec = new Section('deflatePayload', 'Deflate Payload');
    sec.setDocs(developerDocs.deflatePayload.l, developerDocs.deflatePayload.r);
    sec.addTextField("Deflated Payload");

    sec.process = async function () {
        const minimizedCredential = tryParse(secMinimizePayload.getValue());
        if (!minimizedCredential) return;

        const result = await restCall('/deflate-payload', { vc: minimizedCredential }, 'POST', "arraybuffer");
        await sec.setValue(arrayBufferToBase64url(result));
    };

    sec.validate = async function (field) {
        this.setErrors(await validate.base64Url(field.value));
        this.valid() ? this.goNext() : this.next?.clear();
    }

    return sec;

})();