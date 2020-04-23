import axios from 'axios';
import base64url from 'base64url';
import * as crypto from 'crypto';
import multihashes from 'multihashes';
import { resolveUrl } from './config';
import { EncryptionKey, generateEncryptionKey, generateSigningKey } from './keys';

export async function verifyJws (jws: string) {
    let signingKid = jwtHeader(jws).kid;
    let signingKeyJwt = await resolveKeyId(signingKid);
    let sk = await generateSigningKey(signingKeyJwt);
    return sk.verify(jws);
}
const ENCRYPTION_KEY_TYPE = 'JwsVerificationKey2020'; // TODO fix this once sidetree allows encryption key types

export async function encryptFor (jws: string, did: string) {
    const didDoc = (await axios.get(resolveUrl + encodeURIComponent(did))).data;
    const encryptionKey = didDoc.publicKey.filter(k => k.type === ENCRYPTION_KEY_TYPE)[0];
    let ek = await generateEncryptionKey(encryptionKey.publicKeyJwk);
    return ek.encrypt({ kid: encryptionKey.kid }, jws);
}
const resolveKeyId = async (kid: string): Promise<JsonWebKey> => {
    const fragment = '#' + kid.split('#')[1];
    const didDoc = (await axios.get(resolveUrl + encodeURIComponent(kid))).data;
    return didDoc.publicKey.filter(k => k.id === fragment)[0].publicKeyJwk;
};
export async function generateDid ({ signingPublicKey, encryptionPublicKey }) {
    const recoveryPublicKey = signingPublicKey;
    const hashAlgorithmName = multihashes.codes[18];
    const hash = (b: Buffer) => multihashes.encode(crypto.createHash('sha256').update(b).digest(), hashAlgorithmName);
    const revealCommitPair = () => {
        const revealValueBuffer = crypto.randomBytes(32);
        const revealValueEncodedString = base64url.encode(revealValueBuffer);
        const commitmentHash = hash(revealValueBuffer);
        const commitmentHashEncodedString = base64url.encode(commitmentHash);
        return [revealValueEncodedString, commitmentHashEncodedString];
    };
    const [recoveryValue, recoveryCommitment] = revealCommitPair();
    const [updateValue, updateCommitment] = revealCommitPair();
    const delta: Record<string, any> = {
        'update_commitment': updateCommitment,
        'patches': [{
            action: 'replace',
            document: {
                publicKeys: [{
                    id: 'signing-key-1',
                    usage: ['ops', 'general', 'auth'],
                    type: 'Secp256k1VerificationKey2019',
                    jwk: signingPublicKey
                }, {
                    id: 'encryption-key-1',
                    usage: ['general', 'auth'],
                    type: 'JwsVerificationKey2020',
                    jwk: encryptionPublicKey
                }]
            }
        }]
    };
    const deltaCanonical = JSON.stringify(delta);
    const deltaEncoded = base64url.encode(deltaCanonical);
    const suffixData = {
        delta_hash: base64url.encode(hash(Buffer.from(deltaCanonical))),
        recovery_key: recoveryPublicKey,
        recovery_commitment: recoveryCommitment
    };
    const suffixDataCanonical = JSON.stringify(suffixData);
    const suffixDataEncoded = base64url.encode(suffixDataCanonical);
    const suffix = base64url.encode(hash(Buffer.from(suffixDataEncoded)));
    const didShort = `did:ion:${suffix}`;
    const didLong = `did:ion:${suffix}?-ion-initial-state=${suffixDataEncoded}.${deltaEncoded}`;
    return didLong;
}
const jwtHeader = (jwt) => JSON.parse(base64url.decode(jwt.split('.')[0]));
