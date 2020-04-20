import axios from 'axios';
import cors from 'cors';
import express from 'express';
import { JWT } from 'jose';
import qs from 'querystring';
import OperationType from '../sidetree/lib/core/enums/OperationType';
import AnchoredOperationModel from '../sidetree/lib/core/models/AnchoredOperationModel';
import Did from '../sidetree/lib/core/versions/latest/Did';
import DocumentComposer from '../sidetree/lib/core/versions/latest/DocumentComposer';
import OperationProcessor from '../sidetree/lib/core/versions/latest/OperationProcessor';

const app = express();
app.use(express.raw({ type: 'application/x-www-form-urlencoded' }));
app.use(express.json({ type: 'application/json' }));
app.use(cors());
const port = 8080; // default port to listen

const fhirBase = 'https://hapi.fhir.org/baseR4';

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

const client = {
  get: async (url: string) => (await axios.get(fhirBase + '/' + url)).data
};

const siopCache: Record<string,{ttl: number, siopRequest: string, siopResponse?: any}> = { };
const ttlMs = 1000 * 60 * 15; // 15 minute ttl
function enforceTtl (cache: Record<string, {ttl: number}>) {
    const now = new Date().getTime();
    Object.entries(cache).forEach(([k,{ ttl }]) => {
        if (ttl < now) {
            delete cache[k];
        }
    });
}
setInterval(() => enforceTtl(siopCache), 1000 * 60);

app.post('/api/siop/begin', async (req, res) => {
    const id: string = (JWT.decode(req.body.siopRequest) as any).state;

    siopCache[id] = {
        siopRequest: req.body.siopRequest,
        siopResponse: null,
        ttl: new Date().getTime() + ttlMs
    };
    console.log(id, siopCache[id]);

    res.json({
        responsePollingUrl: `/siop/${id}/response`,
        ...siopCache[id]
    });
});

app.get('/api/siop/:id/response', async (req, res) => {
    const r = siopCache[req.params.id];
    res.send(r.siopResponse);
});

app.get('/api/siop/:id', async (req, res) => {
    const r = siopCache[req.params.id];
    res.send(r.siopRequest);
});

app.post('/api/siop', async (req, res) => {
    const body = qs.parse(req.body.toString());
    const state = body.state as string;
    siopCache[state].siopResponse = body;
    res.send('Received SIOP Response');
});

app.get('/api/did/:did', async (req, res) => {
    const didLong = req.params.did + '?-ion-initial-state=' + req.query['-ion-initial-state'];
    console.log('req', req.params, '-<', didLong);
    const didDoc = await resolveDid(didLong);
    res.json(didDoc.didDocument);
});

app.use(express.static('dist/static', {
    extensions: ['html']
}));

// start the Express server
app.listen(port, () => {
  console.log(`server started at http://localhost:${port}`);
});
