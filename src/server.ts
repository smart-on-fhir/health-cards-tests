import axios from 'axios';
import cors from 'cors';
import express from 'express';
import base64url from 'base64url';
import base64 from 'base-64';
import { JWKECKey, JWT } from 'jose';
import * as crypto from 'crypto';
import qs from 'querystring';

import examplePt from './fixtures/patient.json'
import exampleCapabilityStatement from './fixtures/capability-statement.json'

import { VerifierState } from './VerifierState';
import { SiopManager } from './siop';
import { issuerReducer, prepareSiopRequest, issueHealthCardsToHolder, parseSiopResponse, CredentialGenerationDetals, createHealthCards as createHealthCards } from './VerifierLogic';
import { privateJwks, publicJwks } from './config';

const app = express();
app.set('json spaces', 2);
app.use(express.raw({ type: 'application/x-www-form-urlencoded', limit: '5000kb' }));
app.use(express.json({ type: 'application/json', limit: '5000kb'}));
app.use(express.json({ type: 'application/fhir+json', limit: '5000kb'}));
app.use(express.json({ type: 'application/json+fhir', limit: '5000kb'}));
app.use(cors());
const port = 8080; // default port to listen

const fhirBase = 'https://hapi.fhir.org/baseR4';


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


["issuer", "verifier"].forEach(role => {
    const jwksUrl = `${role}/.well-known/jwks.json`;
    app.get('/' + jwksUrl, async (req, res, err) => {
        res.json(publicJwks[role])
    });
});

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

async function getHealthCardsForPatient(patientId, details: CredentialGenerationDetals = {
    type: 'https://smarthealth.cards#covid19',
    presentationContext: 'https://smarthealth.cards#presentation-context-online',
    identityClaims: null,
}) {
    return (await createHealthCards(issuerState, details)).vcs;
}

app.get('/api/fhir/metadata', async (req, res, err) => {
    try {

        const fullUrl = issuerState.config.serverBase;
        const urlFor = relativePath => fullUrl + '/fhir/' + relativePath;

        const implementation = {
            description: exampleCapabilityStatement.implementation.description,
            url: fullUrl + '/fhir'
        }

        const oauthExtension = [
            {
                "url": "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris",
                "extension": [
                    {
                        "url": "authorize",
                        "valueUri": urlFor('$authorize')
                    },
                    {
                        "url": "token",
                        "valueUri": urlFor('$token')
                    }
                ]
            }
        ]

        const exampleRest = exampleCapabilityStatement.rest[0]

        const security = {
            ...exampleRest.security,
            extension: oauthExtension
        }

        const rest = [
            {
                ...exampleRest,
                security: security
            }
        ]

        res.json({
            ...exampleCapabilityStatement,
            implementation,
            rest
        })

    } catch (e) {
        err(e);
    }
});

app.get('/api/fhir/Patient', async (req, res, err) => {
    try {

        const fullUrl = issuerState.config.serverBase;
        const patientID = req.query._id || examplePt.id

        res.json({
            resourceType: 'Bundle',
            entry: [{
                fullUrl: `${fullUrl}/fhir/Patient/${patientID}`,
                search: {
                    mode: "match"
                },
                resource: {
                    ...examplePt,
                    id: patientID
                }
            }]
        })

    } catch (e) {
        err(e);
    }
});

app.get('/api/fhir/Patient/:patientID', async (req, res, err) => {
    try {
    res.json({
        ...examplePt,
        id: req.params.patientID
    })

    } catch (e) {
        err(e);
    }
});

class OperationOutcomeError extends Error {
  public code: string;
  public display: string;
  constructor(code: string, display: string) {
    super();
    this.code = code;
    this.display = display;
  }
}

app.get('/api/fhir/Patient/:patientID/[\$]HealthWallet.covidCardQr', async (req, res, err) => {
    try {
        const requestedCredentialType = ["https://smarthealth.cards#immunization"];
        const requestedPresentationContext = "https://smarthealth.cards#online";

    let vcs = [];
    for (const vcType of requestedCredentialType) {
        const newVcs = await getHealthCardsForPatient(req.params.patientID, {
            type: vcType,
            presentationContext: requestedPresentationContext,
            identityClaims: null,
            holderDid: null
        });
        vcs = [...vcs, ...newVcs]
    }

    res.json({
        'resourceType': 'Parameters',
        'parameter': vcs.map(vc => ({
            'name': 'qr',
            'valueString': vc,
            'debug': vc.length
        }))
    });

    } catch (e) {
        err(e);
    }
});


app.post('/api/fhir/Patient/:patientID/[\$]HealthWallet.issueVc', async (req, res, err) => {
    try {

    const requestBody = (req.body || {})

    if (typeof req.body !== "object"){
        throw "No request body found"
    }

    const requestedCredentialType: string[] = (requestBody.parameter || [])
        .filter(p => p.name === 'credentialType')
        .map(p => p.valueUri);

    if (!requestedCredentialType.length){
        throw "No credentialType found in the Parameters"
    }

    const requestedCredentialIdentityClaims = (requestBody.parameter || [])
        .filter(p => p.name === 'includeIdentityClaim')
        .map(p => p.valueString)

    let vcs = [];
    for (const vcType of requestedCredentialType) {
        const newVcs = await getHealthCardsForPatient(req.params.patientID, {
            type: vcType,
            presentationContext: 'https://smarthealth.cards#presentation-context-online',
            identityClaims: requestedCredentialIdentityClaims.length > 0 ? requestedCredentialIdentityClaims : null,
        });

        if (!newVcs.length) {
            throw "No VC Available matching requested claims, or VC generation failed";
        }
        vcs = [...vcs, ...newVcs]
    }

    res.json({
        'resourceType': 'Parameters',
        'parameter': vcs.map(vc => ({
            'name': 'verifiableCredential',
            'valueAttachment': {
                "data": base64.encode(vc)
            }
        }))
    });

    } catch (e) {
        err(e);
    }
});

const initializeIssuer = async (): Promise<VerifierState> => {
    return {
        siopManager: new SiopManager({signingKey: privateJwks.issuer.keys[0] as JWKECKey}),
        config: {
            serverBase: process.env.SERVER_BASE,
            issuerUrl: process.env.SERVER_BASE.slice(0, -3) + 'issuer',
            claimsRequired: [],
            role: 'issuer',
            responseMode: 'form_post',
            skipVcPostToServer: true,
            postRequest: async (url, body) => {
                return new Promise(resolve => {
                    siopBegin({ body }, { json: resolve });
                });
            },
        },
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

    siopCache[id] = {
        siopStateAfterRequest: {
            siopRequestPayloadSigned: req.body.siopRequest,
            siopRequestPayload: null,
            siopRequestQrCodeUrl: null,
            siopResponsePollingUrl: null
        },
        siopStateAfterResponse: new Promise((resolveFn, rejectFn) => {
            responseResolve = (a) => {
                siopCache[id].responseDeferred.pending = false;
                resolveFn(a);
            };
            responseReject = (a) => {
                siopCache[id].responseDeferred.pending = false;
                rejectFn(a);
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


app.post('/api/test/validate-jws', async (req, res, err) => {
    try {
        const jws = req.body.toString()
        const jwsVerified = await issuerState.siopManager.verifyHealthCardJws(jws);
        res.json(jwsVerified)
    } catch (e) {
        err(e);
    }
});

app.post('/api/test/validate-jwe', async (req, res, err) => {
    try {
        const jwe = req.body.toString()
        const jwsVerified = await issuerState.siopManager.decryptJwe(jwe);
        res.json(jwsVerified)
    } catch (e) {
        err(e);
    }
});

app.use(express.static('dist/static', {
    extensions: ['html']
}));


app.use(function(err, req, res, next) {
  console.error(err)
  res.status(500).json({
  "resourceType": "OperationOutcome",
  "issue": [{
      "severity": "error",
      "code": "processing",
      "diagnostics": err + "\n" + err.message + "\n" + err.stack,
      "details": {
          coding: err.code ? [{
              "system": "https://smarthealth.cards",
              "code": err.code,
              "display": err.display
          }] : undefined
      },
    }]});
})

// start the Express server
app.listen(port, () => {
    console.log(`server started at http://localhost:${port}`);
});
