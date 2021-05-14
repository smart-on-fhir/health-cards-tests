export const Config = {

    // REST API endpoints

    VALIDATE_FHIR_BUNDLE:                   '/validate-fhir-bundle',
    VALIDATE_QR_NUMERIC:                    '/validate-qr-numeric',
    VALIDATE_JWS:                           '/validate-jws',
    VALIDATE_PAYLOAD:                       '/validate-jws-payload',
    VALIDATE_KEYSET:                        '/validate-key-set',

    DEFLATE_PAYLOAD:                        '/deflate-payload',
    INFLATE_PAYLOAD:                        '/inflate-payload',
    SIGN_PAYLOAD:                           '/sign-payload',
    CREATE_VC:                              '/create-vc',
    SMART_HEALTH_CARD:                      '/smart-health-card',
    NUMERIC_ENCODE:                         '/numeric-encode',
    GENERATE_QR_CODE:                       '/generate-qr-code',
    DOWNLOAD_PUBLIC_KEY:                    '/download-public-key',
    UPLOAD_PUBLIC_KEY:                      '/upload-public-key',

    SERVER_BASE : process.env.SERVER_BASE || 'http://localhost:' + (process.env.HOST_PORT || 8080) + '/',
    SERVICE_PORT: process.env.HOST_PORT || 8080
}