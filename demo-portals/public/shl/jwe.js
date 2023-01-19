import * as utils from '../utils2.js';
import * as validate from '../validate2.js'
import encryptedFiles from './encrypted.js'


const sec = document.getElementById('jwe');
let initialize = false;

encryptedFiles.addEventListener('valid', () => {
    sec.initialize();
    initialize = true;
});

encryptedFiles.addEventListener('invalid', () => {
    sec.clear();
    initialize = false;
});

function isValid(field) {

    const vc = utils.tryParse(field.value);
    if (!vc) {
        field.errors = ['Not valid JSON'];
        field.button.disabled = true;
        return false;
    }

    if (!vc.verifiableCredential) {
        field.errors = ["'verifiableCredential' not found"];
        return false;
    }

    if (!(vc.verifiableCredential instanceof Array)) {
        field.errors = ["'verifiableCredential' is not an Array"];
        return false;
    }

    if (vc.verifiableCredential.length === 0) {
        field.errors = ["'verifiableCredential' is empty"];
        return false;
    }

    if (vc.verifiableCredential.length > 1) {
        field.errors = [{ message: "'verifiableCredential' contains more than one entry", code: 100, level: 2 }];
    }

    const result = validate.jws(vc.verifiableCredential[0]);
    if (result.length) {
        field.errors = result;
        return false;
    }

    field.button.disabled = false;
    return true;

}

sec.initialize = async function () {

    sec.clear();

    const { key, files } = encryptedFiles.value;

    // add new fields for each file
    for (let i = 1; i < files.length; i++) {
        const f = sec.addTextField(`Decrypted File ${i + 1}`);
        f.label = true;
    }

    // add button that posts the jwe string to the verifier portal
    sec.fields.forEach((f,i) => {
        if (f.children.length) return;

        // create a button element that navigates to the SHC verifier page with the data as a query-string
        const button = document.createElement("INPUT");
        button.setAttribute("type", "button");
        button.value = "Validate";
        button.id = `button${i}`;
        button.style.width = "150px"
        button.addEventListener('click', function () {
            window.open(`VerifierPortal.html?jws=${JSON.parse(this.value).verifiableCredential[0]}`, '_blank');
        }.bind(f));

        // append the button to the field
        f.appendChild(button);

        // add the button to a new button property on the field - this will make it simple to lookup later
        f.button = button;

        // assign the validation function to this new field
        f.valid = isValid;
    });

    for (let i = 0; i < files.length; i++) {
        utils.restCall('/validate-jwe', { data: files[i], key: key }, 'POST')
            .then((function (result) {

                if (result.data) {
                    sec.fields[this.i].value = result.data;
                } else {
                    sec.fields[this.i].value = `Decryption failed for file ${i + 1}. Check the key.`
                    sec.fields[this.i].errors = result.errors;
                }

            }).bind({ i }));
    }

};

sec.update = async function (field) {
    return this.fields.every(f => f.valid);
}

// override the clear method to remove the additional Section-Fields
sec.clear = (section) => {
    for (let i = section.fields.length - 1; i > 0; i--) {
        section.removeTextField(section.fields[i]);
    }
    if (section.fields[0].button) {
        section.fields[0].removeChild(section.fields[0].button)
        delete section.fields[0].button;
    }
    section.fields[0].clear();
    section.errors = [];
    return false;
}

export default sec;
