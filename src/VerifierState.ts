import { EncryptionKey, SigningKey, KeyGenerators } from './KeyTypes';
import { ClaimType, SiopRequestMode } from './verifier';
export interface VerifierState {
    ek: EncryptionKey;
    sk: SigningKey;
    did: string;
    config: {
        role: string;
        skipPostToServer?: boolean;
        claimsRequired: ClaimType[];
        reset?: boolean;
        requestMode: SiopRequestMode;
        displayQr?: boolean;
        postRequest: (url: string, jsonBody: any) => Promise<any>;
        serverBase: string;
        keyGenerators: KeyGenerators;
    };
    siopRequest?: {
        siopRequestPayload: any;
        siopRequestPayloadSigned: string;
        siopRequestQrCodeUrl: string;
        siopResponsePollingUrl: string;
    };
    siopResponse?: {
        idTokenRaw: string;
        idTokenDecrypted: string;
        idTokenPayload: {
            did: string;
        };
    };
    issuedCredentials?: string[];
    fragment?: {
        id_token: string;
        state: string;
    };
}
