// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import jose, { JWK } from 'node-jose';
import pako from 'pako';
import QrCode, { QRCodeSegment } from 'qrcode';
import {Bundle, Entry} from './fhir';
import {Config} from './config';
import {generatePDFCard, generatePDFCardFromQRFile} from './pdf';

// IMPLEMENTERS NOTE: this is a sample only private key, application should take care
// of protecting the issuing signing keys. See, e.g.,
// https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html
import issuerPrivateKey from '../private/issuer.jwks.private.json';

interface StringMap {
  [k: string]: string;
}

export class Signer {
  public keyStore: jose.JWK.KeyStore;
  public signingKey: JWK.Key;

  constructor({ keyStore, signingKey }: { signingKey: JWK.Key; keyStore?: JWK.KeyStore }) {
    this.keyStore = keyStore || jose.JWK.createKeyStore();
    this.signingKey = signingKey;
  }

  async signJws(idTokenPayload: Record<string, unknown>, deflate = true): Promise<string> {
    const bodyString = JSON.stringify(idTokenPayload);

    const fields = deflate ? { zip: 'DEF' } : {};
    const body = deflate ? pako.deflateRaw(bodyString) : bodyString;

    const signed = await jose.JWS.createSign({ format: 'compact', fields }, this.signingKey)
      .update(Buffer.from(body))
      .final();
    return (signed as unknown) as string;
  }
}

async function trimBundleForHealthCard(bundleIn: Bundle) {
  const bundle: Bundle = JSON.parse(JSON.stringify(bundleIn)) as Bundle;
  delete bundle.id;
  delete bundle.meta;

  const resourceUrlMap: StringMap = bundle.entry
    .map((e, i) => [e.fullUrl.split('/').slice(-2).join('/'), `resource:${i}`])
    .reduce((acc: StringMap, [a, b]) => {
      acc[a] = b;
      return acc;
    }, {});

  delete bundle.id;
  bundle.entry.forEach((e) => {
    e.fullUrl = resourceUrlMap[e.fullUrl.split('/').slice(-2).join('/')];
    function clean(r: any, path: string[] = ['Resource']) {

      if (r.resourceType === 'Patient') {
        // TODO remove these `delete`s once sample bundles are aligned
        // with the "name + DOB" profiling guidance
        delete r.telecom;
        delete r.communication;
        delete r.address;
      }

      if (path.length === 1) {
        delete r.id;
        delete r.meta;
        delete r.text;
      }
      if (resourceUrlMap[r.reference]) {
        r.reference = resourceUrlMap[r.reference];
      } else if (r?.reference?.startsWith("Patient")) {
        //TODO remove this branch when DVCI bundles are fixed
        r.reference = 'resource:0'
      }
      if (r.coding) {
        delete r.text;
      }

      if (r.system && r.code) {
        delete r.display;
      }
      if (Array.isArray(r)) {
        r.forEach((e) => clean(e, path));
      } else if (r !== null && typeof r === 'object') {
        Object.keys(r).forEach((k) => clean(r[k], [...path, k]));
      }
    }
    clean(e.resource);
  });

  return bundle;
}

function createHealthCardJwsPayload(fhirBundle: Bundle, types: string[]): Record<string, unknown> {
  return {
    iss: Config.ISSUER_URL,
    nbf: new Date().getTime() / 1000,
    vc: {
      type: [
        'VerifiableCredential',
        'https://smarthealth.cards#health-card',
        ...types
      ],
      credentialSubject: {
        fhirVersion: '4.0.1',
        fhirBundle,
      },
    },
  };
}

const MAX_SINGLE_JWS_SIZE = 1195;
const MAX_CHUNK_SIZE = 1191;
const splitJwsIntoChunks = (jws: string): string[] => {
  if (jws.length <= MAX_SINGLE_JWS_SIZE) {
    return [jws];
  }

  // Try to split the chunks into roughly equal sizes.
  const chunkCount = Math.ceil(jws.length / MAX_CHUNK_SIZE);
  const chunkSize = Math.ceil(jws.length / chunkCount);
  const chunks = jws.match(new RegExp(`.{1,${chunkSize}}`, 'g'));
  return chunks || [];
}

async function createHealthCardFile(jwsPayload: Record<string, unknown>): Promise<Record<string, any>> {
  const signer = new Signer({ signingKey: await JWK.asKey(issuerPrivateKey) });
  const signed = await signer.signJws(jwsPayload);
  return {
    verifiableCredential: [signed],
  };
}

const SMALLEST_B64_CHAR_CODE = 45; // "-".charCodeAt(0) === 45
const toNumericQr = (jws: string, chunkIndex: number, totalChunks: number): QRCodeSegment[] => [
  { data: 'shc:/' + ((totalChunks > 1) ? `${chunkIndex + 1}/${totalChunks}/` : ``), mode: 'byte' },
  {
    data: jws
      .split('')
      .map((c) => c.charCodeAt(0) - SMALLEST_B64_CHAR_CODE)
      .flatMap((c) => [Math.floor(c / 10), c % 10])
      .join(''),
    mode: 'numeric',
  },
];

export async function generateHealthCard(fhirBundle: Bundle, hcData: HealthCardData, outputPath: string, userFileId: string) {
    let types = [
        'https://smarthealth.cards#immunization',
        'https://smarthealth.cards#covid19',
      ];
    
    const trimmedBundle = await trimBundleForHealthCard(fhirBundle);
    const jwsPayload = createHealthCardJwsPayload(trimmedBundle, types);
    const healthCardFile = await createHealthCardFile(jwsPayload);
    const healthCardFilename = `${userFileId}.smart-health-card`;
    fs.writeFileSync(`${outputPath}/${healthCardFilename}`, JSON.stringify(healthCardFile, null, 2));
    const jws = healthCardFile.verifiableCredential[0] as string;
    const jwsChunks = splitJwsIntoChunks(jws);
    const qrSet = jwsChunks.map((c, i, chunks) => toNumericQr(c, i, chunks.length));

    qrSet.map((qrSegments, i) => {
      QrCode.toFile(`${outputPath}/${userFileId}-${i}.png`, 
        qrSegments, { type: 'png', errorCorrectionLevel: 'low' }).then(
          () => generatePDFCardFromQRFile(hcData, `${outputPath}/${userFileId}-0.png`, `${outputPath}/${userFileId}-0.pdf`)
        );
    });
    
}
