const secInitFhir = (() => {

    const sec = new Section('initFhir');
    
    sec.setDocs(developerDocs.initFhir.l, null);
    sec.addTextField("Paste FHIR Bundle JSON here :");
    sec.fields[0].height.min = 400;

    sec.process = async function () {};

    sec.validate = async function (field) {
        this.setErrors(await validate.fhirBundle(field.value));
        (sec.valid() && secInitKey.valid()) ? sec.goNext() : sec.next?.clear();
    }

    return sec;

})();