// ----------------------------------------------------------------------
// Simple test server for SMART Health Card operations
// This code is for illustration purposes only, it shouldn't be used in 
// productions. See the IMPLEMENTERS NOTE comments for things
// that would need to be implemented in a real-life system
// ----------------------------------------------------------------------

import express from 'express';
import { Config } from './config';
import fs from 'fs';
import http from 'http';
import got from 'got';
import { validate, ValidationProfiles, Validators, IOptions } from 'health-cards-validation-sdk/js/src/api';
import * as issuer from './issuer';


const app = express();
app.use(express.json()) // for parsing application/json
app.use(express.static('./public')) // issuer public key set
app.use(express.static('./cards'))  // issued card files


app.post(Config.VALIDATE_FHIR_BUNDLE, async (req, res) => {
    console.log('Received POST for', Config.VALIDATE_FHIR_BUNDLE, req.body);
    const fhir = req.body.fhir;

    let options: Partial<IOptions> = { cascade: false };
    switch (req.body.profile) {

        case 'profile:any':
            break;

        case 'profile:usa-covid19-immunization':
            options = { ...{ profile: ValidationProfiles['usa-covid19-immunization'] } };
            break;

        case 'validator:fhirvalidator':
            options = { ...{ validator: Validators.fhirvalidator } };
    }

    const errors = await validate.fhirbundle(fhir, options);
    res.type('json');
    res.send({ success: errors.length === 0, errors: errors });
});


app.post(Config.VALIDATE_QR_NUMERIC, async (req, res) => {
    console.log('Received POST for', Config.VALIDATE_QR_NUMERIC, req.body);
    const shc = req.body.data;
    const errors = await validate.qrnumeric(shc, { cascade: false });
    res.type('json');
    res.send({ success: errors.length === 0, errors: errors });
});


app.post(Config.VALIDATE_JWS, async (req, res) => {
    console.log('Received POST for', Config.VALIDATE_JWS, req.body);
    const jws = req.body.payload;
    const issuerDirectory = req.body.directory || '';
    const errors = await validate.jws(jws, { issuerDirectory, cascade: false });
    res.type('json');
    res.send({ success: errors.length === 0, errors: errors });
});


app.post(Config.VALIDATE_PAYLOAD, async (req, res) => {
    console.log('Received POST for', Config.VALIDATE_PAYLOAD, req.body);
    const payload = req.body.payload;
    const errors = await validate.jwspayload(payload, { cascade: false });
    res.type('json');
    res.send({ success: errors.length === 0, errors: errors });
});


app.post(Config.VALIDATE_KEYSET, async (req, res) => {
    console.log('Received POST for', Config.VALIDATE_KEYSET, req.body);
    const keyset = req.body.data;
    const errors = await validate.keyset(keyset, { ...{validationTime: "1653955200" /* 2022-05-31 */} });
    res.type('json');
    res.send({ success: errors.length === 0, errors: errors });
});


app.post(Config.CREATE_VC, async (req, res) => {
    console.log('Received POST for', Config.CREATE_VC, req.body);
    const result = issuer.credential(req.body.fhir, req.body.issuer, []);
    res.type('json');
    res.send(result);
});


app.post(Config.DEFLATE_PAYLOAD, async (req, res) => {
    console.log('Received POST for', Config.DEFLATE_PAYLOAD, req.body);
    const payload = JSON.stringify(req.body.vc);
    const result = issuer.deflate(payload);
    res.send(Buffer.from(result as Uint8Array));
});

app.post(Config.INFLATE_PAYLOAD, async (req, res) => {
    console.log('Received POST for', Config.INFLATE_PAYLOAD, req.body);
    const payload = JSON.stringify(req.body.payload);
    let result;
    try {
        result = issuer.inflate(payload);
    } catch {
        result = undefined;
    }
    res.send(result);
});


app.post(Config.SMART_HEALTH_CARD, async (req, res) => {
    console.log('Received POST for', Config.SMART_HEALTH_CARD, req.body);
    const jws = req.body.jws;
    const result = issuer.healthCard(jws);
    res.send(result);
});


app.post(Config.SIGN_PAYLOAD, async (req, res) => {
    console.log('Received POST for', Config.SIGN_PAYLOAD, req.body);
    const payloadJson = Buffer.from(req.body.payload, 'base64');
    const result = await issuer.sign(payloadJson, req.body.key);
    res.type('text');
    res.send(result);
});


app.post(Config.NUMERIC_ENCODE, async (req, res) => {
    console.log('Received POST for', Config.NUMERIC_ENCODE, req.body);
    const jws = req.body.jws;
    const segments = issuer.numeric(jws) as { data: string, mode: string }[][];
    const output = segments.map(s => s[0].data + s[1].data);
    res.send(output);
});


app.post(Config.GENERATE_QR_CODE, async (req, res) => {
    console.log('Received POST for', Config.GENERATE_QR_CODE, req.body);
    const shc: string[] = req.body.shc;
    const segments = issuer.shcToSegments(shc);
    let output: string[];
    try {
        output = await issuer.qr(segments);
    } catch {
        output = [];
    }
    res.send(output);
});


app.post(Config.DOWNLOAD_PUBLIC_KEY, async (req, res) => {

    console.log('Received POST for', Config.DOWNLOAD_PUBLIC_KEY, req.body);

    const publicKeyUrl = req.body.keyUrl;

    let result: { keySet: string, error: string[] } = { keySet: "", error: [] };
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


app.post(Config.UPLOAD_PUBLIC_KEY, async (req, res) => {
    console.log('Received POST for', Config.UPLOAD_PUBLIC_KEY, req.body);
    const publicKey = JSON.stringify(req.body.pk);
    fs.writeFileSync('./public/issuer/.well-known/jwks.json', publicKey);
    res.send();
});


app.post(Config.CHECK_TRUSTED_DIRECTORY, async (req, res) => {
    console.log('Received POST for', Config.CHECK_TRUSTED_DIRECTORY, req.body);
    const url = req.body.url;
    const issuerDirectory = req.body.directory;
    const errors = issuerDirectory ? await validate.checkTrustedDirectory(url, { issuerDirectory, cascade: false }) : [];
    res.type('json');
    res.send({ success: errors.length === 0, errors: errors });
});


http.createServer(app).listen(Config.SERVICE_PORT, () => {
    const url = Config.SERVER_BASE;
    console.log("Service listening at " + url);
    console.log("\nVerifierPortal:  " + url + 'VerifierPortal.html');
    console.log("DevPortal:  " + url + 'DevPortal.html');
});
