const secMinimizePayload = (() => {

    const sec = new Section('minimizePayload', 'Minify Payload');
    sec.setDocs(developerDocs.minimizePayload.l);
    sec.addTextField("Payload");

    sec.process = async function () {
        const credential = tryParse(secCreateCredential.getValue(1));
        if (!credential) return;
        await sec.setValue(JSON.stringify(credential));
    };

    sec.validate = async function (field) {
        this.setErrors(await validate.minified(field.value));
        sec.valid() ? sec.goNext() : sec.next?.clear();
    }

    return sec;

})();