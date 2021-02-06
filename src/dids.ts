import axios from 'axios';
import base64url from 'base64url';
import * as crypto from 'crypto';
import multihashes from 'multihashes';
import { privateJwks, resolveUrl } from './config';
import { EncryptionKey, KeyGenerators, SigningKey, VerificationResult } from './KeyTypes';
import { canonicalize } from 'json-canonicalize';
import { config } from 'process';
import { SiopRequestReceiverProps } from './SiopApproval';
import { SiopInteraction, SiopRequest, SiopResponse } from './holder';
import jose, { JWK, parse } from 'node-jose';
import pako from 'pako';
import { assert } from 'console';
import { JWT } from 'jose';


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

interface HealthCard {
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

    constructor(keyStore?: jose.JWK.KeyStore) {
        this.keyStore = keyStore || jose.JWK.createKeyStore();
    }

    async storeKeyValidatingThumbprint(key: JsonWebKey) {
    // TODO assert kid is the valid JWK thumprint
        return this.keyStore.add(key)
    }

    async getEncryptionKeyForIss(iss: string) {
        let newKeyset = (await axios.get(`${iss}/.well-known/jwks.json`)).data;
        let encryptionKey = newKeyset.keys.filter(k => k.use === 'enc')[0]
        this.keyStore.add(encryptionKey)
        this.storeKeyValidatingThumbprint(encryptionKey)
        const rawKey = this.keyStore.all({kid: encryptionKey.kid})[0]
        return JWK.asKey(rawKey)
    }

    async getSubJwk(jws: string) {
        let parsedJwsUnsafe = jwsParts<SiopResponse>(jws);
        return await JWK.asKey(parsedJwsUnsafe.body.sub_jwk)
    }

    async getVerificationKeyForJws(jws: string) {
        let parsedJwsUnsafe = jwsParts<any>(jws);
        console.log("parsed temp ", parsedJwsUnsafe)
        let kid = parsedJwsUnsafe.header.kid as string;
        let iss = parsedJwsUnsafe.body.iss;
        return await this.getAndStoreKey(kid, iss);
    }

    async getAndStoreKey(kid: string, iss: string) {
        console.log("Get key for kid", kid);
        let jwkCandidates = this.keyStore.all({ kid });
        if (jwkCandidates.length === 0) {
        console.log("fetch it key for kid", kid);
            let newKeyset = (await axios.get(`${iss}/.well-known/jwks.json`)).data;
            await Promise.all(newKeyset.keys.map(k => this.storeKeyValidatingThumbprint(k)))
            console.log("Added keys to keyset", this.keyStore.all().length)
        }
        const rawKey = this.keyStore.all({ kid })[0]
        return JWK.asKey(rawKey)
    }

    async verifyHealthCardJws(jws: string): Promise<HealthCard> {
        console.log("Verifyh hc", jws)
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

    async signSiopResponse(idTokenPayload: SiopResponse): Promise<string> {
        //TODO take this from class variable
        let signingKey = await JWK.asKey(privateJwks.holder.keys[0])
        let signed = await jose.JWS.createSign({format: 'compact'}, signingKey).update(JSON.stringify(idTokenPayload)).final()
        console.log("Signed", signed)
        return signed as unknown as string;
    }


    async decryptSiopResponse(jws: string): Promise<string> {
        const privateKeystore =  await jose.JWK.asKeyStore(privateJwks.verifier);
        const decrypted = await jose.JWE.createDecrypt(privateKeystore).decrypt(jws);
        return decrypted.plaintext.toString()
    }

    async validateSiopResponse(jws: string, request: SiopRequest): Promise<SiopResponse> {
        let signingKey = await this.getSubJwk(jws);
        let verified = await jose.JWS.createVerify(signingKey).verify(jws)
        const body = JSON.parse(verified.payload.toString()) as SiopResponse
        assert(body.iss === 'https://self-issued.me')
        assert(body.nonce === request.nonce)
        return body
    }

    async encryptJwsToIssuer(jws: string, iss: string): Promise<string> {
        let encryptionKey = await this.getEncryptionKeyForIss(iss);
        console.log("Encrypting", jws)
        let jwe = await jose.JWE.createEncrypt({
                format: 'compact',
                fields: {
                    enc: 'A256GCM',
                }
            }, encryptionKey)
            .update(jose.util.asBuffer(jws)).final()
        console.log("Encrypted", jwe)
        return jwe
    }

}

export const siopManager = new SiopManager();


// TODO remove 'JwsVerificationKey2020' when prototypes have updated
const ENCRYPTION_KEY_TYPES = ['JsonWebKey2020', 'JwsVerificationKey2020'];

export async function encryptFor(jws: string, did: string, { generateEncryptionKey }: KeyGenerators, keyIdIn?: string) {
    const didDoc = (await axios.get(resolveUrl + did)).data;
    const keyId = keyIdIn ? keyIdIn : '#' + didDoc.keyAgreement[0].split("#")[1];
    const encryptionKey = didDoc.verificationMethod.filter(k => k.id == keyId)[0];

    const ek = await generateEncryptionKey({
        ...encryptionKey.publicKeyJwk,
        kid: keyId
    });
    return ek.encrypt({ kid: keyId }, jws);
}

const resolveKeyId = async (kid: string): Promise<JsonWebKey> => {
    const fragment = '#' + kid.split('#')[1];
    const didDoc = (await axios.get(resolveUrl + kid)).data;
    return didDoc.verificationMethod.filter(k => k.id === fragment)[0].publicKeyJwk;
};
export async function generateDid({ signingPublicJwk, encryptionPublicJwk, recoveryPublicJwk, updatePublicJwk, domains = [] as string[] }) {
    const hashAlgorithmName = multihashes.codes[18];

    const hash = (b: string | Buffer) => multihashes.encode(crypto.createHash('sha256').update(b).digest(), hashAlgorithmName);

    const revealCommitPair = (publicKey: SigningKey) => {
        const revealValueEncodedString = canonicalize(publicKey);
        const commitmentHashHash = hash(hash(revealValueEncodedString));
        const commitmentHashHashEncodedString = base64url.encode(commitmentHashHash);
        return [revealValueEncodedString, commitmentHashHashEncodedString];
    };

    const [recoveryValue, recoveryCommitment] = revealCommitPair(recoveryPublicJwk);
    const [updateValue, updateCommitment] = revealCommitPair(updatePublicJwk);
    let patches: { action: string, publicKeys?: any, services?: any }[] = [{
        action: 'add-public-keys',
        publicKeys: [{
            id: 'signing-key-1',
            purposes: ['authentication', 'assertionMethod'],
            type: 'JsonWebKey2020',
            publicKeyJwk: JSON.parse(JSON.stringify({ ...signingPublicJwk, kid: undefined }))
        }, {
            id: 'encryption-key-1',
            purposes: ['keyAgreement', 'assertionMethod'],
            type: 'JsonWebKey2020',
            publicKeyJwk: JSON.parse(JSON.stringify({ ...encryptionPublicJwk, kid: undefined }))
        }]
    }]
    if (domains.length > 0) {
        patches.push({
            "action": "add-services",
            "services": [{
                "id": "linked-domain",
                "type": "LinkedDomains",
                "serviceEndpoint": domains[0]
            }]
        });
    }

    const delta: Record<string, any> = {
        updateCommitment,
        patches
    };

    const deltaCanonical = canonicalize(delta);
    const suffixData = {
        deltaHash: base64url.encode(hash(Buffer.from(deltaCanonical))),
        recoveryCommitment: recoveryCommitment
    };

    const suffixDataCanonical = canonicalize(suffixData);
    const suffix = base64url.encode(hash(Buffer.from(suffixDataCanonical)));
    const didShort = `did:ion:${suffix}`;

    const longFormPayload = { suffixData, delta };
    const longFormPayloadCanonical = canonicalize(longFormPayload);
    const longFormFinalSegment = base64url.encode(longFormPayloadCanonical);
    const didLong = `${didShort}:${longFormFinalSegment}`;

    let ret = {
        did: didLong,
        recoveryValue,
        recoveryCommitment,
        updateValue,
        updateCommitment,
        delta,
        deltaCanonical,
        suffixData,
        suffixDataCanonical,
        didShort,
        didLong
    };

    return ret;
}
const jwtHeader = (jwt) => JSON.parse(base64url.decode(jwt.split('.')[0]));
