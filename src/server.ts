import axios from 'axios';
import cors from 'cors';
import express from 'express';
import base64url from 'base64url';
import base64 from 'base-64';
import { JWT } from 'jose';
import * as crypto from 'crypto';
import qs from 'querystring';
import OperationType from '@decentralized-identity/sidetree/dist/lib/core/enums/OperationType';
import AnchoredOperationModel from '@decentralized-identity/sidetree/dist/lib/core/models/AnchoredOperationModel';
import Did from '@decentralized-identity/sidetree/dist/lib/core/versions/latest/Did';
import DocumentComposer from '@decentralized-identity/sidetree/dist/lib/core/versions/latest/DocumentComposer';
import OperationProcessor from '@decentralized-identity/sidetree/dist/lib/core/versions/latest/OperationProcessor';
import { generateEncryptionKey, generateSigningKey, keyGenerators } from './keys-server';

import exampleDr from './fixtures/diagnostic-report.json'

import { VerifierState } from './VerifierState';
import { generateDid, verifyJws, encryptFor } from './dids';
import { issuerReducer, prepareSiopRequest, issueVcToHolder, parseSiopResponse, CredentialGenerationDetals } from './VerifierLogic';

import * as s1 from '@decentralized-identity/sidetree/dist/lib/core/versions/latest/protocol-parameters.json';
import * as s2 from '@decentralized-identity/sidetree/dist/lib/bitcoin/protocol-parameters.json';


const app = express();
app.use(express.raw({ type: 'application/x-www-form-urlencoded', limit: '5000kb' }));
app.use(express.json({ type: 'application/json', limit: '5000kb'}));
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

type VerifierResponse = VerifierState["siopResponse"]
const siopCache: Record<string, {
    ttl: number,
    siopStateAfterRequest: VerifierState["siopRequest"],
    siopStateAfterResponse: Promise<VerifierState["siopResponse"]>,
    responseDeferred: {
        pending: boolean,
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
const smartConfig = '.well-known/smart-configuration';
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
const generateSamplePatientId = () => crypto.randomBytes(8).toString('hex')

app.get('/api/fhir/[\$]authorize', (req, res) => {
    const state = req.query.state as string;
    const redirectUri = req.query.redirect_uri as string;
    const scope = req.query.scope as string;
    res.redirect(redirectUri + '?' + qs.encode({
        state,
        code: JSON.stringify({
            patient: generateSamplePatientId(),
            scope
        })
    }));
});

app.post('/api/fhir/[\$]token', (req, res) => {
    const { code } = qs.parse(req.body.toString());
    const authorizeState = JSON.parse(code as string);
    res.json({
        'access_token': base64url.encode(crypto.randomBytes(32)),
        'token_type': 'bearer',
        'expires_in': 3600,
        ...authorizeState
    });
});

const patientToSiopResponse = {};
app.get('/api/fhir/Patient/:patientID/[\$]HealthWallet.connect', async (req, res, err) => {
    try {

    await dispatchToIssuer(prepareSiopRequest(issuerState));

    patientToSiopResponse[req.params.patientID] = issuerState.siopRequest.siopRequestPayload.state;
    const openidUrl = issuerState.siopRequest.siopRequestQrCodeUrl;
    res.json({
        'resourceType': 'Parameters',
        'parameter': [{
            'name': 'openidUrl',
            'valueUri': openidUrl
        }]
    });
    } catch (e) {
        err(e);
    }
});

async function getVcForPatient(patientId, details: CredentialGenerationDetals = {
    type: 'https://healthwallet.cards#covid19',
    presentationContext: 'https://healthwallet.cards#presentation-context-online',
    identityClaims: null,
    encryptVc: false
}) {
    const state = patientToSiopResponse[patientId];
    if (!state) {
        return null
    }
    if (siopCache[state].responseDeferred.pending){
        throw `No SIOP request has been completed for patient ${patientId}`;
    }
    const siopResponse = await siopCache[state].siopStateAfterResponse;
    const id_token = siopResponse.idTokenRaw;
    const withResponse = await issuerReducer(issuerState, await parseSiopResponse(id_token, issuerState));
    const afterIssued = await issuerReducer(withResponse, await issueVcToHolder(withResponse, details));
    const vc = afterIssued.issuedCredentials[0]

    return vc;
}


app.get('/api/fhir/DiagnosticReport', async (req, res, err) => {
    try {


    const vc = await getVcForPatient(req.query.patient);
    const fullUrl = issuerState.config.serverBase;

    res.json({
        resourceType: 'Bundle',
        entry: [{
            fullUrl: `${fullUrl}/fhir/DiagnosticReport/${exampleDr.id}`,
            search: {
                mode: "match"
            },
            resource: {
                meta: {
                    tag: [{
                        system: "https://healthwallet.cards",
                        code: "covid19"
                    }]
                },
                extension: vc ? [{
                    "url": "https://healthwallet.cards#vc-attachment",
                    "valueAttachment": {
                        "title": "COVID-19 Card for online presentation",
                        "data": base64.encode(vc)
                    }
                }] : undefined,
                ...exampleDr,
            }
        }]
    })
    
    } catch (e) {
        err(e);
    }
});


app.post('/api/fhir/Patient/:patientID/[\$]HealthWallet.issueVc', async (req, res, err) => {
    try {

    const requestBody = (req.body || {})

    const requestedCredentialType = (requestBody.parameter || [])
        .filter(p => p.name === 'credentialType')
        .map(p => p.valueUri)[0]

    const requestedPresentationContext = (requestBody.parameter || [])
        .filter(p => p.name === 'presentationContext')
        .map(p => p.valueUri)[0]

    const requestedCredentialIdentityClaims = (requestBody.parameter || [])
        .filter(p => p.name === 'includeIdentityClaim')
        .map(p => p.valueString)

    const requestedEncryptionKeyId = (requestBody.parameter || [])
        .filter(p => p.name === 'encryptForKeyId')
        .map(p => p.valueString)

    if (requestedEncryptionKeyId.length > 0 && requestedEncryptionKeyId[0][0] !== "#") {
        throw "Requested encryption key ID must start with '#', e.g., '#encryption-key-1'.";
    }


    const encryptVc =  requestedEncryptionKeyId.length === 1;
    const vc = await getVcForPatient(req.params.patientID, {
        type: requestedCredentialType,
        presentationContext: requestedPresentationContext,
        identityClaims: requestedCredentialIdentityClaims.length > 0 ? requestedCredentialIdentityClaims : null,
        encryptVc,
        encryptVcForKeyId: encryptVc ? requestedEncryptionKeyId[0] : undefined
    });

    if (!vc) {
        throw "No VC Available matching requested claims, or VC generation failed";
    }


    res.json({
        'resourceType': 'Parameters',
        'parameter': [{
            'name': 'verifiableCredential',
            'valueAttachment': {
                "data": base64.encode(vc)
            }
        }]
    });
        
    } catch (e) {
        err(e);
    }
});

const initializeIssuer = async (): Promise<VerifierState> => {
    const ek = await generateEncryptionKey();
    const sk = await generateSigningKey();
    const uk = await generateSigningKey();
    const rk = await generateSigningKey();

    const did = await generateDid({
        encryptionPublicJwk: ek.publicJwk,
        signingPublicJwk: sk.publicJwk,
        recoveryPublicJwk: rk.publicJwk,
        updatePublicJwk: uk.publicJwk
    });
    return {
        config: {
            serverBase: process.env.SERVER_BASE,
            claimsRequired: [],
            role: 'issuer',
            responseMode: 'form_post',
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
        did: did.did,
        didDebugging: did
    };
};

let issuerState: VerifierState | null = null;
initializeIssuer().then(i => issuerState = i);

const dispatchToIssuer = async (ePromise) => {
    const e = await ePromise;
    issuerState = await issuerReducer(issuerState, e);
};

const siopBegin = async (req, res, err?) => {
    try {

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
            responseResolve = (...args) => {
                siopCache[id].responseDeferred.pending = false;
                resolveFn(...args);
            };
            responseReject = (...args) => {
                siopCache[id].responseDeferred.pending = false;
                rejectFn(...args);
            };
        }),
        responseDeferred: {
            pending: true,
            resolve: responseResolve,
            reject: responseReject
        },
        ttl: new Date().getTime() + ttlMs
    };

    res.json({
        responsePollingUrl: `/siop/${id}/response`,
        ...siopCache[id]
    });
    } catch (e){ 
        err && err(e);
    }
};
app.post('/api/siop/begin', siopBegin);

app.get('/api/siop/:id/response', async (req, res, err) => {
    try {
    const r = await siopCache[req.params.id].siopStateAfterResponse;
    res.send({
        state: req.params.id,
        id_token: r.idTokenRaw
    });
        
    } catch(e) {
        err(e);
    }
});

app.get('/api/siop/:id', async (req, res, err) => {
    try {
    const r = siopCache[req.params.id].siopStateAfterRequest;
    res.send(r.siopRequestPayloadSigned);
    } catch (e) {
        err(e);
    }
});

app.post('/api/siop', async (req, res, err) => {
    try {
    const body = qs.parse(req.body.toString());
    const state = body.state as string;
    const idTokenRaw = body.id_token as string;
    siopCache[state].responseDeferred.resolve({
        idTokenRaw,
        idTokenDecrypted: null,
        idTokenPayload: null
    });
    res.send('Received SIOP Response');
    } catch(e) {
        err(e);
    }
});

app.get('/api/did/:did', async (req, res, err) => {
    try  {
    const didLong = decodeURIComponent(req.params.did);
    const didDoc = await resolveDid(didLong);
    res.json(didDoc.didDocument);
    } catch (e) {
        err(e)
    }
});

app.post('/api/lab/vcs/:did', async (req, res, err) => {
    try {
    
        
    const did = decodeURIComponent(req.params.did);
    const vcs = req.body.vcs;
    const entry = {
        vcs,
        ttl: new Date().getTime() + ttlMs
    };
    vcCache[did] = entry;
    res.send('Received VC for DID');
        
    } catch (e) {
        err(e);
    }
});

app.get('/api/lab/vcs/:did', async (req, res, err) => {
    try {
    const did = decodeURIComponent(req.params.did);
    res.json(vcCache[did]);
    } catch (e) {
        err(e);
    }
});


app.get('/api/test/did-doc', async (req, res, err) => {
    try {
    const did = issuerState.did;
    const didDoc = await resolveDid(did);
    res.json(didDoc.didDocument);
        
    } catch (e) {
        err(e);
    }
});

app.get('/api/test/did-debug', (req, res) => {
    res.json(issuerState.didDebugging);
});



app.post('/api/test/validate-jws', async (req, res, err) => {
    try {
        const jws = req.body.toString()
        const jwsVerified = await verifyJws(jws, keyGenerators);
        res.json(jwsVerified)
    } catch (e) {
        err(e);
    }
});

app.post('/api/test/validate-jwe', async (req, res, err) => {
    try {
        const jwe = req.body.toString()
        const jwsVerified = await issuerState.ek.decrypt(jwe);
        res.json(jwsVerified)
    } catch (e) {
        err(e);
    }
});

app.post('/api/test/encrypt-for-did', async (req, res, err) => {
    try {
        const did = req.body.did;
        const payload = req.body.payload;
        const encrypted = await encryptFor(JSON.stringify(payload), did, keyGenerators, req.body.encryptForKeyId);
        res.json(encrypted)
    } catch (e) {
        err(e);
    }
});





app.use(express.static('dist/static', {
    extensions: ['html']
}));

// start the Express server
app.listen(port, () => {
    console.log(`server started at http://localhost:${port}`);
});
