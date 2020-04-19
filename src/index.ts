import express from 'express';
import qs from "querystring"
import * as FHIR from 'fhirclient';
import axios from 'axios';
import jose, { JWT } from 'jose';
import cors from 'cors'

import Did from '../sidetree/lib/core/versions/latest/Did';
import Multihash from '../sidetree/lib/core/versions/latest/Multihash';
import Jwk from '../sidetree/lib/core/versions/latest/util/Jwk';
import JwkEs256k from '../sidetree/lib/core/models/JwkEs256k';
import * as crypto from 'crypto';
import base64url from 'base64url';
import OperationType from '../sidetree/lib/core/enums/OperationType';
import OperationProcessor from '../sidetree/lib/core/versions/latest/OperationProcessor';
import AnchoredOperationModel from '../sidetree/lib/core/models/AnchoredOperationModel';
import DocumentComposer from '../sidetree/lib/core/versions/latest/DocumentComposer';
import multihashes from 'multihashes'

import * as s1 from '../sidetree/lib/core/versions/latest/protocol-parameters.json';
import * as s2 from '../sidetree/lib/bitcoin/protocol-parameters.json';

const app = express();
app.use(express.raw({ type: 'application/x-www-form-urlencoded' }));
app.use(express.json({ type: 'application/json' }));
app.use(cors())
const port = 8080; // default port to listen

const fhirBase = 'https://hapi.fhir.org/baseR4';

// const serverKey = jose.JWK.generateSync("EC", "secp256k1", {use: "sig"})
//const clientKey = jose.JWK.generateSync('EC', 'secp256k1');
const encryptionKey = jose.JWK.generateSync('RSA');
console.log('HHWJ', encryptionKey.toJWK());

const clientKey = jose.JWK.asKey({"kty":"EC","crv":"secp256k1","x":"vinXT4pDGmlTsxchlg2PWLkJ5QGRjPvamh8pOClOBsA","y":"PDBCs2Ew_UrEPPUsJVZGX3qFrt1DbubR1Qk5asJ4KhE","d":"mwk8353HfIVckgTtl1gJxGfzEEsFsrF3fB6ZkGqnWaA"})
console.log("CK", clientKey.private)

const ts = "eyJoZWFlciI6ImhlcmUiLCJhbGciOiJFUzI1NksifQ.eyJiZHkiOiJUaG9pd2VqZm93ZXVqZiBvd2llaGYgb2l3ZXVoZiBpd3VlZmggaXdldWZoIGl3ZW91Zmggd2Vpb3VmaCB3aWV1Zmggd2lldWZoIGF3ZWl1Zmggd2lldWhmIGl3ZXVoZiBpd3VlaGYgaXdldWhmIHdpYWV1aCBmaXdlaGhoZSBidXQgYnJUaG9pd2VqZm93ZXVqZiBvd2llaGYgb2l3ZXVoZiBpd3VlZmggaXdldWZoIGl3ZW91Zmggd2Vpb3VmaCB3aWV1Zmggd2lldWZoIGF3ZWl1Zmggd2lldWhmIGl3ZXVoZiBpd3VlaGYgaXdldWhmIHdpYWV1aCBmaXdlaGhoZSBidXQgYnJlZSJ9.NU9zsAp7xpTJ83A8uyoP3EeZxhMFwoqtxiRhV-hRTJIlbYNdo_PHdpGLd66r7-m9U4Q9w92659Pk5qfCfuX6Cw";
console.log("Verified", JWT.verify(ts, clientKey))


async function resolveDid (did: string) {
  const parsedDid = await Did.create(did, 'did:ion:');
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

async function f () {
  const recoveryPrivateKey: JwkEs256k = { ...jose.JWK.generateSync('EC', 'secp256k1').toJWK(), kid: undefined } as JwkEs256k;
  const recoveryPublicKey: JwkEs256k = { ...recoveryPrivateKey, d: undefined };

  const signingPrivateKey = recoveryPrivateKey;
  const signingPublicKey = recoveryPublicKey;

  const hashAlgorithmName = multihashes.codes[18];
  const hash = (b: Buffer) => multihashes.encode(crypto.createHash('sha256').update(b).digest(), hashAlgorithmName);

  const revealCommitPair = () => {
      const revealValueBuffer = crypto.randomBytes(32);
      const revealValueEncodedString = base64url.encode(revealValueBuffer);
      const commitmentHash = hash(revealValueBuffer); // 18 = SHA256;
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
                  id: 'main-ops-key',
                  usage: ['ops', 'general', 'auth'],
                  type: 'Secp256k1VerificationKey2019',
                  jwk: signingPublicKey
                }, {
                  id: 'k2',
                  usage: ['general', 'auth'],
                  type: 'JwsVerificationKey2020',
                  jwk: encryptionKey.toJWK()
                }],
              serviceEndpoints: []
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
  console.log(didShort);

  const createOperation = {
      type: 'create',
      suffix_data: suffixDataEncoded,
      delta: deltaEncoded
    };
  const createOperationCanonical = JSON.stringify(createOperation);
  const createOperationEncoded = base64url.encode(createOperationCanonical);
  const didLong = `did:ion:${suffix}?-ion-initial-state=${createOperationEncoded}`;
  console.log(JSON.stringify(await resolveDid(didLong), null, 2));

}

f();

const client = {
  get: async (url: string) => (await axios.get(fhirBase + '/' + url)).data
};

const siopCache: Record<string,{ttl: number, siopRequest: string, siopResponse?: any}> = { }
const ttlMs = 1000 * 60 * 15 // 15 minute ttl
function enforceTtl(cache: Record<string, {ttl: number}>){
    const now = new Date().getTime()
    Object.entries(cache).forEach(([k,{ttl}])=>{
        if (ttl < now) {
            delete cache[k]
        }
    })
}
setInterval(() => enforceTtl(siopCache), 1000 * 60)

app.post('/siop/begin', async (req, res) => {
    const id: string = (JWT.decode(req.body.siopRequest) as any).state
    
    siopCache[id] = {
        siopRequest: req.body.siopRequest,
        siopResponse: null,
        ttl: new Date().getTime() + ttlMs
    }
    console.log(id, siopCache[id])
    
    res.json({
        responsePollingUrl: `/siop/${id}/response`,
        ...siopCache[id]
    })
});

app.get('/siop/:id/response', async (req, res) => {
    const r = siopCache[req.params.id]
    res.send(r.siopResponse)
});

app.get('/siop/:id', async (req, res) => {
    const r = siopCache[req.params.id]
    res.send(r.siopRequest)
});

app.post('/siop', async (req, res) => {
    const body = qs.parse(req.body.toString())
    const state = body.state as string
    siopCache[state].siopResponse = body
    res.send("Received SIOP Response")
});


app.get('/did/:did', async (req, res) => {
    const didLong = req.params.did + '?-ion-initial-state=' + req.query['-ion-initial-state']
    console.log("req", req.params, '-<', didLong)
    const didDoc = await resolveDid(didLong)
    res.json(didDoc.didDocument)
});

app.post('/vcs', async (req, res) => {
  const did = req.body.toString();
  const signed = jose.JWS.sign({ 'vc': 'test' }, clientKey, {});
  const encrypted = jose.JWE.encrypt(signed, encryptionKey, { kid: clientKey.kid });
  console.log(did);

  res.json({ 'x': encrypted });
});

// define a route handler for the default home page
app.get('/', async (req, res) => {
  const patients = await client.get('Patient');
  console.log('Patients', patients);
  res.send(JSON.stringify(patients, null, 2));
});

// start the Express server
app.listen(port, () => {
  console.log(`server started at http://localhost:${port}`);
});
