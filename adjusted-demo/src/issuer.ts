import jose, { JWK } from 'node-jose';
import pako from 'pako';
import QrCode, { QRCodeSegment } from 'qrcode';
import { Config } from './config';
// import { generatePDFCard, generatePDFCardFromQRFile } from './pdf';

// IMPLEMENTERS NOTE: this is a sample only private key, application should take care
// of protecting the issuing signing keys. See, e.g.,
// https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html
// import issuerPrivateKey from '../private/issuer.jwks.private.json';


const MAX_SINGLE_JWS_SIZE = 1195;
const MAX_CHUNK_SIZE = 1191;

// CDC covid vaccine codes (https://www.cdc.gov/vaccines/programs/iis/COVID-19-related-codes.html)
export const cdcCovidCvxCodes = ["207", "208", "210", "211", "212"];

// LOINC covid test codes (https://vsac.nlm.nih.gov/valueset/2.16.840.1.113762.1.4.1114.9/expansion)
export const loincCovidTestCodes = ["50548-7", "68993-5", "82159-5", "94306-8", "94307-6", "94308-4", "94309-2", "94500-6", "94502-2", "94503-0", "94504-8", "94507-1", "94508-9", "94531-1", "94533-7", "94534-5", "94547-7", "94558-4", "94559-2", "94562-6", "94563-4", "94564-2", "94565-9", "94640-0", "94661-6", "94756-4", "94757-2", "94758-0", "94759-8", "94760-6", "94761-4", "94762-2", "94764-8", "94845-5", "95209-3", "95406-5", "95409-9", "95416-4", "95423-0", "95424-8", "95425-5", "95542-7", "95608-6", "95609-4"];

interface VaccineCode { "coding": { code: string }[] }

export function credential(fhirBundle: FhirBundle, issuer: string, types: string[]): HealthCard {

  const hasImmunization = fhirBundle?.entry?.some(entry => entry?.resource?.resourceType === 'Immunization');

  const hasCovidImmunization = fhirBundle?.entry?.some(entry =>
    entry.resource.resourceType === 'Immunization' &&
    (cdcCovidCvxCodes.includes((entry?.resource?.vaccineCode as VaccineCode)?.coding[0]?.code)));

  const hasCovidObservation = fhirBundle?.entry?.some(entry =>
    entry.resource.resourceType === 'Observation' &&
    (loincCovidTestCodes.includes((entry?.resource?.code as VaccineCode)?.coding[0]?.code))
  );

  if (hasImmunization) types.push("https://smarthealth.cards#immunization");
  if (hasCovidImmunization || hasCovidObservation) types.push("https://smarthealth.cards#covid19");
  if (hasCovidObservation) types.push("https://smarthealth.cards#laboratory");

  return {
    iss: issuer,
    nbf: new Date().getTime() / 1000,
    vc: {
      type: ['https://smarthealth.cards#health-card', ...types],
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
