const validate = (function () {

    const validate = {};

    function error(message, code = 100, level = 3) {
        return { message, code, level };
    }

    validate.base64Url = function (text) {
        return /^[0-9a-zA-Z-_]+$/.test(text) ? [] : [error('Not valid Base64Url encoding')];
    }

    validate.fhirBundle = async function (text) {

        const obj = tryParse(text);
        if (!obj) return [error('Cannot parse FHIR Bundle as JSON')];

        const result = await restCall('/validate-fhir-bundle', { data: text }, 'POST');

        return result.errors;
    }

    validate.key = function (text) {

        const key = tryParse(text);
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

    validate.keySet = function (text) {


    }

    validate.json = function (text) {


    }

    validate.minified = async function (text) {

        const minified = tryParse(text);
        if (!minified) return [error('Cannot parse minified Credential as JSON')];

        const errors = [];

        if (text !== JSON.stringify(minified)) errors.push(error('Minified Payload contains white-space'));

        return errors.concat(await validate.jwsPayload(text));

    }

    validate.deflate = function (text) {
        // We could validate this with by calling the server and inflating
        // For now, we'll skip this
        return validate.base64Url(text);
    }

    validate.jws = function (text) {
        const jwsRegEx = /^[0-9a-z-_]+\s*\.\s*[0-9a-z-_]+\s*\.\s*[0-9a-z-_]+$/i;
        if (!jwsRegEx.test(text)) return [`Invalid JWS. Expect ${/^[0-9a-z-_]+\.[0-9a-z-_]+\.[0-9a-z-_]+$/i.toString()}`];
        const signature = text.replace(/\s*\.\s*/g, '.').split('.')[2];
        return validate.jwsSignature(signature);
    }

    validate.jwsHeader = function (text) {

        const header = tryParse(text);
        if (!header) {
            return ([error(`Cannot parse Header as JSON.`)]);
        }

        if ('DEF' !== header?.zip || 'ES256' !== header?.alg || !header.kid || !/^[0-9a-z-_]+$/i.test(header.kid)) {
            return ([error(`Invalid Header. Expect {"zip":"DEF","alg":"ES256","kid":"<Base64Url-String>"}`)]);
        }

        return [];
    }

    validate.jwsPayload = async function (text) {

        const payload = tryParse(text);
        if (!payload) return [error('Cannot parse Credential as JSON')];

        return (await restCall('/validate-jws-payload', { data: text }, 'POST')).errors;
    }

    validate.jwsSignature = function (text) {

        const errors = validate.base64Url(text);
        if (errors.length) return errors;

        const bytes = decodeBase64Url(text).split('').map(c => c.charCodeAt(0));
        if (bytes.length !== 64) errors.push(error(`Signature is ${bytes.length} bytes. Expect 64 bytes.`));

        return errors;
    }

    validate.healthCard = function (text) {

        const jwsRegEx = /^[0-9a-z-_]+\.[0-9a-z-_]+\.[0-9a-z-_]+$/i;

        const card = tryParse(text);

        if (!card) return ([error('Could not parse Health Card as JSON.')]);

        if (!card.verifiableCredential?.[0]) return ([error('Invalid Health Card. Expect { verifiableCredential[<JWS-compact>]}')]);

        if (!jwsRegEx.test(card.verifiableCredential[0])) return ([error(`Invalid JWS. Expect ${jwsRegEx.toString()}`)]);

        return validate.jws(card.verifiableCredential[0]);
    }

    validate.numeric = async function (textArray) {
        return (await restCall('/validate-qr-numeric', { data: textArray }, 'POST')).errors;
    }

    return validate;

})();