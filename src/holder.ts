import axios from 'axios';
import base64url from 'base64url';
import * as crypto from 'crypto';
import qs from "querystring";
import { encryptFor, generateDid, verifyJws } from './dids';
import { sampleVc } from './fixtures';
import { EncryptionKey, generateEncryptionKey, generateSigningKey, SigningKey } from './keys';
import { simulated } from "./verifier";

interface HolderState {
    ek: EncryptionKey;
    sk: SigningKey;
    did: string;
    qrCodeUrl?: string;
    siopRequest?: any;
}
const initializeHolder = async (): Promise<HolderState> => {
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
async function holderEvent(state: HolderState, event: any): Promise<HolderState> {
    if (event.type === "siop-request-received") {
        return { ...state, siopRequest: event.siopRequest };
    }
    console.log("Unhandled event!", event);
    return state;
}
export async function holderWorld() {
    let state = await initializeHolder();
    const event = async (e) => {
        const pre = state;
        state = await holderEvent(state, e);
        console.log("Holder event", e, pre, state);
    };
    console.log("Holder initial state", state);
    await receiveSiopRequest(state, event);
    await prepareSiopResponse(state, event);
}
async function receiveSiopRequest(state: HolderState, event: (e: any) => Promise<void>) {
    let qrCodeUrl = (await simulated({ who: 'verifier', type: 'display-qr-code' })).url;
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
