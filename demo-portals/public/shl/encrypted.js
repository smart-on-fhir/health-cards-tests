import * as utils from '../utils2.js';
import manifestFiles from './files.js'
import payloadSection from './payload.js'


const sec = document.getElementById('encryptedFiles');
const fieldKey = sec.fields[0];
const file = sec.fields[1];
let ready = false;

manifestFiles.addEventListener('valid', async () => {
    ready = true;
    for (let i = sec.fields.length - 1; i > 1; i--) {
        sec.removeTextField(sec.fields[i]);
    }
    sec.clear();
    await sec.initialize();
});

manifestFiles.addEventListener('invalid', () => {
    for (let i = sec.fields.length - 1; i > 1; i--) {
        sec.removeTextField(sec.fields[i]);
    }
    sec.clear();
    ready = false;
});

fieldKey.valid = (field) => {

    // if the section is not ready and the field is empty, fail without error
    if (!ready && field.value.trim() === '') {
        field.errors = [];
        return false;
    }

    const result = /^[0-9a-zA-Z-_]{43}$/.test(field.value);
    if (!result) {
        field.errors = ['Not a valid 43-character base64url string.'];
    }
    return result;
}

function isJWE(field) {

    // if the section is not ready and the field is empty, fail without error
    if (!ready && field.value.trim() === '') {
        field.errors = [];
        return false;
    }

    const jwsRegEx = /^[\w-]+\s*\.\s*[\w-]*\s*\.\s*[\w-]*\s*\.\s*[\w-]*\s*\.\s*[\w-]+\s*$/i;
    const result = jwsRegEx.test(field.value);

    if (result === false) {
        field.errors = [`Invalid JWE. Expect ${jwsRegEx.toString()}`];
    }

    return result;
}

file.valid = isJWE;

sec.initialize = async function () {

    if (this.disabled) return;

    const files = manifestFiles.value;
    if (!files) return;

    const payload = payloadSection.value;
    if (!payload) return;

    const key = payload.key;
    if (!key || typeof key !== 'string') {
        this.errors = ['payload is missing key or payload.key is not a string'];
    }

    fieldKey.value = key;

    for (let i = 1; i < files.length; i++) {
        const f = sec.addTextField(`Encrypted File ${i + 1}`);
        f.label = true;
    }

    (await Promise.all(files.map(f => utils.restCall('/download-shl-manifest-file', f, {cache: false}))))
    .forEach((result, i) => {
        if(result.errors.length) {
            sec.fields[i + 1].value = "Download failed."
            sec.fields[i + 1].errors = result.errors;
        } else {
            sec.fields[i + 1].valid = isJWE;
            sec.fields[i + 1].value = result.encryptedFile;
        }
    });

};

sec.update = function (field) {
    const isValid = sec.fields.every(f => f.valid);
    return isValid;
}

sec.value = (section) => {
    return {
        key: section.fields[0].value,
        files: section.fields.map(f => f.value).slice(1)
    }
}

export default sec;
