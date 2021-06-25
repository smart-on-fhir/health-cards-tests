const secInitFhir = (() => {

    const sec = new Section('initFhir');
    
    sec.setDocs(developerDocs.initFhir.l, null);
    sec.addTextField("Paste FHIR Bundle JSON here :");
    sec.fields[0].height.min = 400;
    sec.fields[0].value = ''; // triggers re-size

    sec.process = async function () {};

    sec.validate = async function (field) {
        const profile = document.getElementById('profile-select').value;
        this.setErrors(await validate.fhirBundle(field.value, profile));
        (sec.valid() && secInitKey.valid()) ? sec.goNext() : sec.next?.clear();
    }

    return sec;

})();