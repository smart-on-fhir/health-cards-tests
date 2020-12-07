import base64url from 'base64url';
import jose from 'node-jose';

import { EncryptionKey, SigningKey, KeyGenerators, SignatureResult } from './KeyTypes';
import sha256 from './sha256';

const keystore = jose.JWK.createKeyStore();

export const keyGenerators: KeyGenerators = {
    generateEncryptionKey,
    generateSigningKey
};

const encryptionKeyPros = {
    "kty": "EC",
    "crv": "P-256",
    "alg": 'ECDH-ES',
}
const signingKeyProps = {
    "kty": "EC",
    "crv": "P-256",
    "alg": 'ES256',
}

export async function generateEncryptionKey(inputPublic?: JsonWebKey, inputPrivate?: JsonWebKey): Promise<EncryptionKey> {
    let publicKey: jose.JWK.Key | null = null;
    let privateKey: jose.JWK.Key | null = null;

    if (inputPublic) {
        publicKey = await jose.JWK.asKey(inputPublic);

        if (inputPrivate) {
            privateKey = await jose.JWK.asKey(inputPrivate)
        }
    } else {
        publicKey = privateKey = await keystore.generate("EC", "P-256", encryptionKeyPros);
    }

    const publicJwk = publicKey.toJSON(false);
    const privateJwk = privateKey ? privateKey.toJSON(true) : null;

    return {
        decrypt: async (payload) => {
            // TODO assertions about header
            if (!privateKey) {
                throw new Error('Cannot decrypt with a public key');
            }

            try {
                const ret = await jose.JWE.createDecrypt(privateKey).decrypt(payload);
                return ret.plaintext.toString();
            } catch (e) {
                console.log("Error decrypting", e)
            }
        },
        encrypt: async (header, payload) => {
            const input = payload;
            const jwe = await jose.JWE
            .createEncrypt({
                format: 'compact',
                fields: {
                    ...header,
                    enc: 'A256GCM',
                }
            }, publicKey)
            .update(jose.util.asBuffer(input)).final()
            return jwe;
        },
        publicJwk,
        privateJwk
    };
}
export async function generateSigningKey(inputPublic?: JsonWebKey, inputPrivate?: JsonWebKey): Promise<SigningKey> {
    let publicKey: jose.JWK.Key | null = null;
    let privateKey: jose.JWK.Key | null = null;

    if (inputPublic) {
        publicKey = await jose.JWK.asKey(inputPublic);

        if (inputPrivate) {
            privateKey = await jose.JWK.asKey(inputPrivate)
        }
    } else {
        publicKey = privateKey = await keystore.generate("EC", "P-256", signingKeyProps);
    }

    const publicJwk = publicKey.toJSON(false);
    const privateJwk = privateKey ? privateKey.toJSON(true) : null;

    return {
        sign: async (header, payload) => {
            const jws = await jose.JWS
            .createSign({
                format: 'compact',
                fields: header,
                }, privateKey)
            .update(JSON.stringify(payload))
            .final();

            return jws as unknown as SignatureResult;
        },
        verify: async (jwt) => {
            try {
                let verified = await jose.JWS.createVerify(publicKey).verify(jwt)
                return {
                    valid: true,
                    payload: JSON.parse(verified.payload.toString())
                }
            } catch {
                return {
                    valid: false
                }
            }
        },
        publicJwk,
        privateJwk
    };
}
