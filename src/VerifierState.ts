import { EncryptionKey, SigningKey, KeyGenerators } from './KeyTypes';
export type ClaimType = 'vc-health-passport-stamp-covid19-serology' | 'vc-health-passport-stamp';
export type SiopResponseMode = 'form_post' | 'fragment';

export interface VerifierState {
    ek: EncryptionKey;
    sk: SigningKey;
    did: string;
    config: {
        role: string;
        skipVcPostToServer?: boolean;
        claimsRequired: ClaimType[];
        reset?: boolean;
        responseMode: SiopResponseMode;
        displayQr?: boolean;
        postRequest: (url: string, jsonBody: any) => Promise<any>;
        serverBase: string;
        keyGenerators: KeyGenerators;
    };
    siopRequest?: {
        siopRequestPayload: {
            response_type: 'id_token';
            scope: string;
            nonce: string;
            registration: {
                id_token_signed_response_alg: string[];
                client_uri: string;
            };
            response_mode: 'form_post' | 'fragment' | 'query';
            response_context?: 'wallet' | 'rp';
            claims?: any;
            client_id: string;
            state: string;
            iss: string;
        };
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
