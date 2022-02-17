const secInitFhir = (() => {

    const sec = new Section('initFhir');

    sec.setDocs(developerDocs.initFhir.l, null);
    sec.addTextField("Paste FHIR Bundle JSON here :");
    sec.fields[0].height.min = 400;
    sec.fields[0].value = ''; // triggers re-size

    sec.process = async function () { };

    sec.validate = async function (field) {
        const profile = document.getElementById('profile-select').value;

        const slow = profile === 'validator:fhirvalidator';

        // clear and disable all the child sections while we validate
        sec.next?.clear();
        this.disabled = true;
        secInitKey.disabled = true;
        this.next && (this.next.disabled = true);

        // display the progress meter 
        slow && sec.progress(true, 'HL7 FHIR Validator (slow)');

        // collect errors here, but set below since the controls are disabled
        const errors = await validate.fhirBundle(field.value, profile);

        // set the progress meter to 100
        slow && sec.progress(true, 'HL7 FHIR Validator (complete)', 100);

        // let the progress bar linger for another second at 100% before hidding it
        slow && setTimeout(() => {
            sec.progress(false, '', 0);
        }, 1000);

        // enable the sections that we previously disabled
        this.next && (this.next.disabled = false);
        secInitKey.disabled = false;
        this.disabled = false;

        this.setErrors(errors);

        (sec.valid() && secInitKey.valid()) ? await sec.goNext() : sec.next?.clear();
    }

    return sec;

})();