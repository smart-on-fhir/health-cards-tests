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
export async function generateDid({ signingPublicJwk, encryptionPublicJwk, recoveryPublicJwk, updatePublicJwk, domains = [] as string[], customSuffix = ""}) {
    const hashAlgorithmName = multihashes.codes[18];
    
    const hash = (b: string|Buffer) => multihashes.encode(crypto.createHash('sha256').update(b).digest(), hashAlgorithmName);

    const revealCommitPair = (publicKey: SigningKey) => {
        const revealValueEncodedString = canonicalize(publicKey);
        const commitmentHashHash = hash(hash(revealValueEncodedString));
        const commitmentHashHashEncodedString = base64url.encode(commitmentHashHash);
        return [revealValueEncodedString, commitmentHashHashEncodedString];
    };

    const publicKeyEntry = (id: string, jwk: any, additionalPurposes: string[] = []) => {
        return {
            id,
            purposes: ["assertionMethod", ...additionalPurposes],
            type: "JsonWebKey2020",
            publicKeyJwk: JSON.parse(JSON.stringify({ ...jwk, kid: undefined }))
        }
    };

    const [recoveryValue, recoveryCommitment] = revealCommitPair(recoveryPublicJwk);
    const [updateValue, updateCommitment] = revealCommitPair(updatePublicJwk);
    const publicKeys = [];

    if (typeof signingPublicJwk === "object") {
        publicKeys.push(publicKeyEntry("signing-key-1", signingPublicJwk, ["authentication"]));
    }
    if (typeof encryptionPublicJwk === "object") {
        publicKeys.push(publicKeyEntry("encryption-key-1", encryptionPublicJwk, ["keyAgreement"]));
    }

    let patches: { action: string, publicKeys?: any, services?: any }[] = [];

    if (publicKeys.length > 0) {
        patches.push({
            action: "add-public-keys",
            publicKeys
        });
    }

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
    const suffix = (customSuffix === "") ? base64url.encode(hash(Buffer.from(suffixDataCanonical))) : customSuffix;
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
