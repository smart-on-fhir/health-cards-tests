# Demo service REST API

The REST API illustrates the issuance and validation of SMART Health Cards.

### Card Issuance

 - Method: POST
 - Endpoint: issue-health-card
 - input: HealthCardData (src/types.ts)
 - output: {id:<uuid>} (<uuid> to pass to download endpoints)

Issue new card example:
```
curl -X POST -H "Content-Type: application/json" -d '{"issuer":"Contoso Hospital","patientData":{"firstName":"John","lastName":"Smith","immunizations":[{"code":"207","lot":"4456","date":"2021-03-01"},{"code":"207","lot":"6417","date":"2021-03-18"}]}}' http://localhost:8081/issue-health-card
```
Returns:
```
{id:01ae7f26-4598-4cb4-bde9-8fc4ab818c20}
```

### Card file download

 - Method: GET
 - Endpoint: download-health-card-file
 - input: id=<uuid> query parameter
 - output: file download (type: application/smart-health-card, name: my.smart-health-card)

Download card example:
```
wget  http://localhost:8081/download-health-card-file?id=01ae7f26-4598-4cb4-bde9-8fc4ab818c20
```

Returns: my.smart-health-card file

### QR code download

 - Method: GET
 - Endpoint: download-health-card-qrcode
 - input: id=<uuid> query parameter
 - output: file download (type: png, name: healthCardQR.png)

Download QR code example:
```
wget  http://localhost:8081/download-health-card-qrcode?id=01ae7f26-4598-4cb4-bde9-8fc4ab818c20
```

Returns: healthCardQR.png file

### PDF card download

 - Method: GET
 - Endpoint: download-health-card-pdf
 - input: id=<uuid> query parameter
 - output: file download (type: pdf, name: healthCard.pdf)

Download PDF card example:
```
wget  http://localhost:8081/download-health-card-pdf?id=01ae7f26-4598-4cb4-bde9-8fc4ab818c20
```

Returns: healthCard.pdf file

### Card file validation

 - Method: POST
 - Endpoint: validate-health-card-file
 - input: health card file JSON
 - output: ValidationResult (src/types.ts)

Validate health card file example
```
curl -X POST -H "Content-Type: application/json" -d '{"verifiableCredential": ["..."]}' http://localhost:8081/validate-health-card-file
```

Returns
```
{
    "fhirBundle": ...,
    "result":{"issuer":"ABC General Hospital","healthCardData":{"firstName":["John","B."],"lastName":"Anyperson","immunizations":[{"code":"207","lot":"Lot #0000001","date":"2021-01-01"},{"code":"207","lot":"Lot #0000007","date":"2021-01-29"}]}}
}
```

### Card file validation

 - Method: POST
 - Endpoint: validate-health-card-qrcode
 - input: numeric QR code array JSON
 - output: ValidationResult (src/types.ts)

Validate numeric QR example
```
curl -X POST -H "Content-Type: application/json" -d '["shc:/..."]' http://localhost:8081/validate-health-card-qrcode
```

Returns
```
{
    "fhirBundle": ...,
    "result":{"issuer":"ABC General Hospital","healthCardData":{"firstName":["John","B."],"lastName":"Anyperson","immunizations":[{"code":"207","lot":"Lot #0000001","date":"2021-01-01"},{"code":"207","lot":"Lot #0000007","date":"2021-01-29"}]}}
}
```