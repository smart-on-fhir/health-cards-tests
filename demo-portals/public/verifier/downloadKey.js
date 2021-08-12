const secDownloadKey = (() => {

    const sec = new Section('downloadKey', "Download Issuer Public Key");
    sec.setDocs(verifierDocs.downloadKey.l, verifierDocs.downloadKey.r);
    sec.addTextField("Issuer Public KeySet");

    sec.process = async () => {

        const previousControl = secExtractPublicKey;
        const publicKeyUrl = previousControl.getValue(1);

        if (!publicKeyUrl) return;

        const url = 'download-public-key';
        let result = await restCall(url, { keyUrl: publicKeyUrl }, 'POST');

        sec.setErrors(result.error);

        await sec.setValue(JSON.stringify(result.keySet, null, 2));

    };

    sec.validate = async function(field) {
        const keySet = field.value;
        sec.setErrors((await restCall('/validate-key-set', { data: keySet }, 'POST')).errors);
        return sec.valid() ? await sec.goNext() : sec.next?.clear();
    }

    return sec;

})();

