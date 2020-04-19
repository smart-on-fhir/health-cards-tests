import axios from 'axios';
import base64url from 'base64url';
import * as crypto from 'crypto';
import qs from "querystring";
import { encryptFor, generateDid, verifyJws } from './dids';
import { sampleVc } from './fixtures';
import { generateEncryptionKey, generateSigningKey, EncryptionKey, SigningKey } from './keys';


const serverBase = process.env.SERVER_BASE || "http://localhost:8080"
export const resolveUrl = `${serverBase}/did/`


// Cheap-o polling-based event simuation for the occasional
// cross-talk between holderWorld and verifierWorld
// (these are things where the user would act, in real life)
const simulatedInteractions = []
const simulated = async ({ who, type }, rateMs = 200) => {
    while (true) {
        await new Promise((resolve) => setTimeout(resolve, rateMs))
        const matches = simulatedInteractions
            .filter(e => e.who === who && e.type === type)
        if (matches.length) {
            return matches[0]
        }
    }
}

interface HolderState {
    ek: EncryptionKey,
    sk: SigningKey,
    did: string,
    qrCodeUrl?: string,
    siopRequest?: any
}

const initializeHolder = async (): Promise<HolderState> => {
    let ek = await generateEncryptionKey(),
        sk = await generateSigningKey(),
        did = await generateDid({
            encryptionPublicKey: ek.publicJwk,
            signingPublicKey: sk.publicJwk
        });

    return {
        ek,
        sk,
        did,
    };
}

async function holderEvent(state: HolderState, event: any): Promise<HolderState> {
    if (event.type === "siop-request-received") {
        return { ...state, siopRequest: event.siopRequest }
    }
    console.log("Unhandled event!", event)
    return state
}

async function holderWorld() {
    let state = await initializeHolder();
    const event = async e => {
        const pre = state
        state = await holderEvent(state, e)
        console.log("Holder event", e, pre, state)
    }
    console.log("Holder initial state", state)

    await receiveSiopRequest(state, event);
    await prepareSiopResponse(state, event);
}

async function receiveSiopRequest(state: HolderState, event: (e: any) => Promise<void>) {
    let qrCodeUrl = (await simulated({ who: 'verifier', type: 'scan-qr-code' })).url;
    let qrCodeParams = qs.parse(qrCodeUrl.split('?')[1]);
    let requestUri = qrCodeParams.request_uri as string;
    const siopRequestRaw = (await axios.get(requestUri)).data;
    const siopRequestVerified = await verifyJws(siopRequestRaw);
    if (siopRequestVerified.valid) {
        await event({
            type: "siop-request-received",
            siopRequest: siopRequestVerified.payload
        });
    }
}

async function prepareSiopResponse(state: HolderState, event: (e: any) => Promise<void>) {
    const idTokenHeader = {
        "kid": state.did + '#signing-key-1'
    };
    const idTokenPayload = {
        "iss": "https://self-issued.me",
        "aud": state.siopRequest.client_id,
        "nonce": base64url.encode(crypto.randomBytes(16)),
        "iat": new Date().getTime() / 1000,
        "exp": new Date().getTime() / 1000 + 120,
        "did": state.did,
        "presentations": [{
            "placeholderForVerfiablePresentation": sampleVc.credentialSubject
        }]
    };
    const idTokenSigned = await state.sk.sign({ kid: state.did + '#signing-key-1' }, idTokenPayload);
    const idTokenEncrypted = await encryptFor(idTokenSigned, state.siopRequest.iss, state.ek);
    const siopResponse = {
        state: state.siopRequest.state,
        id_token: idTokenEncrypted
    };
    const responseUrl = state.siopRequest.client_id;
    const siopResponseCreated = await axios.post(responseUrl, qs.stringify(siopResponse));
    await event({
        type: "siop-response-submitted",
        siopResponse: {
            idTokenPayload,
            siopResponse,
            success: siopResponseCreated.status === 200
        }
    });
}



interface VerifierState {
    ek: EncryptionKey,
    sk: SigningKey,
    did: string,
    siopRequest?: {
        payload: any,
        jwt: string,
        created: any,
        qrCodeUrl: string,
        idToken?: any
    }
}

const initializeVerifier = async (): Promise<VerifierState> => {
    let ek = await generateEncryptionKey(),
        sk = await generateSigningKey(),
        did = await generateDid({
            encryptionPublicKey: ek.publicJwk,
            signingPublicKey: sk.publicJwk
        });

    return {
        ek,
        sk,
        did,
    };
}

async function verifierEvent(state: VerifierState, event: any): Promise<VerifierState> {
    if (event.type === "siop-request-created") {
        return { ...state, siopRequest: event.siopRequest }
    }
    if (event.type === "siop-response-received") {
        return { ...state, siopRequest: { ...state.siopRequest, idToken: event.idToken } }
    }
    return state
}


async function verifierWorld() {

    let state = await initializeVerifier();
    const event = async e => {
        const pre = state;
        state = await verifierEvent(state, e);
        console.log("Verifier Event", e, pre, state)
    }

    console.log("Verifier initial state", state)

    await prepareSiopRequest(state, event);
    await receiveSiopResponse(state, event);
}


async function prepareSiopRequest(state: VerifierState, event: (e: any) => Promise<void>) {
    const siopState = base64url.encode(crypto.randomBytes(16));
    const siopRequestHeader = {
        kid: state.did + '#signing-key-1'
    };
    const siopRequestBody = {
        state: siopState,
        "iss": state.did,
        "response_type": "id_token",
        "client_id": `${serverBase}/siop`,
        "scope": "did_authn",
        "response_mode": "form_post",
        "nonce": base64url.encode(crypto.randomBytes(16)),
        "registration": {
            "id_token_signed_response_alg": ["ES256K"],
            "client_uri": serverBase
        }
    };
    const siopRequest = await state.sk.sign(siopRequestHeader, siopRequestBody);
    const siopRequestCreated = await axios.post(`${serverBase}/siop/begin`, {
        siopRequest,
    });
    const siopRequestQrCodeUrl = 'openid://?' + qs.encode({
        response_type: "id_token",
        scope: "did_authn",
        request_uri: serverBase + '/siop/' + siopRequestBody.state,
        client_id: siopRequestBody.client_id
    });
    simulatedInteractions.push({
        "type": "scan-qr-code",
        "who": "verifier",
        "url": siopRequestQrCodeUrl
    });
    await event({
        type: "siop-request-created",
        siopRequest: {
            payload: siopRequestBody,
            jwt: siopRequest,
            created: siopRequestCreated.data,
            qrCodeUrl: siopRequestQrCodeUrl
        }
    });
}

async function receiveSiopResponse(state: VerifierState, event: (e: any) => Promise<void>) {
    const POLLING_RATE_MS = 500; // Obviously replace this with websockets, SSE, etc
    let responseRetrieved;
    do {
        responseRetrieved = await axios.get(serverBase + state.siopRequest.created.responsePollingUrl);
        await new Promise((resolve) => setTimeout(resolve, POLLING_RATE_MS));
    } while (!responseRetrieved.data);
    const idTokenRetrieved = responseRetrieved.data.id_token;
    const idTokenRetrievedDecrypted = await state.ek.decrypt(idTokenRetrieved);
    const idTokenVerified = await verifyJws(idTokenRetrievedDecrypted);
    if (idTokenVerified.valid) {
        const idToken = idTokenVerified.payload;
        await event({
            type: "siop-response-received",
            idToken
        });
    }
}


export default async function main() {
    await Promise.all([holderWorld(), verifierWorld()])
}


main().then(r => console.log("Resolved,", r))
