const secSignPayload = (() => {
    const sec = new Section('signPayload', 'Sign Payload');
    sec.setDocs(developerDocs.signPayload.l, developerDocs.signPayload.r);
    sec.addTextField("Signed Payload");

    sec.process = async function () {

        const payload = secDeflatePayload.getValue();
        if (!payload) return;

        const key = tryParse(secInitKey.getValue());
        if (!key) return;

        const result = await restCall('/sign-payload', { payload: payload, key: key }, 'POST', 'text');
        await sec.setValue(result.split('.').join('\n.\n'));

    };

    sec.validate = async function (field) {
        this.setErrors(validate.jws(field.value));
        sec.valid() ? sec.goNext() : sec.next?.clear();
    }

    return sec;

})();