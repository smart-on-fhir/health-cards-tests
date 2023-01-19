import * as utils from './utils2.js';

function error(message, code = 100, level = 3) {
    return { message, code, level };
}

export const base64Url = function (text) {
    return /^[0-9a-zA-Z-_]+$/.test(text) ? [] : [error('Not valid Base64Url encoding')];
}

export const fhirBundle = async function (text, profile = 'any') {

    const obj = utils.tryParse(text);
    if (!obj) return [error('Cannot parse FHIR Bundle as JSON')];

    const result = await utils.restCall('/validate-fhir-bundle', { fhir: text, profile: profile });

    return result.errors;
}

export const key = function (text) {

    const key = utils.tryParse(text);
    if (!key) return [error('Cannot parse Key as JSON')];

    const required = ["kid", "x", "y", "d", "use", "alg", "crv", "kty"];
    const b64url = /^[0-9a-zA-Z_-]+$/;
    const patterns = [b64url, b64url, b64url, b64url, /^sig$/, /^ES256$/, /^P-256$/, /^EC$/];
    const errors = [];

    Object.keys(key).forEach(field => required.includes(field) || errors.push(error(`Key contains unexpected field ${field}`)));

    required.forEach((field, i) => {
        if (!key[field]) {
            errors.push(error(`Key missing required field ${field}`));
            return;
        }
        patterns[i].test(key[field]) || errors.push(error(`${field} contains unexpected value. Expect (${patterns[i].toString()})`));
    });

    return errors;
}

export const keySet = function (text) {


}

export const json = function (text) {


}

export const minified = async function (text) {

    const minified = utils.tryParse(text);
    if (!minified) return [error('Cannot parse minified Credential as JSON')];

    const errors = [];

    if (text !== JSON.stringify(minified)) errors.push(error('Minified Payload contains white-space'));

    return errors.concat(await validate.jwsPayload(text));

}

export const deflate = function (text) {
    // We could validate this with by calling the server and inflating
    // For now, we'll skip this
    return validate.base64Url(text);
}

export const jwe = async function (text) {
    const jwsRegEx = /^[\w-]+\s*\.\s*[\w-]*\s*\.\s*[\w-]*\s*\.\s*[\w-]*\s*\.\s*[\w-]+\s*$/i;
    const result = jwsRegEx.test(text);
    if (result === false) return { errors: [`Invalid JWE. Expect ${/^[0-9a-z-_]+\.[0-9a-z-_]*\.[0-9a-z-_]+\.[0-9a-z-_]+\.[0-9a-z-_]+$/i.toString()}`] };
    const clean = text.replace(/\s+/g, '');
    const resultWithErrors = await utils.restCall('/validate-jwe', { data: clean });
    return resultWithErrors;
}

export const jws = function (text) {
    const jwsRegEx = /^[0-9a-z-_]+\s*\.\s*[0-9a-z-_]+\s*\.\s*[0-9a-z-_]+$/i;
    if (!jwsRegEx.test(text)) return [`Invalid JWS. Expect ${/^[0-9a-z-_]+\.[0-9a-z-_]+\.[0-9a-z-_]+$/i.toString()}`];
    const signature = text.replace(/\s*\.\s*/g, '.').split('.')[2];
    return jwsSignature(signature);
}

export const jwsHeader = function (text) {

    const header = utils.tryParse(text);
    if (!header) {
        return ([error(`Cannot parse Header as JSON.`)]);
    }

    if ('DEF' !== header?.zip || 'ES256' !== header?.alg || !header.kid || !/^[0-9a-z-_]+$/i.test(header.kid)) {
        return ([error(`Invalid Header. Expect {"zip":"DEF","alg":"ES256","kid":"<Base64Url-String>"}`)]);
    }

    return [];
}

export const jwsPayload = async function (text) {

    const payload = utils.tryParse(text);
    if (!payload) return [error('Cannot parse Credential as JSON')];

    return (await utils.restCall('/validate-jws-payload', { payload: text })).errors;
}

export const jwsSignature = function (text) {

    const errors = base64Url(text);
    if (errors.length) return errors;

    const bytes = utils.decodeBase64Url(text).split('').map(c => c.charCodeAt(0));
    if (bytes.length !== 64) errors.push(error(`Signature is ${bytes.length} bytes. Expect 64 bytes.`));

    return errors;
}

export const healthCard = function (text) {

    const jwsRegEx = /^[0-9a-z-_]+\.[0-9a-z-_]+\.[0-9a-z-_]+$/i;

    const card = utils.tryParse(text);

    if (!card) return ([error('Could not parse Health Card as JSON.')]);

    if (!card.verifiableCredential?.[0]) return ([error('Invalid Health Card. Expect { verifiableCredential[<JWS-compact>]}')]);

    if (!jwsRegEx.test(card.verifiableCredential[0])) return ([error(`Invalid JWS. Expect ${jwsRegEx.toString()}`)]);

    return validate.jws(card.verifiableCredential[0]);
}

export const numeric = async function (textArray) {
    return (await utils.restCall('/validate-qr-numeric', { data: textArray })).errors;
}

export const shlink = async function (text) {
    return (await utils.restCall('/validate-shlink', { data: text })).errors;
}

export const checkTrustedDirectory = async function (url, directory) {
    return (await utils.restCall('/check-trusted-directory', { url: url, directory: directory })).errors;
}

export const shlViewer = function (text) {
     return /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/.test(text);
}

export const shlPayload = async function (text) {
    return (await utils.restCall('/validate-shl-payload', { data: text })).errors;
}
