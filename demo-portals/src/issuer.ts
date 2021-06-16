import jose, { JWK } from 'node-jose';
import pako from 'pako';
import QrCode, { QRCodeSegment } from 'qrcode';
import { Config } from './config';
import { generatePDFCard, generatePDFCardFromQRFile } from './pdf';

// IMPLEMENTERS NOTE: this is a sample only private key, application should take care
// of protecting the issuing signing keys. See, e.g.,
// https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html
import issuerPrivateKey from '../private/issuer.jwks.private.json';


const MAX_SINGLE_JWS_SIZE = 1195;
const MAX_CHUNK_SIZE = 1191;



export function credential(fhirBundle: FhirBundle, issuer: string, types: string[]): HealthCard {
  return {
    iss: issuer,
    nbf: new Date().getTime() / 1000,
    vc: {
      type: ['VerifiableCredential', 'https://smarthealth.cards#health-card', ...types],
      credentialSubject: { fhirVersion: '4.0.1', fhirBundle },
    }
  };
}

export function minify(vc: HealthCard): string {
  return JSON.stringify(vc);
}

export function deflate(payload: string): Buffer {
  return Buffer.from(pako.deflateRaw(payload));
}

export function inflate(payload: string): string {
  return pako.inflateRaw(Buffer.from(payload, 'base64'), { to: 'string' });
}

export async function sign(payload: Buffer, signingKey: Key): Promise<string> {
  const key = await JWK.asKey(signingKey);
  return jose.JWS.createSign({ format: 'compact', fields: { zip: 'DEF' } }, key).update(payload).final() as unknown as string;
}

export function healthCard(jws: string): VerifiableCredential {
  return { verifiableCredential: [jws] }
}

export async function generateHealthCard(fhirBundle: FhirBundle, signingKey: Key) {
  return healthCard(await sign(deflate(minify(credential(fhirBundle, Config.SERVER_BASE, []))), signingKey));
}

function partitionJws(jws: string): string[] {
  if (jws.length <= MAX_SINGLE_JWS_SIZE) return [jws];
  return jws.match(new RegExp(`.{1,${Math.ceil(jws.length / Math.ceil(jws.length / MAX_CHUNK_SIZE))}}`, 'g')) || [];
}

export function numeric(jws: string): QRCodeSegment[][] {
  return partitionJws(jws).map((subJws, chunkIndex, arr) => {
    const SMALLEST_B64_CHAR_CODE = 45; // "-" === 45
    const totalChunks = arr.length;
    return [
      { data: 'shc:/' + ((totalChunks > 1) ? `${chunkIndex + 1}/${totalChunks}/` : ``), mode: 'byte' },
      {
        data: subJws
          .split('')
          .map(c => c.charCodeAt(0) - SMALLEST_B64_CHAR_CODE)
          .flatMap(c => [Math.floor(c / 10), c % 10])
          .join(''),
        mode: 'numeric',
      }
    ];
  });
}

export function qr(segments: QRCodeSegment[][]): Promise<string[]> {
  return Promise.all(segments.map(segment => QrCode.toDataURL(segment, { errorCorrectionLevel: 'low' })));
}

export function shcToSegments(shcArray: string[]): QRCodeSegment[][] {
  return shcArray.map(s => {
    const split = s.lastIndexOf('/') + 1;
    return [{ data: s.slice(0, split), mode: 'byte' }, { data: s.slice(split), mode: 'numeric' }];
  });
}
