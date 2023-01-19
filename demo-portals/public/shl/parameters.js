import * as utils from '../utils2.js';
import payloadSection from './payload.js'


const sec = document.getElementById('manifest');
const [fieldUrl, fieldPassCode, fieldRecipient, fieldEmbeddedLengthMax] = sec.fields;
let initialized = false;


payloadSection.addEventListener('valid', (f) => {
    initialized = true;
    sec.initialize();
});


payloadSection.addEventListener('invalid', (f) => {
    sec.clear();
    initialized = false;
});


fieldUrl.valid = async (field) => {

    // if the section is not ready and the field is empty, fail without error
    if (!initialized && field.value.trim() === '') {
        field.errors = [];
        return false;
    }

    if (isValidUrl(field.value)) return true;

    field.errors = ['Not valid URL'];
    return false;
};


fieldRecipient.valid = (field) => { return true };
fieldEmbeddedLengthMax.valid = (field) => { return true; };


let passcodeRequired = false;

sec.initialize = async function () {

    if (this.disabled) return;

    const payload = payloadSection.value;

    if (!payload) return;

    passcodeRequired = !!(payload.flag.indexOf('P') + 1)

    if (passcodeRequired === false) {
        fieldPassCode.placeholder = "passcode (not required)"
        fieldPassCode.valid = (field) => true;

    } else {
        fieldPassCode.placeholder = "passcode (required)"
        // Increase the key-bounce to 1-sec to avoid sending requests with incomplete passwords
        // This is the delay between key-presses before processing. We don't want to send a server request after
        // each key press, so we wait a moment for another key-press before processing the field.
        // Normally this is set to 1/2-sec 
        fieldPassCode.options.delay.bounce = 1000;
        fieldPassCode.valid = (field) => {
            return (field.value.length > 0);
        }
        fieldPassCode.errors = fieldPassCode.value ? [] : ['passcode required'];
    }

    // set this after 'passcode'
    fieldUrl.value = payload.url;

};


sec.update = async function (field) {

    const url = fieldUrl.value;
    const passcode = fieldPassCode.value;
    const recipient = fieldRecipient.value;
    const embeddedLengthMax = parseInt(fieldEmbeddedLengthMax.value) ?? -1;

    // fail if invalid URL
    if (fieldUrl.valid === false) return false;

    // fail if no passcode (when required)
    if (passcodeRequired && !passcode) return false;

    return true;
}

sec.value = (section) => {
    return {
        url: section.fields[0].value,
        passcode: section.fields[1].value,
        recipient: section.fields[2].value,
        embeddedLengthMax: parseInt(section.fields[3].value) ?? undefined
    };
}

// override the clear method to preserve user provided parameters
sec.clear = (section) => {
    section.fields[0].clear()
    if (!section.fields[1].value.trim()) section.fields[1].clear()
    if (!section.fields[2].value.trim()) section.fields[2].clear()
    if (!section.fields[3].value.trim()) section.fields[3].clear()
    section.errors = [];
    return false;
}

function isValidUrl(url) {
    return /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/.test(url);
}



export default sec;