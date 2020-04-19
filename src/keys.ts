import base64url from 'base64url';
import { randomBytes } from 'crypto';
import { Jose } from 'jose-jwe-jws';
import secp256k1 from 'secp256k1';
import { sha256 } from '../node_modules/did-jwt/src/Digest';

export type Header = Record<string, string>;
export type Payload = Record<string, any>;
export type EncryptionResult = string;
export type SignatureResult = string;
export type VerificationResult = { valid: true, payload: any } | { valid: false };

export function encodeSection (data: any): string {
    return base64url.encode(JSON.stringify(data));
}

export interface EncryptionKey {
    encrypt: (header: Header, payload: string) => Promise<EncryptionResult>;
    decrypt: (jwe: string) => Promise<string>;
    publicJwk: JsonWebKey;
}
export interface SigningKey {
    sign: (header: Header, payload: Payload) => Promise<SignatureResult>;
    verify: (jws: string) => Promise<VerificationResult>;
    publicJwk: JsonWebKey;
}
export async function generateEncryptionKey (input?: JsonWebKey): Promise<EncryptionKey> {
    let publicKey: CryptoKey | null = null;
    let privateKey: CryptoKey | null = null;
    if (input) {
        publicKey = await window.crypto.subtle.importKey('jwk', input, {
            name: 'RSA-OAEP',
            hash: { name: 'SHA-1' }
        }, true, ['wrapKey']);
    } else {
        const k = await window.crypto.subtle.generateKey({
            name: 'RSA-OAEP',
            modulusLength: 2048,
            publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
            hash: { name: 'SHA-1' }
        }, false, // non-extractable
            ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']);
        publicKey = k.publicKey;
        privateKey = k.privateKey;
    }
    const publicJwk = await window.crypto.subtle.exportKey('jwk', publicKey);
    const cryptographer = new Jose.WebCryptographer();
    cryptographer.setKeyEncryptionAlgorithm('RSA-OAEP');
    cryptographer.setContentEncryptionAlgorithm('A128CBC-HS256');
    return {
        decrypt: async (payload) => {
            // TODO assertions about header
            if (!privateKey) {
                throw new Error('Cannot decrypt with a public key');
            }
            const decrypter = new Jose.JoseJWE.Decrypter(cryptographer, Promise.resolve(privateKey));
            const publicJwk: JsonWebKey = await window.crypto.subtle.exportKey('jwk', publicKey);
            return decrypter.decrypt(payload);
        },
        encrypt: async (header, payload) => {
            const input = payload;
            const encrypter = new Jose.JoseJWE.Encrypter(cryptographer, publicKey);
            Object.entries(header).forEach(([k, v]) => encrypter.addHeader(k, v));
            return encrypter.encrypt(input);
        },
        publicJwk
    };
}
export async function generateSigningKey (input?: JsonWebKey): Promise<SigningKey> {
    let publicKey, privateKey, publicJwk;
    if (input) {
        let uncompressed = new Uint8Array(Buffer.from([0x04, ...base64url.toBuffer(input.x), ...base64url.toBuffer(input.y)]));
        publicKey = Buffer.from(uncompressed);
    } else {
        do {
            privateKey = randomBytes(32);
        } while (!secp256k1.privateKeyVerify(privateKey));
        publicKey = secp256k1.publicKeyCreate(privateKey, false); // uncompressed
        publicJwk = {
            'kty': 'EC',
            'crv': 'secp256k1',
            'x': base64url.encode(publicKey.slice(1, 33)),
            'y': base64url.encode(publicKey.slice(33, 65))
        };
        let uncompressed = new Uint8Array(Buffer.from([0x04, ...base64url.toBuffer(publicJwk.x), ...base64url.toBuffer(publicJwk.y)]));
        publicKey = Buffer.from(uncompressed);
    }
    publicJwk = {
        'kty': 'EC',
        'crv': 'secp256k1',
        'x': base64url.encode(publicKey.slice(1, 33)),
        'y': base64url.encode(publicKey.slice(33, 65))
    };
    return {
        sign: async (header, payload) => {
            const headerToSign = { ...header, alg: 'ES256K' };
            const signingInput: string = [
                encodeSection(headerToSign),
                encodeSection(payload)
            ].join('.');
            const signature = secp256k1.ecdsaSign(sha256(signingInput), privateKey);
            const jwt = [signingInput, base64url.encode(signature.signature)].join('.');
            return jwt;
        },
        verify: async (jwt) => {
            const parts = jwt.split('.');
            const signature = parts[2];
            const signedContent = parts.slice(0, 2).join('.');
            const signatureBuffer = base64url.toBuffer(signature);
            const valid = secp256k1.ecdsaVerify(signatureBuffer, sha256(signedContent), publicKey);
            return {
                valid,
                payload: valid ? JSON.parse(base64url.decode(parts[1])) : undefined
            };
        },
        publicJwk
    };
}
