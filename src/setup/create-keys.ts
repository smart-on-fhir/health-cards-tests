import jose from 'node-jose';

/*
    ts-node create-keys.ts > src/fixtures/issuer.private.jwks
    ts-node create-keys.ts > src/fixtures/verifier.private.jwks
*/

const encryptionKeyProps = {
    "kty": "EC",
    "crv": "P-256",
    "alg": 'ECDH-ES',
    "use": "enc"
}

const signingKeyProps = {
    "kty": "EC",
    "crv": "P-256",
    "alg": 'ES256',
    "use": "sig"
}

async function generate() {
    let sign = await jose.JWK.createKey("EC", "P-256", signingKeyProps);
    let encrypt = await jose.JWK.createKey("EC", "P-256", encryptionKeyProps);

    console.log(JSON.stringify({
        keys: [
            sign.toJSON(true),
            encrypt.toJSON(true),
        ]
    }, null, 2));
}

generate();