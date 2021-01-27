import axios from 'axios';
import base64url from 'base64url';
import * as crypto from 'crypto';
import multihashes from 'multihashes';
import { resolveUrl } from './config';
import { EncryptionKey, KeyGenerators, SigningKey } from './KeyTypes';
import { canonicalize } from 'json-canonicalize';
import { config } from 'process';

export async function verifyJws(jws: string, {
    generateEncryptionKey,
    generateSigningKey
}: KeyGenerators) {
    const signingKid = jwtHeader(jws).kid;
    const signingKeyJwt = await resolveKeyId(signingKid);
    const sk = await generateSigningKey(signingKeyJwt);
    return sk.verify(jws);
}

// TODO remove 'JwsVerificationKey2020' when prototypes have updated
const ENCRYPTION_KEY_TYPES = ['JsonWebKey2020', 'JwsVerificationKey2020']; 

export async function encryptFor(jws: string, did: string, { generateEncryptionKey }: KeyGenerators, keyIdIn?: string) {
    const didDoc = (await axios.get(resolveUrl +did)).data;
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
    const didDoc = (await axios.get(resolveUrl +kid)).data;
    return didDoc.verificationMethod.filter(k => k.id === fragment)[0].publicKeyJwk;
};
export async function generateDid({ signingPublicJwk, encryptionPublicJwk, recoveryPublicJwk, updatePublicJwk, domains = [] as string[]}) {
    const hashAlgorithmName = multihashes.codes[18];
    
    const hash = (b: string|Buffer) => multihashes.encode(crypto.createHash('sha256').update(b).digest(), hashAlgorithmName);

    const revealCommitPair = (publicKey: SigningKey) => {
        const revealValueEncodedString = canonicalize(publicKey);
        const commitmentHashHash = hash(hash(revealValueEncodedString));
        const commitmentHashHashEncodedString = base64url.encode(commitmentHashHash);
        return [revealValueEncodedString, commitmentHashHashEncodedString];
    };

    const [recoveryValue, recoveryCommitment] = revealCommitPair(recoveryPublicJwk);
    const [updateValue, updateCommitment] = revealCommitPair(updatePublicJwk);
    let patches: {action: string, publicKeys?: any, services?: any}[] = [{
            action: 'add-public-keys',
            publicKeys: [{
                id: 'signing-key-1',
                purposes: ['authentication', 'assertionMethod'],
                type: 'JsonWebKey2020',
                publicKeyJwk: JSON.parse(JSON.stringify({...signingPublicJwk, kid: undefined}))
            }, {
                id: 'encryption-key-1',
                purposes: ['keyAgreement', 'assertionMethod'],
                type: 'JsonWebKey2020',
                publicKeyJwk: JSON.parse(JSON.stringify({...encryptionPublicJwk, kid: undefined}))
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

    console.log("Patches", JSON.stringify(patches, null, 2));
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

    console.log("Key deets", ret);
    return ret;
}
const jwtHeader = (jwt) => JSON.parse(base64url.decode(jwt.split('.')[0]));
