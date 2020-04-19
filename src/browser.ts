import multihashes from 'multihashes'
import axios from 'axios';
import { randomBytes } from 'crypto'
import secp256k1 from 'secp256k1'
import base64url from 'base64url';
import { Jose } from "jose-jwe-jws"
import { sha256 } from "../node_modules/did-jwt/src/Digest";
import Jwk from "sidetree/lib/core/versions/latest/util/Jwk";
import * as crypto from 'crypto';
import { eventNames } from 'cluster';

import { sampleVc } from './fixtures'

import qs from "querystring"

function encodeSection(data: any): string {
    return base64url.encode(JSON.stringify(data))
}

type Header = Record<string, string>
type Payload = Record<string, any>
type EncryptionResult = string
type SignatureResult = string
type VerificationResult = { valid: true, payload: any } | { valid: false }

interface EncryptionKey {
    encrypt: (header: Header, payload: string) => Promise<EncryptionResult>;
    decrypt: (jwe: string) => Promise<string>;
    publicJwk: JsonWebKey;
}

interface SigningKey {
    sign: (header: Header, payload: Payload) => Promise<SignatureResult>;
    verify: (jws: string) => Promise<VerificationResult>;
    publicJwk: JsonWebKey;
}

async function generateEncryptionKey(input?: JsonWebKey): Promise<EncryptionKey> {
    let publicKey: CryptoKey | null = null
    let privateKey: CryptoKey | null = null

    if (input) {
        publicKey = await window.crypto.subtle.importKey("jwk", input, {
            name: "RSA-OAEP",
            hash: { name: "SHA-1" },
        }, true,   ['wrapKey'],
        )
    } else {
        const k = await window.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
                hash: { name: "SHA-1" },
            },
            false, // non-extractable
            ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],

        )
        publicKey = k.publicKey
        privateKey = k.privateKey
    }

    const publicJwk = await window.crypto.subtle.exportKey("jwk", publicKey)

    const cryptographer = new Jose.WebCryptographer();
    cryptographer.setKeyEncryptionAlgorithm("RSA-OAEP");
    cryptographer.setContentEncryptionAlgorithm("A128CBC-HS256");


    return {
        decrypt: async payload => {
            //TODO assertions about header
            if (!privateKey) {
                throw "Cannot decrypt with a public key"
            }
            const decrypter = new Jose.JoseJWE.Decrypter(cryptographer, Promise.resolve(privateKey));
            const publicJwk: JsonWebKey = await window.crypto.subtle.exportKey("jwk", publicKey)
            return await decrypter.decrypt(payload)
        },
        encrypt: async (header, payload) => {
            const input = payload
            const encrypter = new Jose.JoseJWE.Encrypter(cryptographer, publicKey);
            Object.entries(header).forEach(([k, v]) => encrypter.addHeader(k, v))
            return await encrypter.encrypt(input)
        },
        publicJwk
    }
}


async function generateSigningKey(input?: JsonWebKey): Promise<SigningKey> {
    let publicKey, privateKey, publicJwk;

    if (input) {
        let uncompressed = new Uint8Array(Buffer.from([0x04, ...base64url.toBuffer(input.x), ...base64url.toBuffer(input.y)]))
        publicKey = Buffer.from(uncompressed)
        console.log("Loaded upblic", publicKey)

    } else {
        do {
            privateKey = randomBytes(32)
        } while (!secp256k1.privateKeyVerify(privateKey))

        publicKey = secp256k1.publicKeyCreate(privateKey, false) // uncompressed
        console.log("riv key", privateKey.length)
        publicJwk = {
            "kty": "EC",
            "crv": "secp256k1",
            "x": base64url.encode(publicKey.slice(1, 33)),
            "y": base64url.encode(publicKey.slice(33, 65)),
            //"d": base64url.encode(privKey)
        }
        console.log("Provate key key")
        console.log(JSON.stringify({ ...publicJwk, d: base64url.encode(privateKey) }))
        console.log("Loaded upblic", publicKey)

        let uncompressed = new Uint8Array(Buffer.from([0x04, ...base64url.toBuffer(publicJwk.x), ...base64url.toBuffer(publicJwk.y)]))
        publicKey = Buffer.from(uncompressed)
        console.log("Loaded upblic", publicKey)


    }
    publicJwk = {
        "kty": "EC",
        "crv": "secp256k1",
        "x": base64url.encode(publicKey.slice(1, 33)),
        "y": base64url.encode(publicKey.slice(33, 65)),
        //"d": base64url.encode(privKey)
    }
    console.log("PKC", publicJwk)

    return {
        sign: async (header, payload) => {
            const headerToSign = { ...header, alg: 'ES256K' }
            const signingInput: string = [
                encodeSection(headerToSign),
                encodeSection(payload)
            ].join('.')
            const signature = secp256k1.ecdsaSign(sha256(signingInput), privateKey)
            const jwt = [signingInput, base64url.encode(signature.signature)].join('.')
            return jwt
        },
        verify: async jwt => {
            const parts = jwt.split(".")
            const signature = parts[2]
            const signedContent = parts.slice(0, 2).join(".")
            const signatureBuffer = base64url.toBuffer(signature)
            const valid = secp256k1.ecdsaVerify(signatureBuffer, sha256(signedContent), publicKey)
            return {
                valid,
                payload: valid ? JSON.parse(base64url.decode(parts[1])) : undefined
            }
        },
        publicJwk
    }
}


async function generateDid({
    signingPublicKey, encryptionPublicKey
}) {

    const recoveryPublicKey = signingPublicKey

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
                }],
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
    const suffix = base64url.encode(hash(Buffer.from(suffixDataCanonical)));
    const didShort = `did:ion:${suffix}`;

    const createOperation = {
        type: 'create',
        suffix_data: suffixDataEncoded,
        delta: deltaEncoded
    };
    const createOperationCanonical = JSON.stringify(createOperation);
    const createOperationEncoded = base64url.encode(createOperationCanonical);
    const didLong = `did:ion:${suffix}?-ion-initial-state=${createOperationEncoded}`;
    return didLong

}

const jwtHeader = (jwt) => JSON.parse(base64url.decode(jwt.split(".")[0]))


const serverBase = process.env.SERVER_BASE || "http://localhost:8080"
const resolveUrl = `${serverBase}/did/`


const simulatedInteractions = []

async function verifyJws(jws: string) {
    let signingKid = jwtHeader(jws).kid;
    let signingKeyJwt = await resolveKeyId(signingKid);
    let sk = await generateSigningKey(signingKeyJwt);
    return await sk.verify(jws);
}

const ENCRYPTION_KEY_TYPE = "JwsVerificationKey2020" // TODO fix this once sidetree allows encryption key types
async function encryptFor(jws: string, did: string, ek: EncryptionKey) {
    console.log("God diddoc to sing", did)
    const didDoc = (await axios.get(resolveUrl + did)).data
    const encryptionKey = didDoc.publicKey.filter(k => k.type === ENCRYPTION_KEY_TYPE)[0]
    let ekBad = await generateEncryptionKey(encryptionKey.publicKeyJwk);
    return await ekBad.encrypt({kid: encryptionKey.kid}, jws)
}



const resolveKeyId = async (kid: string): Promise<JsonWebKey> => {
    const fragment = '#' + kid.split('#')[1]
    const didDoc = (await axios.get(resolveUrl + kid)).data
    console.log(didDoc.publicKey, fragment)
    return didDoc.publicKey.filter(k => k.id == fragment)[0].publicKeyJwk
}

const simulated = async ({who, event}, rateMs = 200) => {
    while (true) {
        await new Promise((resolve) => setTimeout(resolve, rateMs))
        const matches = simulatedInteractions
            .filter(e =>e.who === who && e.event === event)
        if (matches.length) {
            return matches[0]
        }
    } 
}

async function holderWorld(){
    const ek = await generateEncryptionKey();
    const sk = await generateSigningKey();

    const holderDid = await generateDid({
        encryptionPublicKey: ek.publicJwk,
        signingPublicKey: sk.publicJwk
    })

    let qrCodeUrl = (await simulated({who: 'verifier', event: 'display-qr-code'})).url
    let qrCodeParams = qs.parse(qrCodeUrl.split('?')[1])
    let requestUri = qrCodeParams.request_uri as string

    const siopRequestRaw = (await axios.get(requestUri)).data
    console.log("got siop req in holder wolrd", siopRequestRaw)

    const siopRequestVerified = await verifyJws(siopRequestRaw);
    if (!siopRequestVerified.valid) { return }
    const siopRequest = siopRequestVerified.payload
    
    // TODO confirm that kid actually belongs to the issuer

    console.log("sokv ver", siopRequestVerified)

    const idTokenHeader = {
        "kid": holderDid + '#signing-key-1'
    }

    const idTokenPayload = {
        "iss": "https://self-issued.me",
        "aud": siopRequest.client_id,
        "nonce": base64url.encode(crypto.randomBytes(16)),
        "iat": new Date().getTime() / 1000,
        "exp": new Date().getTime() / 1000 + 120,
        "did": holderDid,
        "presentations": [{
            "placeholderForVerfiablePresentation": sampleVc.credentialSubject
        }]
    }

    const idTokenSigned = await sk.sign({kid: holderDid + '#signing-key-1'}, idTokenPayload)
    console.log("holder signed", siopRequest)
    const idTokenEncrypted = await encryptFor(idTokenSigned, siopRequest.iss, ek)
    console.log("holder enc")

    const siopResponse = {
        state: siopRequest.state,
        id_token: idTokenEncrypted
    }

    const responseUrl = siopRequest.client_id
    console.log("Reurl", responseUrl)
    const siopResponseCreated = await axios.post(responseUrl, qs.stringify(siopResponse));
    console.log("Posted", siopResponseCreated)
    
 

    const holderDidDoc = (await axios.get(resolveUrl + holderDid)).data
}

async function verifierWorld(){
    const ek = await generateEncryptionKey();
    const sk = await generateSigningKey();

    const verifierDid = await generateDid({
        encryptionPublicKey: ek.publicJwk,
        signingPublicKey: sk.publicJwk
    })
    const verifierDidDoc = (await axios.get(resolveUrl + verifierDid)).data

    const state = base64url.encode(crypto.randomBytes(16))
    const siopRequestHeader = {
        kid: verifierDid + '#signing-key-1'
    }

    const siopRequestBody = {
        state,
        "iss": verifierDid,
        "response_type": "id_token",
        "client_id": `${serverBase}/siop`,
        "scope": "did_authn",
        "response_mode": "form_post",
        "nonce": base64url.encode(crypto.randomBytes(16)),
        "registration": {
            "id_token_signed_response_alg": ["ES256K"],
            "client_uri": serverBase
        }
    }

    const siopRequest = await sk.sign(siopRequestHeader, siopRequestBody)

    const siopRequestCreated = await axios.post(`${serverBase}/siop/begin`, {
        siopRequest,
    })

    const siopRequestQrCodeUrl =  'openid://?' + qs.encode({
        response_type: "id_token",
        scope: "did_authn",
        request_uri: serverBase + '/siop/' + siopRequestBody.state,
        client_id: siopRequestBody.client_id
    })

    simulatedInteractions.push({
        "who": "verifier",
        "event": "display-qr-code",
        "url": siopRequestQrCodeUrl
    })
    
    console.log("Verifier ready and waiting for SIOP response", siopRequestCreated)
    console.log("Poll for response on ", serverBase +  siopRequestCreated.data.responsePollingUrl)

    const POLLING_RATE_MS = 00 // Obviously replace this with websockets, SSE, etc
    let responseRetrieved;
    do {
        responseRetrieved = await axios.get(serverBase + siopRequestCreated.data.responsePollingUrl)
        await new Promise((resolve) => setTimeout(resolve, POLLING_RATE_MS))
    } while (!responseRetrieved.data)

    console.log("Response arrived e2e", responseRetrieved.data)
    
    const idTokenRetrieved = responseRetrieved.data.id_token
    const idTokenRetrievedDecrypted = await ek.decrypt(idTokenRetrieved)
    console.log("to rever ", idTokenRetrievedDecrypted)
    const idTokenVerified = await verifyJws(idTokenRetrievedDecrypted)
    if (!idTokenVerified.valid) {return}
    const idToken = idTokenVerified.payload
    
    console.log("Round trip decrypted + verified", idToken)
}


export default async function main() {
    await Promise.all([holderWorld(), verifierWorld()])
    /*
    const ek = await generateEncryptionKey();
    console.log("Got enc cey")
    const encrypted = await ek.encrypt({ 'heaer': "here" }, "Body")

    console.log("Enc,", encrypted)
    const decrypted = await ek.decrypt(encrypted);
    console.log("Dec", decrypted)

    const sk = await generateSigningKey();
    const signed = await sk.sign({ 'heaer': "here" }, { "bdy": "Thoiwejfoweujf owiehf oiweuhf iwuefh iweufh iweoufh weioufh wieufh wieufh aweiufh wieuhf iweuhf iwuehf iweuhf wiaeuh fiwehhhe but brThoiwejfoweujf owiehf oiweuhf iwuefh iweufh iweoufh weioufh wieufh wieufh aweiufh wieuhf iweuhf iwuehf iweuhf wiaeuh fiwehhhe but bree" })
    console.log("Sig,", signed)
    const verified = await sk.verify(signed)
    console.log("Ver", verified)

    const did = await generateDid({
        encryptionPublicKey: ek.publicJwk,
        signingPublicKey: sk.publicJwk
    })

    const serverBase = process.env.SERVER_BASE || "http://localhost:8080"

    console.log(resolveUrl)
    const didDoc = (await axios.get(resolveUrl)).data
*/

 

}


main().then(r => console.log("Resolved,", r))
