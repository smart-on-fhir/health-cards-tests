import base64url from 'base64url';
import { Jose } from 'jose-jwe-jws';
import jose from 'node-jose';

import { EncryptionKey, SigningKey, KeyGenerators } from './KeyTypes';

import elliptic from 'elliptic'
import sha256 from './sha256';

const EC = elliptic.ec;
const ec = new EC('secp256k1');
const keystore = jose.JWK.createKeyStore();

export function encodeSection(data: any): string {
    return base64url.encode(JSON.stringify(data));
}

export const keyGenerators: KeyGenerators = {
    generateEncryptionKey,
    generateSigningKey
};

const encryptionKeyPros = {
    "kty": "EC",
    "crv": "P-256",
    "alg": 'ECDH-ES',
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
    let publicKey;
    let privateKey;
    let publicJwk;
    let privateJwk;

    if (inputPublic) {
        const uncompressed = new Uint8Array(Buffer.from([0x04, ...base64url.toBuffer(inputPublic.x), ...base64url.toBuffer(inputPublic.y)]));
        publicKey = ec.keyFromPublic(uncompressed);
        publicJwk = inputPublic;

        if (inputPrivate) {
            privateKey = ec.keyFromPrivate(base64url.toBuffer(inputPrivate.d));
            privateJwk = {
                ...publicJwk,
                'd': base64url.encode(privateKey.getPrivate().toArrayLike(Buffer))
            };

        }
    } else {
        privateKey = ec.genKeyPair();

        publicJwk = {
            'kty': 'EC',
            'crv': 'secp256k1',
            'x': base64url.encode(privateKey.getPublic().getX().toArrayLike(Buffer)),
            'y': base64url.encode(privateKey.getPublic().getY().toArrayLike(Buffer))
        };

        publicKey = ec.keyFromPublic(privateKey.getPublic());

        privateJwk = {
            ...publicJwk,
            'd': base64url.encode(privateKey.getPrivate().toArrayLike(Buffer))
        };
    }

    return {
        sign: async (header, payload) => {
            const headerToSign = { ...header, alg: 'ES256K' };
            const signingInput: string = [
                encodeSection(headerToSign),
                encodeSection(payload)
            ].join('.');
            const hashOfInput = sha256(signingInput)
            const signature = privateKey.sign(hashOfInput);
            const signatureBuffer = Uint8Array.from([...signature.r.toArrayLike(Buffer) as Uint8Array, ...signature.s.toArrayLike(Buffer) as Uint8Array]);
            const jwt = [signingInput, base64url.encode(Buffer.from(signatureBuffer))].join('.');
            return jwt;
        },
        verify: async (jwt) => {
            const parts = jwt.split('.');
            const signature = parts[2];
            const signedContent = parts.slice(0, 2).join('.');
            const signatureBuffer = base64url.toBuffer(signature);
            const hashOfInput = sha256(signedContent)
            const valid = publicKey.verify(hashOfInput, {
                r: signatureBuffer.slice(0, 32),
                s: signatureBuffer.slice(32)
            });
            return {
                valid,
                payload: valid ? JSON.parse(base64url.decode(parts[1])) : undefined
            };
        },
        publicJwk,
        privateJwk
    };
}
