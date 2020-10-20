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
    const didDoc = (await axios.get(resolveUrl + encodeURIComponent(did))).data;
    const encryptionKeys = didDoc.publicKey.filter(k => ENCRYPTION_KEY_TYPES.includes(k.type));
    
    const keyId = keyIdIn ? keyIdIn : encryptionKeys[0].id;
    const encryptionKey = encryptionKeys.filter(k => k.id === keyId)[0]

    const ek = await generateEncryptionKey({
        ...encryptionKey.publicKeyJwk,
        kid: keyId
    });
    return ek.encrypt({ kid: keyId }, jws);
}
const resolveKeyId = async (kid: string): Promise<JsonWebKey> => {
    const fragment = '#' + kid.split('#')[1];
    const didDoc = (await axios.get(resolveUrl + encodeURIComponent(kid))).data;
    return didDoc.publicKey.filter(k => k.id === fragment)[0].publicKeyJwk;
};
export async function generateDid({ signingPublicJwk, encryptionPublicJwk, recoveryPublicJwk, updatePublicJwk, domains = [] as string[]}) {
    const hashAlgorithmName = multihashes.codes[18];
    const hash = (b: string|Buffer) => multihashes.encode(crypto.createHash('sha256').update(b).digest(), hashAlgorithmName);

    const revealCommitPair = (publicKey: SigningKey) => {
        const revealValueEncodedString = canonicalize(publicKey)
        const commitmentHash = hash(revealValueEncodedString);
        const commitmentHashEncodedString = base64url.encode(commitmentHash);
        return [revealValueEncodedString, commitmentHashEncodedString];
    };
    const [recoveryValue, recoveryCommitment] = revealCommitPair(recoveryPublicJwk);
    const [updateValue, updateCommitment] = revealCommitPair(updatePublicJwk);
    let patches: {action: string, public_keys?: any, service_endpoints?: any}[] = [{
            action: 'add-public-keys',
            public_keys: [{
                id: 'signing-key-1',
                purpose: ['general', 'auth'],
                type: 'EcdsaSecp256k1VerificationKey2019',
                jwk: signingPublicJwk
            }, {
                id: 'encryption-key-1',
                purpose: ['general', 'auth'],
                type: 'JsonWebKey2020',
                jwk: encryptionPublicJwk
            }]
        }]
    if (domains.length > 0) {
        patches.push({
            "action": "add-service-endpoints",
            "service_endpoints": [{
                "id": "linked-domain",
                "type": "LinkedDomains",
                "endpoint": domains[0]
                }]
            });
    } 
    console.log("Patches", JSON.stringify(patches, null, 2));
    const delta: Record<string, any> = {
        'update_commitment': updateCommitment,
        patches
    };
    const deltaCanonical = JSON.stringify(delta);
    const deltaEncoded = base64url.encode(deltaCanonical);
    const suffixData = {
        delta_hash: base64url.encode(hash(Buffer.from(deltaCanonical))),
        recovery_commitment: recoveryCommitment
    };
    const suffixDataCanonical = JSON.stringify(suffixData);
    const suffix = base64url.encode(hash(Buffer.from(suffixDataCanonical)));

    const didShort = `did:ion:${suffix}`;
    const suffixDataEncoded = base64url.encode(suffixDataCanonical);
    const didLong = `did:ion:${suffix}?-ion-initial-state=${suffixDataEncoded}.${deltaEncoded}`;
    return {
        did: didLong,
        recoveryValue,
        recoveryCommitment,
        updateValue,
        updateCommitment,
        delta,
        deltaCanonical,
        deltaEncoded,
        suffixData,
        suffixDataCanonical,
        suffixDataEncoded,
        didShort,
        didLong
    }
}
const jwtHeader = (jwt) => JSON.parse(base64url.decode(jwt.split('.')[0]));
