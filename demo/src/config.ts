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

    ISSUER_URL: '', // instantiated at startup if empty
    SERVICE_PORT: 8080,

    // Issuer name to be included in health cards
    ISSUER_NAME: 'Contoso Hospital'
}