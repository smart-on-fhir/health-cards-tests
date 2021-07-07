//
// Calls the Rest API on the server.
// Caller will specify when return type is other than JSON
//
async function restCall(url, data, method = 'POST', responseType = 'json') {

    const xhr = new XMLHttpRequest();

    return new Promise(function (resolve, reject) {

        xhr.open(method, url);

        if (data instanceof Object) {
            xhr.setRequestHeader("Content-Type", "application/json");
            data = JSON.stringify(data);
        }
        else if (typeof data === 'string') {
            xhr.setRequestHeader("Content-Type", "text/plain");
        }

        xhr.responseType = responseType;

        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                resolve(xhr.response);
            }
        };

        xhr.onerror = function (err) {
            reject(err);
        }

        method === 'POST' ? xhr.send(data) : xhr.send();

    });
}


//
// Computes the 'kid' of a JWK key using SHA-256
//
async function computeKid(keyJwk) {

    // Kid computation requires properties in alphabetical order
    keyJwk = { "crv": "P-256", "kty": "EC", "x": keyJwk.x, "y": keyJwk.y, };

    const keyBytes = new Uint8Array(JSON.stringify(keyJwk).split('').map(c => c.charCodeAt(0)));

    return window.crypto.subtle.digest({ name: "SHA-256", }, keyBytes)
        .then(function (hash) {
            return arrayBufferToBase64url(hash);
        })
        .catch(function (err) {
            console.error(err);
        });
}


//
// Converts data om an ArrayBuffer to a base64-url encoded string
//
function arrayBufferToBase64url(arrayBuffer) {
    return toBase64Url(btoa(String.fromCharCode(...new Uint8Array(arrayBuffer))));
}


//
// Converts regular base64 to base64-url
//
function toBase64Url(base64Text) {
    return base64Text.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}


//
// Decode Base64Url
//
function decodeBase64Url(base64Encoded) {

    var b64 = base64Encoded.replace(/\-/g, '+').replace(/\_/g, '/');

    // pad to make valid Base64
    if (b64.length % 4 === 1) b64 += 'A';
    while (b64.length % 4 !== 0) {
        b64 += '='
    }

    const decoded = atob(b64)

    return decoded;
}


//
// Tries to parse JSON returning undefined if it fails
//
function tryParse(text) {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}


//
// Generates a new ES256 key with 'kid' and writes it to the Signing-Key textarea element
//
async function generateKeyPair() {

    var key;

    return window.crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256", }, true, ["sign"])
        .then(function (keyPair) {
            return Promise.all([window.crypto.subtle.exportKey('jwk', keyPair.publicKey), window.crypto.subtle.exportKey('jwk', keyPair.privateKey)]);
        })
        .then(async function (exportedKeys) {

            const [publicKey, privateKey] = exportedKeys;
            const kid = await computeKid(publicKey);
            const newKeys = {
                "kty": "EC",
                "kid": kid,
                "use": "sig", "alg": "ES256", "crv": "P-256", "x": privateKey.x, "y": privateKey.y, "d": privateKey.d
            }

            await secInitKey.setValue(JSON.stringify(newKeys, null, 2));
            secInitKey.fields[0].dispatchEvent(new Event('input'));

            delete newKeys.d;
            await restCall('/upload-public-key', { pk: { keys: [newKeys] } }, 'POST');

            document.getElementById('textIssuer').value = document.location.origin + "/issuer";

        })
        .catch(function (err) {
            console.error(err);
        });
}
