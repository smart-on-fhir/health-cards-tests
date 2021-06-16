const secInitKey = (() => {

    const sec = new Section('initKeys');
    sec.setDocs(developerDocs.initKey.l, null);
    sec.addTextField("Paste private ES256 JWK Key here :");
    sec.fields[0].height.min = 400;

    sec.process = async function () {
    };

    sec.validate = async function (field) {

        if (!this.setErrors(validate.key(field.value))) {

            const key = JSON.parse(field.value);

            const kid = await computeKid(key);

            // set the kid in JWS-header
            if (typeof secHeader !== 'undefined')
                await secHeader.setValue(JSON.stringify({ "zip": "DEF", "alg": "ES256", "kid": key.kid }), 0);

            if (kid !== key.kid) this.setErrors([`"kid" should equal "${kid}".`]);
        }

        (this.valid() && secInitFhir.valid()) ? this.goNext() : this.next?.clear();
    }

    return sec;

})();