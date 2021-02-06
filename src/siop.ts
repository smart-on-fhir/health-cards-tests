import axios from 'axios';
import base64url from 'base64url';
import { JWKECKey } from 'jose';
import { canonicalize } from 'json-canonicalize';
import jose, { JWK } from 'node-jose';
import pako from 'pako';
import { SiopInteraction, SiopRequest, SiopResponse } from './holder';
import sha256 from './sha256';

const jwsParts = <T>(token: string): {
    header: any,
    body: T,
    signature: any
} => {
    let [headerEnc, bodyEnc, signatureEnc] = token.split(".");
    const header = JSON.parse(base64url.decode(headerEnc));
    const signature = base64url.decode(signatureEnc);
    let bodyRaw = base64url.toBuffer(bodyEnc);
    if (header.zip == 'DEF') {
        bodyRaw = Buffer.from(pako.inflate(bodyRaw));
    }
    let body: T = JSON.parse(bodyRaw.toString());
    return { header, body, signature };
}

export interface HealthCard {
    iss: string;
    iat: number;
    exp: number;
    vc: {
        type: string[];
        credentialSubject: {
            fhirVersion: string;
            fhirBundle: any
        }
    }
};

export class SiopManager {
    public keyStore: jose.JWK.KeyStore;
    public signingKey: JWKECKey;
    public encryptionKey?: JWKECKey;

    constructor({keyStore, signingKey, encryptionKey}: {
        signingKey: JWKECKey,
        encryptionKey?: JWKECKey,
        keyStore?: jose.JWK.KeyStore
    }) {
        this.keyStore = keyStore || jose.JWK.createKeyStore();
        this.signingKey = signingKey;
        this.encryptionKey = encryptionKey;
    }

    async storeKeyValidatingThumbprint(key: JWKECKey) {
        const expectedThumbprint = base64url(sha256(canonicalize({
            crv: key.crv,
            kty: key.kty,
            x: key.x,
            y: key.y
        })));

        if (key.kid !== expectedThumbprint) {
            throw `Invalid key thumprint kid ${key.kid} (expected ${expectedThumbprint})`
        }

        if (this.keyStore.all({kid: key.kid}).length === 0) {
            return this.keyStore.add(key)
        }
    }

    async getEncryptionKeyForIss(iss: string) {
        let newKeyset = (await axios.get(`${iss}/.well-known/jwks.json`)).data;
        let encryptionKey = newKeyset.keys.filter(k => k.use === 'enc')[0]
        await this.storeKeyValidatingThumbprint(encryptionKey)

        const rawKey = this.keyStore.all({kid: encryptionKey.kid})[0]
        return JWK.asKey(rawKey)
    }

    async getSubJwk(jws: string) {
        let parsedJwsUnsafe = jwsParts<SiopResponse>(jws);
        return await JWK.asKey(parsedJwsUnsafe.body.sub_jwk)
    }

    async getVerificationKeyForJws(jws: string) {
        let parsedJwsUnsafe = jwsParts<any>(jws);
        let kid = parsedJwsUnsafe.header.kid as string;
        let iss = parsedJwsUnsafe.body.iss;
        return await this.getAndStoreKey(kid, iss);
    }

    async getAndStoreKey(kid: string, iss: string) {
        let jwkCandidates = this.keyStore.all({ kid });
        if (jwkCandidates.length === 0) {
            let newKeyset = (await axios.get(`${iss}/.well-known/jwks.json`)).data;
            await Promise.all(newKeyset.keys.map(k => this.storeKeyValidatingThumbprint(k)))
        }
        const rawKey = this.keyStore.all({ kid })[0]
        return JWK.asKey(rawKey)
    }

    async verifyHealthCardJws(jws: string): Promise<HealthCard> {
        let signingKey = await this.getVerificationKeyForJws(jws)
        const verified = await jose.JWS.createVerify(signingKey).verify(jws)

        let body = verified.payload;
        if ((verified.header as any).zip === 'DEF') {
            body = Buffer.from(pako.inflate(body));
        }

        return JSON.parse(body.toString());
    }

    async validateSiopRequest(jws: string): Promise<SiopRequest> {
        let signingKey = await this.getVerificationKeyForJws(jws)
        let verified = await jose.JWS.createVerify(signingKey).verify(jws)
        return JSON.parse(verified.payload.toString()) as SiopInteraction['siopRequest']
    }

    async signJws(idTokenPayload: object, deflate: boolean = false): Promise<string> {
        const bodyString = JSON.stringify(idTokenPayload)
        let signingKey = await JWK.asKey(this.signingKey)

        let fields = deflate ? {zip: 'DEF'} : {}
        let body = deflate ? pako.deflate(bodyString) : bodyString

        let signed = await jose.JWS.createSign({format: 'compact', fields}, signingKey).update(body).final()
        return signed as unknown as string;
    }

    async decryptJws(jws: string): Promise<string> {
        const encryptionKey =  await jose.JWK.asKey(this.encryptionKey!);
        const decrypted = await jose.JWE.createDecrypt(encryptionKey).decrypt(jws);
        return decrypted.plaintext.toString()
    }

    async validateSiopResponse(jws: string, request: SiopRequest): Promise<SiopResponse> {
        let signingKey = await this.getSubJwk(jws);
        let verified = await jose.JWS.createVerify(signingKey).verify(jws)
        const body = JSON.parse(verified.payload.toString()) as SiopResponse
        if (body.iss !== 'https://self-issued.me') {
            throw new Error("Expected SIOP response to be from https://self-issued.me");
        }
        if (body.nonce !== request.nonce) {
            throw new Error("SIOP response nonce to match request nonce");
        }
        return body
    }

    async encryptJwsToIssuer(jws: string, iss: string): Promise<string> {
        let encryptionKey = await this.getEncryptionKeyForIss(iss);
        let jwe = await jose.JWE.createEncrypt({
                format: 'compact',
                fields: {
                    enc: 'A256GCM',
                }
            }, encryptionKey)
            .update(jose.util.asBuffer(jws)).final()
        return jwe
    }

    async decryptJwe(jwe: string): Promise<string> {
        let encryptionKey = await JWK.asKey(this.encryptionKey!)
        const ret = await jose.JWE.createDecrypt(encryptionKey).decrypt(jwe);
        return ret.plaintext.toString();
    }

}