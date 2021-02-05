export type Header = Record<string, string|number>;
export type Payload = Record<string, any>;
export type EncryptionResult = string;
export type SignatureResult = string;
export type VerificationResult = {
    valid: true;
    payload: any;
} | {
    valid: false;
};
export interface EncryptionKey {
    encrypt: (header: Header, payload: string) => Promise<EncryptionResult>;
    decrypt: (jwe: string) => Promise<string>;
    publicJwk: JsonWebKey;
    privateJwk: JsonWebKey;
}
export interface SigningKey {
    sign: (header: Header, payload: Payload) => Promise<SignatureResult>;
    verify: (jws: string) => Promise<VerificationResult>;
    publicJwk: JsonWebKey;
    privateJwk: JsonWebKey;
}

export interface KeyGenerators {
    generateSigningKey: (inputPublic?: JsonWebKey, inputPrivate?: JsonWebKey) => Promise<SigningKey>;
    generateEncryptionKey: (inputPublic?: JsonWebKey, inputPrivate?: JsonWebKey) => Promise<EncryptionKey>;
}
