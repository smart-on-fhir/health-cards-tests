import * as utils from '../utils2.js';
import * as validate from '../validate2.js';
import qrSection from './qr.js'

const sec = document.getElementById('decodeShlPayload');
const fieldViewer = sec.fields[0];
const fieldPayload = sec.fields[1];
let initialized = false;

qrSection.addEventListener('valid', () => {
    initialized = true;
    sec.initialize();
});

qrSection.addEventListener('invalid', (f) => {
    initialized = false;
    sec.clear();
});

// Check that viewer field has a valid syntax - or is empty
// We don't actually use the viewer field, so we can just always return true
fieldViewer.valid = (field) => {

    // this field is optional, empty is valid
    if (field.value.trim() === '') return true;

    const result = validate.shlViewer(field.value, 0);

    if (result === false) {
        field.errors = ["viewer not valid HTTPS url"];
    }

    return result;
}

// check that payload is valid JSON
fieldPayload.valid = async (field) => {

    // if the section is not ready and the field is empty, fail without error
    if (!initialized && field.value.trim() === '') {
        field.errors = [];
        return false;
    }

    const payload = utils.tryParse(field.value);

    if (!payload) {
        field.errors = ['Not valid JSON'];
        return false;
    }

    field.errors = await validate.shlPayload(JSON.stringify(payload));

    // valid if no errors (warnings ok)
    return field.errors.every(e => e.level < 3);
}




sec.initialize = async function () {

    const shlink = qrSection.value;
    if (!shlink) return;

    let viewer = "", 
        link = shlink;

    if (shlink.indexOf('#') >= 0) {
        const parts = shlink.split('#', 2);
        viewer = parts[0];
        link = parts[1]
    }

    let encoded = /([\w-]+)\s*$/.exec(link)?.[1];

    const json = utils.decodeBase64Url(encoded);
    const payload = utils.tryParse(json);

    if (!payload) {
        fieldPayload.value = json;
        sec.setErrors(["Cannot parse SHL into payload"]);
        return;
    };

    fieldViewer.value = viewer;
    fieldPayload.value = JSON.stringify(payload, null, 2);
};


sec.update = async function (field) {
    // return true if each field is valid
    return this.fields.every(f => f.valid);
}

// we override the value() property to return payload as an object
// this is purely a convenience for the downstream sections
sec.value = () => {
    return utils.tryParse(fieldPayload.value);
}

export default sec;
