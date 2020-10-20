import base64url from 'base64url';
import { randomBytes, PublicKeyInput } from 'crypto';
import jjose, { JWT } from 'jose';
import jose from 'node-jose';
import secp256k1 from 'secp256k1';
import { EncryptionKey, SigningKey, KeyGenerators } from './KeyTypes';

export type Header = Record<string, string>;
export type Payload = Record<string, any>;
export type EncryptionResult = string;
export type SignatureResult = string;
export type VerificationResult = { valid: true, payload: any } | { valid: false };

export const keyGenerators: KeyGenerators = {
    generateEncryptionKey,
    generateSigningKey
};

export function encodeSection (data: any): string {
    return base64url.encode(JSON.stringify(data));
}
const keystore = jose.JWK.createKeyStore();
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
            console.log("Encrypt", header, (publicKey as any).kid,
            jwe
            )
            return jwe;
        },
        publicJwk,
        privateJwk
    };
}

export async function generateSigningKey (inputPublic?: JsonWebKey, inputPrivate?: JsonWebKey): Promise<SigningKey> {
    let publicKey;
    let privateKey = null;
    let privateJwk;
    if (inputPublic) {
        publicKey = jjose.JWK.asKey(inputPublic as PublicKeyInput);
    } else {
        privateKey = jjose.JWK.generateSync('EC', 'secp256k1');
        publicKey = privateKey;
        privateJwk = privateKey.toJWK(true);
    }

    const publicKeyFull = publicKey.toJWK(false);

    const publicJwk = {
        'kty': publicKeyFull.kty,
        'crv': publicKeyFull.crv,
        'x': publicKeyFull.x,
        'y': publicKeyFull.y
    };

    return {
        sign: async (header, payload) => {
            return jjose.JWS.sign(payload, privateKey, header);
        },
        verify: async (jwt) => {
            let result;
            try {
                result = jjose.JWS.verify(jwt, publicJwk);
                return {
                    payload: result,
                    valid: true
                };

            } catch {
                return { valid: false };
            }
        },
        publicJwk,
        privateJwk
    };
}
