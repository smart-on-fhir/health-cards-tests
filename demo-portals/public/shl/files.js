import * as utils from '../utils2.js';
import manifest from './manifest.js'


const sec = document.getElementById('manifestFiles');
let initialized = false;

manifest.addEventListener('valid', async () => {
    await sec.initialize();
    initialized = true;
});

manifest.addEventListener('invalid', () => {
    sec.clear();
    initialized = false;
});


async function fileValid(field) {

    const value = field.value.trim();

    // if the section is not ready and the field is empty, fail without error
    if (!initialized && value === '') {
        field.errors = [];
        return false;
    }

    if (!utils.tryParse(value)) {
        field.errors = ['Not valid JSON'];
        return false;
    }

    const result = await utils.restCall('/validate-shl-manifest-file', { data: value }, 'POST');
    field.errors = result.errors;
    return !field.errors.length;
}

sec.initialize = async function () {

    sec.clear();

    const files = manifest.value;
    if (!files) return;

    // add a new Section-Field for each file in the manifest (in addition to the 1 Section-Field we start with)
    for (let i = 1; i < files.length; i++) {
        const f = sec.fields.add(`File ${i + 1}`);
        f.label = true;
    }

    // for each Section-Field, assign the validation function and set it's value
    for (let i = 0; i < files.length; i++) {
        sec.fields[i].valid = fileValid;
        sec.fields[i].value = JSON.stringify(files[i], null, 2);
    }

};

sec.update = async function (field) {
    return sec.fields.every(f => f.valid);
}

// set the value of this section to be an array of manifest-file objects
sec.value = (section) => {
    return section.fields.map(f => utils.tryParse(f.value));
}

// override the clear method to remove the additional Section-Fields
sec.clear = (section) => {
    for (let i = section.fields.length - 1; i > 0; i--) {
        section.removeTextField(section.fields[i]);
    }
    section.fields[0].clear();
    section.errors = [];
    return false;
}

export default sec;
