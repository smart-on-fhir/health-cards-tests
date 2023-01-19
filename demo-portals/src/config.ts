export const Config = {

    // REST API endpoints

    VALIDATE_FHIR_BUNDLE:                   '/validate-fhir-bundle',
    VALIDATE_QR_NUMERIC:                    '/validate-qr-numeric',
    VALIDATE_JWE:                           '/validate-jwe',
    VALIDATE_JWS:                           '/validate-jws',
    VALIDATE_PAYLOAD:                       '/validate-jws-payload',
    VALIDATE_KEYSET:                        '/validate-key-set',
    VALIDATE_SHLINK:                        '/validate-shlink',
    VALIDATE_SHL_PAYLOAD:                   '/validate-shl-payload',
    VALIDATE_SHL_MANIFEST:                  '/validate-shl-manifest',
    VALIDATE_SHL_MANIFEST_FILE:             '/validate-shl-manifest-file',

    DEFLATE_PAYLOAD:                        '/deflate-payload',
    INFLATE_PAYLOAD:                        '/inflate-payload',
    SIGN_PAYLOAD:                           '/sign-payload',
    CREATE_VC:                              '/create-vc',
    SMART_HEALTH_CARD:                      '/smart-health-card',
    NUMERIC_ENCODE:                         '/numeric-encode',
    GENERATE_QR_CODE:                       '/generate-qr-code',
    DOWNLOAD_PUBLIC_KEY:                    '/download-public-key',
    UPLOAD_PUBLIC_KEY:                      '/upload-public-key',
    CHECK_TRUSTED_DIRECTORY:                '/check-trusted-directory',
    DOWNLOAD_SHL_MANIFEST:                  '/download-shl-manifest',
    DOWNLOAD_SHL_MANIFEST_FILE:             '/download-shl-manifest-file',

    SERVER_BASE : process.env.SERVER_BASE || 'http://localhost:' + (process.env.HOST_PORT || 8080) + '/',
    SERVICE_PORT: process.env.HOST_PORT || 8080
}