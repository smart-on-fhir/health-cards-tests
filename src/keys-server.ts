import base64url from 'base64url';
import { randomBytes, PublicKeyInput } from 'crypto';
import jose, { JWT } from 'jose';
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
export async function generateEncryptionKey (inputPublic?: JsonWebKey, inputPrivate?: JsonWebKey): Promise<EncryptionKey> {
    let publicKey;
    let privateKey = null;
    let privateJwk;
    if (inputPublic) {
        publicKey = jose.JWK.asKey(inputPublic as PublicKeyInput);
    } else {
        privateKey = jose.JWK.generateSync('RSA');
        publicKey = privateKey;
        privateJwk = privateKey.toJWK(true);
    }

    const publicJwkFull = publicKey.toJWK(false);

    const publicJwk = {
        alg: publicJwkFull.alg,
        e: publicJwkFull.e,
        kty: publicJwkFull.kty,
        n: publicJwkFull.n
    };

    return {
        decrypt: async (payload) => {
            return (await jose.JWE.decrypt(payload, privateKey)).toString();
        },
        encrypt: async (header, payload) => {
            return jose.JWE.encrypt(payload, publicJwk, {
                ...header,
                enc: "A256GCM"
            });
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
        publicKey = jose.JWK.asKey(inputPublic as PublicKeyInput);
    } else {
        privateKey = jose.JWK.generateSync('EC', 'secp256k1');
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
            return jose.JWS.sign(payload, privateKey, header);
        },
        verify: async (jwt) => {
            let result;
            try {
                result = jose.JWS.verify(jwt, publicJwk);
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
