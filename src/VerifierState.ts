import { SiopManager } from './siop';
import { EncryptionKey, SigningKey, KeyGenerators } from './KeyTypes';
export type ClaimType = 'https://smarthealth.cards#covid19' | 'https://smarthealth.cards#immunization' | 'https://smarthealth.cards#tdap';
export type SiopResponseMode = 'form_post' | 'fragment';

export interface VerifierState {
    siopManager: SiopManager;
    config: {
        role: string;
        issuerUrl: string;
        skipVcPostToServer?: boolean;
        claimsRequired: ClaimType[];
        reset?: boolean;
        responseMode: SiopResponseMode;
        displayQr?: boolean;
        postRequest: (url: string, jsonBody: any) => Promise<any>;
        serverBase: string;
        skipEncryptedResponse?: boolean;
    };
    siopRequest?: {
        siopRequestPayload: {
            response_type: 'id_token';
            scope: string;
            nonce: string;
            registration: {
                id_token_encrypted_response_alg?: string; 
                id_token_encrypted_response_enc?: string; 
                id_token_signed_response_alg: string;
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
        idTokenVcs?: any[]
    };
    issuedCredentials?: string[];
    fragment?: {
        id_token: string;
        state: string;
    };
}
