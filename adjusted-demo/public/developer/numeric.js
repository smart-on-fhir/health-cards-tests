const secNumericEncode = (() => {
    const sec = new Section('numericEncode', 'Numeric Encode');
    sec.setDocs(developerDocs.numericEncode.l, developerDocs.numericEncode.r);
    sec.addTextField("Numeric Encoding");

    sec.process = async function () {

        sec.clear();

        const jws = tryParse(secSmartHealthCard.getValue())?.verifiableCredential?.[0].replace(/\s*\.\s*/g, '.');
        if (!jws) return;

        const result = await restCall('/numeric-encode', { jws: jws }, 'POST');
        await sec.setValue(result[0]);

        for (let i = 1; i < result.length; i++) {
            sec.addTextField(`Numeric Encoding ${i}`);
            await sec.setValue(result[i], i);
        }

    };

    sec.validate = async function (field) {
        this.setErrors(await validate.numeric(this.fields.map(f => f.value)));
        this.valid() ? this.goNext() : this.next.clear();
    }

    //
    // override the getValue method to return combined numeric data
    //
    sec.getValue = function () {
        const shc = [];
        for (let i = 0; i < sec.fields.length; i++) {
            shc.push(sec.fields[i].value);
        }
        return shc;
    }

    //
    // override the clear method to remove multi-part fields
    //
    sec.clear = async function () {
        Section.prototype.clear.call(this);
        this.resetTextFields();
    }

    return sec;

})();
