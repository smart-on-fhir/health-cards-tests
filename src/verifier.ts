import axios from 'axios';
import base64url from 'base64url';
import * as crypto from 'crypto';
import qs from "querystring";
import { serverBase } from './browser';
import { generateDid, verifyJws } from './dids';
import { EncryptionKey, generateEncryptionKey, generateSigningKey, SigningKey } from './keys';
// Cheap-o polling-based event simuation for the occasional
// cross-talk between holderWorld and verifierWorld
// (these are things where the user would act, in real life)
const simulatedInteractions = [];
export const simulated = async ({ who, type }, rateMs = 200) => {
    while (true) {
        await new Promise((resolve) => setTimeout(resolve, rateMs));
        const matches = simulatedInteractions
            .filter(e => e.who === who && e.type === type);
        if (matches.length) {
            return matches[0];
        }
    }
};
interface VerifierState {
    ek: EncryptionKey;
    sk: SigningKey;
    did: string;
    siopRequest?: {
        payload: any;
        jwt: string;
        created: any;
        qrCodeUrl: string;
        idToken?: any;
    };
}
const initializeVerifier = async (): Promise<VerifierState> => {
    let ek = await generateEncryptionKey(), sk = await generateSigningKey(), did = await generateDid({
        encryptionPublicKey: ek.publicJwk,
        signingPublicKey: sk.publicJwk
    });
    return {
        ek,
        sk,
        did,
    };
};
async function verifierEvent(state: VerifierState, event: any): Promise<VerifierState> {
    if (event.type === "siop-request-created") {
        return { ...state, siopRequest: event.siopRequest };
    }
    if (event.type === "siop-response-received") {
        return { ...state, siopRequest: { ...state.siopRequest, idToken: event.idToken } };
    }
    return state;
}
export async function verifierWorld() {
    let state = await initializeVerifier();
    const event = async (e) => {
        const pre = state;
        state = await verifierEvent(state, e);
        console.log("Verifier Event", e, pre, state);
    };
    console.log("Verifier initial state", state);
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
        "type": "display-qr-code",
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
