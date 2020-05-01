import base64url from 'base64url';
import { randomBytes } from 'crypto';
import { Jose } from 'jose-jwe-jws';
import { sha256 } from '../node_modules/did-jwt/src/Digest';
import { EncryptionKey, SigningKey, KeyGenerators } from './KeyTypes';

var EC = require('elliptic').ec;
var ec = new EC('secp256k1');

export function encodeSection(data: any): string {
    return base64url.encode(JSON.stringify(data));
}

export const keyGenerators: KeyGenerators = {
    generateEncryptionKey,
    generateSigningKey
}

export async function generateEncryptionKey(inputPublic?: JsonWebKey, inputPrivate?: JsonWebKey): Promise<EncryptionKey> {
    let publicKey: CryptoKey | null = null;
    let privateKey: CryptoKey | null = null;
    if (inputPublic) {
        publicKey = await window.crypto.subtle.importKey('jwk', inputPublic, {
            name: 'RSA-OAEP',
            hash: { name: 'SHA-1' }
        }, true, ['encrypt', 'wrapKey']);
        if (inputPrivate) {
            privateKey = await window.crypto.subtle.importKey('jwk', inputPrivate, {
                name: 'RSA-OAEP',
                hash: { name: 'SHA-1' }
            }, true, ['decrypt', 'unwrapKey']);
        }
    } else {
        const k = await window.crypto.subtle.generateKey({
            name: 'RSA-OAEP',
            modulusLength: 2048,
            publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
            hash: { name: 'SHA-1' }
        }, true, // extractable
            ['encrypt', 'wrapKey', 'decrypt', 'unwrapKey']);
        publicKey = k.publicKey;
        privateKey = k.privateKey;
    }

    const publicJwk = await window.crypto.subtle.exportKey('jwk', publicKey);
    const privateJwk = privateKey ? await window.crypto.subtle.exportKey('jwk', privateKey) : null;

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
        let uncompressed = new Uint8Array(Buffer.from([0x04, ...base64url.toBuffer(inputPublic.x), ...base64url.toBuffer(inputPublic.y)]));
        publicKey = ec.keyFromPublic(uncompressed)
        publicJwk = inputPublic;

        if (inputPrivate) {
            window['ec'] = ec
            privateKey = ec.keyFromPrivate(Buffer.from(inputPrivate.d))
        }
    } else {
        privateKey = ec.genKeyPair();
        publicKey = privateKey.getPublic()

        publicJwk = {
            'kty': 'EC',
            'crv': 'secp256k1',
            'x': base64url.encode(publicKey.getX().toArrayLike(Buffer)),
            'y': base64url.encode(publicKey.getY().toArrayLike(Buffer)),
        };
        
        privateJwk = {
            ...publicJwk,
            'd': base64url.encode(privateKey.getPrivate().toArrayLike(Buffer)),
        };
    }


    return {
        sign: async (header, payload) => {
            const headerToSign = { ...header, alg: 'ES256K' };
            const signingInput: string = [
                encodeSection(headerToSign),
                encodeSection(payload)
            ].join('.');
            const signature = privateKey.sign(sha256(signingInput));
            const signatureCombined = Uint8Array.from([...signature.r.toArrayLike(Buffer) as Uint8Array, ...signature.s.toArrayLike(Buffer) as Uint8Array])
            const jwt = [signingInput, base64url.encode(Buffer.from(signatureCombined))].join('.');
            return jwt;
        },
        verify: async (jwt) => {
            const parts = jwt.split('.');
            const signature = parts[2];
            const signedContent = parts.slice(0, 2).join('.');
            const signatureBuffer = base64url.toBuffer(signature);
            const valid = publicKey.verify(sha256(signedContent), {
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
