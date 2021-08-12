const secCreateCredential = (() => {
    const sec = new Section('createCredential', 'Create Credential');
    sec.setDocs(developerDocs.createCredential.l, developerDocs.createCredential.r);
    sec.addTextField("Issuer URL");
    sec.addComboBox("Trusted Issuer Directory (leave empty to skip trusted directory check)", [['VCI', 'VCI directory'], ['test', 'Test directory (test issuers, including the one for the SMART Health Card specification examples)']]);
    sec.addTextField("Credential");


    const taUrl = sec.fields[0].textArea;
    taUrl.style.width = '50%';
    taUrl.style.display = 'inline-block';

    const parentDiv = taUrl.parentElement;
    parentDiv.style += "margin-bottom: -3px; position: relative;"

    // add the /.well-known/jwks.json label
    const span = document.createElement("SPAN");
    span.id = "span-issuer-label";
    span.innerText = '/.well-known/jwks.json';
    parentDiv.appendChild(span);


    sec.process = async function () {

        const fhir = tryParse(secInitFhir.getValue());
        if (!fhir) return;

        let issuer = this.getValue(0);

        // if we don't have a key, check the issuer textbox in the key help section
        if (!issuer) issuer = document.getElementById('textIssuer').value;

        // set the issuer field if we now have a key
        if (issuer) this.setValue(issuer);

        if (!issuer && this.getValue(2)) {
            this.setErrors([`Missing Issuer Key URL`]);
            return;
        }

        // override the valid() method on the 'trusted directory field'
        sec.fields[1].valid = function () {
            return !this.errors.some(err => err.level > 2);
        }

        const result = await restCall('/create-vc', { fhir: fhir, issuer: issuer });
        await sec.setValue(JSON.stringify(result, null, 2), 2);

    };

    sec.validate = async function (field) {

        const text = field.value;
        if (!text) { this.clearErrors(field.index); this.next?.clear(); return }

        switch (field.index) {
            case 0: // issuer
                this.setErrors(/^https:\/\//.test(text) ? [] : [`Issuer shall use https://`], 0);
                break;

            case 1: // trusted issuer
                const directory = this.getValue(1);
                const url = this.getValue(0);
                if (!url) return;
                directory && this.setErrors(await validate.checkTrustedDirectory(url, directory), 1);
                break;

            case 2: // payload
                this.setErrors(await validate.jwsPayload(text), 2);
                break;

        }

        sec.valid() ? await sec.goNext() : sec.next?.clear();
    }

    return sec;

})();