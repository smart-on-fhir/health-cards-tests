const secSmartHealthCard = (() => {

    const sec = new Section('smartHealthCard', 'SMART Health Card');
    sec.setDocs(developerDocs.smartHealthCard.l);
    sec.addTextField("SMART Health Card");

    sec.process = async function() {
        const vcText = secSignPayload.getValue().replace(/\s*\.\s*/g, '.');
        if (!vcText) return;
        const result = await restCall('/smart-health-card', { jws: vcText });
        await sec.setValue(JSON.stringify(result, null, 2));
    };

    sec.validate = async function(field) {
        this.setErrors(await validate.healthCard(field.value));
        this.valid() ? this.goNext() : this.next?.clear();
    }

    return sec;

})();