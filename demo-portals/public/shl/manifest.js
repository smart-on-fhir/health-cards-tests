import * as utils from '../utils2.js';
import parameters from './parameters.js'

const sec = document.getElementById('manifest2');
const field = sec.fields[0];
let initialized = false;

parameters.addEventListener('valid', () => {
    initialized = true;
    sec.clear();
    sec.initialize();
});

parameters.addEventListener('invalid', () => {
    sec.clear();
    initialized = false;
});

field.valid = (field) => {
    if (!initialized && field.value.trim() === '') return true;
    if (utils.tryParse(field.value)) return true;
    field.errors = ['Not valid JSON'];
    return false;
}

sec.initialize = async function () {

    const result = await utils.restCall('/download-shl-manifest', parameters.value, { cache: false });
    //TODO: returns null if invalid url

    if (result.errors.length) {
        sec.setErrors(result.errors);
        return false;
    } else {
        sec.errors = [];
    }

    // format the JSON
    field.value = JSON.stringify(JSON.parse(result.manifest), null, 2);

    return true;
};

sec.update = async function (field) {
    if (!field.valid) return false;

    const manifest = JSON.parse(field.value);

    if (!manifest.files) {
        sec.errors = ["missing 'files' property"];
        return false;
    }

    sec.errors = [];
    return true;
}

// return the files array
sec.value = () => {
    const files = utils.tryParse(field.value)?.files;
    return files;
}

export default sec;
