import axios from 'axios';
import cors from 'cors';
import express from 'express';
import base64url from 'base64url';
import { JWT } from 'jose';
import * as crypto from 'crypto';
import qs from 'querystring';
import OperationType from '../sidetree/lib/core/enums/OperationType';
import AnchoredOperationModel from '../sidetree/lib/core/models/AnchoredOperationModel';
import Did from '../sidetree/lib/core/versions/latest/Did';
import DocumentComposer from '../sidetree/lib/core/versions/latest/DocumentComposer';
import OperationProcessor from '../sidetree/lib/core/versions/latest/OperationProcessor';
import { generateEncryptionKey, generateSigningKey, keyGenerators } from './keys-server';

import { VerifierState } from './VerifierState';
import { generateDid, verifyJws } from './dids';
import { issuerReducer, prepareSiopRequest, issueVcToHolder, parseSiopResponse } from './VerifierLogic';

const app = express();
app.use(express.raw({ type: 'application/x-www-form-urlencoded' }));
app.use(express.json({ type: 'application/json' }));
app.use(cors());
const port = 8080; // default port to listen

const fhirBase = 'https://hapi.fhir.org/baseR4';

async function resolveDid(did: string) {
    const parsedDid = await Did.create(did, 'ion');
    const operationWithMockedAnchorTime: AnchoredOperationModel = {
        didUniqueSuffix: parsedDid.uniqueSuffix,
        type: OperationType.Create,
        transactionTime: 0,
        transactionNumber: 0,
        operationIndex: 0,
        operationBuffer: parsedDid.createOperation.operationBuffer
    };

    const processor = new OperationProcessor();

    const newDidState = await processor.apply(operationWithMockedAnchorTime, undefined);
    const document = DocumentComposer.transformToExternalDocument(newDidState, did);
    return document;
}

const client = {
    get: async (url: string) => (await axios.get(fhirBase + '/' + url)).data
};

type VerifierResponse  = VerifierState["siopResponse"]
const siopCache: Record<string, {
    ttl: number,
    siopStateAfterRequest: VerifierState["siopRequest"],
    siopStateAfterResponse: Promise<VerifierState["siopResponse"]>,
    responseDeferred: {
        resolve: (r: VerifierResponse) => undefined;
        reject: (any) => undefined;
    }
}> = {};

const vcCache: Record<string, {
    ttl: number,
    vcs: string[]
}> = {};

const ttlMs = 1000 * 60 * 15; // 15 minute ttl
function enforceTtl(cache: Record<string, { ttl: number }>) {
    const now = new Date().getTime();
    Object.entries(cache).forEach(([k, { ttl }]) => {
        if (ttl < now) {
            delete cache[k];
        }
    });
}
/*
setInterval(() => {
    enforceTtl(siopCache);
    enforceTtl(vcCache)
}, 1000 * 60);
*/
const smartConfig = '.well-known/smart-configuration.json';
app.get('/api/fhir/' + smartConfig, (req, res) => {

    const fullUrl = issuerState.config.serverBase;
    const urlFor = relativePath => fullUrl + '/fhir/' + relativePath;

    res.json({
        'authorization_endpoint': urlFor('$authorize'),
        'token_endpoint': urlFor('$token'),
        'token_endpoint_auth_methods_supported': ['client_secret_basic'],
        'scopes_supported': ['launch/patient', 'patient/*.*', 'user/*.*', 'offline_access'],
        'response_types_supported': ['code', 'refresh_token'],
        'capabilities': ['launch-ehr', 'client-public', 'client-confidential-symmetric', 'context-ehr-patient']
    });
});

const SAMPLE_PATIENT_ID = 'sample-123';
app.get('/api/fhir/[\$]authorize', (req, res) => {
    const state = req.query.state as string;
    const redirectUri = req.query.redirect_uri as string;
    const scope = req.query.scope as string;
    res.redirect(redirectUri + '?' + qs.encode({
        state,
        code: JSON.stringify({
            patient: SAMPLE_PATIENT_ID,
            scope
        })
    }));
});

app.post('/api/fhir/[\$]token', (req, res) => {
    const { code } = qs.parse(req.body.toString());
    console.log('Code', code);
    const authorizeState = JSON.parse(code as string);
    res.json({
        'access_token': base64url.encode(crypto.randomBytes(32)),
        'token_type': 'bearer',
        'expires_in': 3600,
        ...authorizeState
    });
});

const patientToSiopResponse = {};
app.get('/api/fhir/Patient/:patientID/[\$]HealthWallet.connect', async (req, res) => {
    await dispatchToIssuer(prepareSiopRequest(issuerState));

    patientToSiopResponse[req.params.patientID] = issuerState.siopRequest.siopRequestPayload.state;
    const openidUrl = issuerState.siopRequest.siopRequestQrCodeUrl;
    res.json({
        'resourceType': 'Parameters',
        'parameter': [{
            'name': 'openidUrl',
            'valueUrl': openidUrl
        }]
    });
});

app.get('/api/fhir/Patient/:patientID/[\$]HealthWallet.issue', async (req, res) => {

    const state = patientToSiopResponse[req.params.patientID];

    const siopResponse = await siopCache[state].siopStateAfterResponse;
    const id_token = siopResponse.idTokenRaw;

    const withResponse = await issuerReducer(issuerState, await parseSiopResponse(id_token, issuerState));
    const afterIssued = await issuerReducer(withResponse, await issueVcToHolder(withResponse));

    res.json({
        'resourceType': 'Parameters',
        'parameter': [{
            'name': 'vc',
            'valueString': afterIssued.issuedCredentials[0]
        }]
    });
});

const initializeIssuer = async (): Promise<VerifierState> => {
    const ek = await generateEncryptionKey();
    const sk = await generateSigningKey();
    const did = await generateDid({
        encryptionPublicKey: ek.publicJwk,
        signingPublicKey: sk.publicJwk
    });
    return {
        config: {
            serverBase: process.env.SERVER_BASE,
            claimsRequired: [],
            role: 'issuer',
            requestMode: 'form_post',
            skipVcPostToServer: true,
            postRequest: async (url, body) => {
                return new Promise(resolve => {
                    siopBegin({ body }, { json: resolve });
                });
            },
            keyGenerators
        },
        ek,
        sk,
        did
    };
};

let issuerState: VerifierState | null = null;
initializeIssuer().then(i => issuerState = i);

const dispatchToIssuer = async (ePromise) => {
    const e = await ePromise;
    issuerState = await issuerReducer(issuerState, e);
};

const siopBegin = async (req, res) => {
    const id: string = (JWT.decode(req.body.siopRequest) as any).state;

    let responseResolve;
    let responseReject;

    let vcResolve
    let vcReject;

    siopCache[id] = {
        siopStateAfterRequest: {
            siopRequestPayloadSigned: req.body.siopRequest,
            siopRequestPayload: null,
            siopRequestQrCodeUrl: null,
            siopResponsePollingUrl: null
        },
        siopStateAfterResponse: new Promise((resolveFn, rejectFn) => {
            responseResolve = resolveFn;
            responseReject = rejectFn;
        }),
        responseDeferred: {
            resolve: responseResolve, reject: responseReject
        },
        ttl: new Date().getTime() + ttlMs
    };

    res.json({
        responsePollingUrl: `/siop/${id}/response`,
        ...siopCache[id]
    });
};
app.post('/api/siop/begin', siopBegin);

app.get('/api/siop/:id/response', async (req, res) => {
    const r = await siopCache[req.params.id].siopStateAfterResponse;
    console.log("Siop response", r)
    res.send({
        state: req.params.id,
        id_token: r.idTokenRaw
    });
});

app.get('/api/siop/:id', async (req, res) => {
    const r = siopCache[req.params.id].siopStateAfterRequest;
    console.log("deref req", r)
    res.send(r.siopRequestPayloadSigned);
});

app.post('/api/siop', async (req, res) => {
    const body = qs.parse(req.body.toString());
    const state = body.state as string;
    const idTokenRaw = body.id_token as string;
    siopCache[state].responseDeferred.resolve({
        idTokenRaw,
        idTokenDecrypted: null,
        idTokenPayload: null
    });
    res.send('Received SIOP Response');
});

app.get('/api/did/:did', async (req, res) => {
    const didLong = decodeURIComponent(req.params.did);
    const didDoc = await resolveDid(didLong);
    res.json(didDoc.didDocument);
});

app.post('/api/lab/vcs/:did', async (req, res) => {
    const did = decodeURIComponent(req.params.did);
    const vcs = req.body.vcs;
    const entry = {
        vcs,
        ttl: new Date().getTime() + ttlMs
    };
    vcCache[did] = entry;
    res.send('Received VC for DID');
});

app.get('/api/lab/vcs/:did', async (req, res) => {
    const did = decodeURIComponent(req.params.did);
    res.json(vcCache[did]);
});

app.use(express.static('dist/static', {
    extensions: ['html']
}));

// start the Express server
app.listen(port, () => {
    console.log(`server started at http://localhost:${port}`);
});
