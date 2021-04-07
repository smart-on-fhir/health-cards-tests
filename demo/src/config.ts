// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export const Config = {

    // REST API endpoints
    ISSUE_HEALTH_CARD_ENDPOINT:             '/issue-health-card',
    DOWNLOAD_HEALTH_CARD_FILE_ENDPOINT:     '/download-health-card-file',
    DOWNLOAD_HEALTH_CARD_QRCODE_ENDPOINT:   '/download-health-card-qrcode',
    DOWNLOAD_HEALTH_CARD_PDF_ENDPOINT:      '/download-health-card-pdf',
    VALIDATE_HEALTH_CARD_FILE_ENDPOINT:     '/validate-health-card-file',
    VALIDATE_HEALTH_CARD_QRCODE_ENDPOINT:   '/validate-health-card-qrcode',

    VALIDATE_FHIR_BUNDLE:                   '/validate-fhir-bundle',
    DEFLATE_PAYLOAD:                        '/deflate-payload',
    SIGN_PAYLOAD:                           '/sign-payload',
    CREATE_VC:                              '/create-vc',
    SMART_HEALTH_CARD:                      '/smart-health-card',
    NUMERIC_ENCODE:                         '/numeric-encode',
    GENERATE_QR_CODE:                       '/generate-qr-code',

    ISSUER_URL: '', // instantiated at startup if empty
    SERVICE_PORT: 8081,
    SERVICE_PORT_HTTPS: 8443,

    // Issuer name to be included in health cards
    ISSUER_NAME: 'Contoso Hospital'
}