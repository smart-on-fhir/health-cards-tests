const secCreateCredential = (() => {
    const sec = new Section('createCredential', 'Create Credential');
    sec.setDocs(developerDocs.createCredential.l, developerDocs.createCredential.r);
    sec.addTextField("Issuer URL");
    sec.addTextField("Credential");
    sec.fields[0].textArea.style.width = '50%';

    // add the /.well-known/jwks.json label
    const span = document.createElement("SPAN");
    span.id = "span-issuer-label";
    span.innerText = '/.well-known/jwks.json';
    sec.fields[0].textArea.parentElement.appendChild(span);
    sec.fields[0].textArea.parentElement.style.position = 'relative';

    sec.process = async function () {

        const fhir = tryParse(secInitFhir.getValue());
        if (!fhir) return;

        let issuer = this.getValue(0);

        // if we don't have a key, check the issuer textbox in the key help section
        if (!issuer) issuer = document.getElementById('textIssuer').value;

        // set the issuer field if we now have a key
        if(issuer) this.setValue(issuer);

        if (!issuer && this.getValue(1)) {
            this.setErrors([`Missing Issuer Key URL`]);
            return;
        } 

        const result = await restCall('/create-vc', { fhir: fhir, issuer: issuer });
        await sec.setValue(JSON.stringify(result, null, 2), 1);

    };

    sec.validate = async function (field) {

        const text = field.value;
        if (!text) { this.clearErrors(field.index); this.next?.clear(); return }

        switch (field.index) {
            case 0: // issuer
                this.setErrors(/^https:\/\//.test(text) ? [] : [`Issuer shall use https://`], 0);
                break;

            case 1: // payload
                this.setErrors(await validate.jwsPayload(text), 1);
                break;

        }

        sec.valid() ? sec.goNext() : sec.next?.clear();
    }

    return sec;

})();