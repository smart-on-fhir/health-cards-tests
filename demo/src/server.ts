// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// ----------------------------------------------------------------------
// Simple test server for SMART Health Card operations
// This code is for illustration purposes only, it shouldn't be used in 
// productions. See the IMPLEMENTERS NOTE comments for things
// that would need to be implemented in a real-life system
// ----------------------------------------------------------------------

import express from 'express';
import { Config } from './config';
import { generateHealthCard } from './issuer';
import { toFhirBundle } from './fhir';
import { validateHealthCard, validateQRCodes } from './verifier';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import https from 'https';
import http from 'http';
import pako from 'pako';
import got from 'got';
import { validate } from 'health-cards-validation-sdk/js/src/api';


var privateKey = fs.readFileSync('./private/localhost.key', 'utf8');
var certificate = fs.readFileSync('./public/localhost.crt', 'utf8');
var credentials = { key: privateKey, cert: certificate };

const app = express();
app.use(express.json()) // for parsing application/json
app.use(express.static('./public')) // issuer public key set
app.use(express.static('./cards'))  // issued card files

// called by issuer to generate a health card and QR code
// IMPLEMENTERS NOTE: This call will generate a health card and QR code for the
// given input. A real system would need to authenticate the client somehow. 
// Clients can download the resulting card data using the returned session ID
// (very simple authorization demo strategy)
// - input: JSON-encoded HealthCardData
// - output: JSON {ID: <uuid>}
app.post(Config.ISSUE_HEALTH_CARD_ENDPOINT, (req, res) => {
    console.log('Received POST for', Config.ISSUE_HEALTH_CARD_ENDPOINT, req.body);
    const hcData = req.body as HealthCardData;
    const uuid = uuidv4();
    try {
        const fhirBundle = toFhirBundle(hcData);

        generateHealthCard(fhirBundle, hcData, 'cards', uuid);
        res.json({ id: `${uuid}` });
    } catch (err) {
        res.json({ err: `${err}` });
    }
})

// called by clients to retrieve health cards file
// input: query param ID=<downloadID>
// output: smart health card file
app.get(Config.DOWNLOAD_HEALTH_CARD_FILE_ENDPOINT, (req, res) => {
    console.log('Received GET for', Config.DOWNLOAD_HEALTH_CARD_FILE_ENDPOINT, req.query);
    res.type('application/smart-health-card');
    res.download(`cards/${req.query.id}.smart-health-card`, 'my.smart-health-card');
})

// called by clients to retrieve health card QR code
// input: query param ID=<downloadID>
// output: QR code file
app.get(Config.DOWNLOAD_HEALTH_CARD_QRCODE_ENDPOINT, (req, res) => {
    console.log('Received GET for', Config.DOWNLOAD_HEALTH_CARD_QRCODE_ENDPOINT, req.query);
    res.type('png');
    res.download(`cards/${req.query.id}-0.png`, 'healthCardQR.png'); // TODO (how to deal with multi-files chunked QR codes?)
})

// called by clients to retrieve health card PDF file
// input: query param ID=<downloadID>
// output: PDF file
app.get(Config.DOWNLOAD_HEALTH_CARD_PDF_ENDPOINT, (req, res) => {
    console.log('Received GET for', Config.DOWNLOAD_HEALTH_CARD_PDF_ENDPOINT, req.query);
    res.type('pdf');
    res.download(`cards/${req.query.id}-0.pdf`, 'healthCard.pdf');
})

// called by verifiers to validate a health card file
// input: health card file
// output: ValidationResult (health card + status)
app.post(Config.VALIDATE_HEALTH_CARD_FILE_ENDPOINT, (req, res) => {
    console.log('Received POST for', Config.VALIDATE_HEALTH_CARD_FILE_ENDPOINT, req.body);
    const healthCard: string = req.body;
    validateHealthCard(healthCard).then(validationData => {
        res.type('json');
        res.send(validationData);
    }).catch(reason => {
        console.log(reason)
        res.type('json');
        res.send({ error: 'Error parsing QR code' });
    })
})

// called by verifiers to validate a health card QR code
// input: JSON: numeric QR code array
// ouput: ValidationResult (health card + status)
app.post(Config.VALIDATE_HEALTH_CARD_QRCODE_ENDPOINT, (req, res) => {
    console.log('Received POST for', Config.VALIDATE_HEALTH_CARD_QRCODE_ENDPOINT, req.body)
    const qrCodes: string[] = req.body.qr;
    validateQRCodes(qrCodes).then(validationData => {
        res.type('json');
        res.send(validationData);
    }).catch(reason => {
        console.log(reason)
        res.type('json');
        res.send({ error: 'Error parsing QR code' });
    })
});


/// ======================= Dev Portal Calls ======================================================

// TODO: document the dev API calls

// import { validate } from 'health-cards-validation-sdk';

app.post(Config.VALIDATE_FHIR_BUNDLE, async (req, res) => {

    console.log('Received POST for', Config.VALIDATE_FHIR_BUNDLE, req.body);

    const fhirJson = req.body.data;
    const errors = await validate.fhirbundle(fhirJson);

    res.type('json');
    res.send({ success: errors.length === 0, errors: errors });

});


app.post(Config.VALIDATE_QR_NUMERIC, async (req, res) => {

    console.log('Received POST for', Config.VALIDATE_QR_NUMERIC, req.body);

    const shc = req.body.data;
    const errors = await validate.qrnumeric(shc);

    res.type('json');
    res.send({ success: errors.length === 0, errors: errors });

});


app.post(Config.VALIDATE_JWS, async (req, res) => {

    console.log('Received POST for', Config.VALIDATE_JWS, req.body);

    const jws = req.body.data;
    const errors = await validate.jws(jws);

    res.type('json');
    res.send({ success: errors.length === 0, errors: errors });

});


app.post(Config.VALIDATE_PAYLOAD, async (req, res) => {

    console.log('Received POST for', Config.VALIDATE_PAYLOAD, req.body);

    const payload = req.body.data;
    const errors = await validate.jwspayload(payload);

    res.type('json');
    res.send({ success: errors.length === 0, errors: errors });

});


app.post(Config.VALIDATE_KEYSET, async (req, res) => {

    console.log('Received POST for', Config.VALIDATE_KEYSET, req.body);

    const keyset = req.body.data;
    const errors = await validate.keyset(keyset);

    res.type('json');
    res.send({ success: errors.length === 0, errors: errors });

});


app.post(Config.CREATE_VC, async (req, res) => {

    console.log('Received POST for', Config.CREATE_VC, req.body);

    const result = await createVc(req.body.fhir, req.body.issuer);

    res.type('json');
    res.send(result);

});


app.post(Config.DEFLATE_PAYLOAD, async (req, res) => {

    console.log('Received POST for', Config.DEFLATE_PAYLOAD, req.body);

    const payload = JSON.stringify(req.body.vc);
    const result = await deflatePayload(payload);

    res.send(Buffer.from(result as Uint8Array));

});

app.post(Config.INFLATE_PAYLOAD, async (req, res) => {

    console.log('Received POST for', Config.INFLATE_PAYLOAD, req.body);

    const payload = JSON.stringify(req.body.payload);
    const result = await inflatePayload(payload);

    res.send(result);

});


app.post(Config.SMART_HEALTH_CARD, async (req, res) => {

    console.log('Received POST for', Config.SMART_HEALTH_CARD, req.body);
    const jws = req.body.jws;
    res.type('json');
    res.send({ "verifiableCredential": [jws] });

});


app.post(Config.SIGN_PAYLOAD, async (req, res) => {

    console.log('Received POST for', Config.SIGN_PAYLOAD, req.body);

    const payloadJson = Buffer.from(req.body.payload, 'base64');

    const result = await signJws(payloadJson, req.body.key);

    res.type('text');
    res.send(result);

});


app.post(Config.NUMERIC_ENCODE, async (req, res) => {

    console.log('Received POST for', Config.NUMERIC_ENCODE, req.body);
    const shc = req.body.shc;

    const output = [];
    for (let i = 0; i < shc.length; i++) {
        const char = shc.charCodeAt(i) - 45;
        output.push(Math.trunc(char / 10), char % 10);
    }
    res.send("shc:/" + output.join(''));

});


import QrCode, { QRCodeSegment } from 'qrcode';
app.post(Config.GENERATE_QR_CODE, async (req, res) => {

    console.log('Received POST for', Config.GENERATE_QR_CODE, req.body);
    const shc = req.body.shc.split('/');

    QrCode.toDataURL([{ data: shc[0] + "/", mode: 'byte' }, { data: shc[1], mode: 'numeric' }], { errorCorrectionLevel: 'low' }).then(
        url => res.send(url)
    );

});


app.post(Config.DOWNLOAD_PUBLIC_KEY, async (req, res) => {

    console.log('Received POST for', Config.DOWNLOAD_PUBLIC_KEY, req.body);

    const publicKeyUrl = req.body.keyUrl;

    let result : {keySet: string, error : string[]} = {keySet: "", error : []};
    let response;

    try {
        response = await got(publicKeyUrl, { https: { rejectUnauthorized: false } });
    } catch (err) {
        result.error = ["Can't download issuer key from : " + publicKeyUrl + " : " + err];
        res.send(result);
        return;
    }

    try {
        result.keySet = JSON.parse(response.body);
    } catch (err) {
        result.error = ["Can't parse key set as JSON : " + response.body + " : " + err];
        res.send(result);
        return;
    }

    res.send(result);
});


const httpServer = http.createServer(app).listen(Config.SERVICE_PORT, () => {
    const address = httpServer.address() as unknown as { address: string, family: string, port: string };
    const host = address.address === '::' ? 'localhost' : address.address;
    const port = address.port === '80' ? '' : ':' + address.port;
    const url = `http://${host}${port}`;
    if (!Config.ISSUER_URL) {
        Config.ISSUER_URL = url;
    }
    console.log("Demo service listening at " + url);
    console.log("\nIssuerPortal:  " + url + '/IssuerPortal.html');
    console.log("\nVerifierPortal:  " + url + '/VerifierPortal.html');
    console.log("DevPortal:  " + url + '/DevPortal.html');
});


const httpsServer = https.createServer(credentials, app).listen(Config.SERVICE_PORT_HTTPS, () => {
    const address = httpsServer.address() as unknown as { address: string, family: string, port: string };
    const host = address.address === '::' ? 'localhost' : address.address;
    const port = address.port === '80' ? '' : ':' + address.port;
    const url = `https://${host}${port}`;
    if (!Config.ISSUER_URL) {
        Config.ISSUER_URL = url;
    }
    console.log("\n\nDemo service listening at " + url);
    console.log("\nIssuerPortal:  " + url + '/IssuerPortal.html');
    console.log("\nVerifierPortal:  " + url + '/VerifierPortal.html');
    console.log("DevPortal:  " + url + '/DevPortal.html');
});


import jose, { JWK } from 'node-jose';


async function signJws(payload: Buffer, signingKey: JWK.Key): Promise<string> {
    let fields = { zip: 'DEF' };
    let signed = await jose.JWS.createSign({ format: 'compact', fields }, signingKey).update(payload).final();
    return signed as unknown as string;
}


async function createVc(fhirBundle: FhirBundle, issuer: string): Promise<object> {

    const vc = {
        "iss": issuer ? "https://" + issuer : "https://contoso.com/issuer",
        "nbf": Number(new Date()),
        "vc": {
            "@context": [
                "https://www.w3.org/2018/credentials/v1"
            ],
            "type": [
                "VerifiableCredential",
                "https://smarthealth.cards#health-card",
                "https://smarthealth.cards#immunization",
                "https://smarthealth.cards#covid19"
            ],
            "credentialSubject": {
                "fhirVersion": "4.0.1",
                "fhirBundle": fhirBundle
            }
        }
    };

    return vc;
}


async function deflatePayload(payload: string): Promise<object> {
    const body = pako.deflateRaw(payload);
    return body;
}

async function inflatePayload(payload: string): Promise<string> {
    const body = pako.inflateRaw(Buffer.from(payload, 'base64'), { to: 'string' });
    return body;
}
