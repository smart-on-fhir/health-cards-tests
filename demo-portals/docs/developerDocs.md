<!-- label:initFhir side:left -->
## FHIR Bundle

__FHIR Bundle__ resource of type "collection" that includes all required FHIR resources (content + identity resources)  

See: [Modeling W3C Verifiable Credentials in FHIR](https://spec.smarthealth.cards/credential-modeling/)


The __FHIR Bundle__ is expected in the following form:  

    {
        "resourceType": "Bundle",
        "type": "collection",
        "entry": [
            "<<FHIR Resource>>", 
            "<<FHIR Resource>>", 
            "..."
        ]
    }

<br/>

Download a sample __FHIR Bundle__ from [https://spec.smarthealth.cards/examples/example-00-a-fhirBundle.json](https://spec.smarthealth.cards/examples/example-00-a-fhirBundle.json)  

<input type="button" id='buttonDownloadSample' value="Download Sample" onclick="downloadFhirBundleSample()" />  
<br/>

Select optional FHIR validation profile:  

<select id='profile-select' onchange="profileSelected()">
    <option value='profile:any'>default</option>
    <option value='profile:usa-covid19-immunization'>Profile: usa-covid19-immunization</option>
	<option value='validator:fhirvalidator'>Validator: HL7 FHIR Validator (slow)</option>
</select>



<br/><br/> 
__Paste your FHIR Bundle in the text box below:__
<br/><br/> 

<!-- label:initFhir side:right-->
<!-- separator --> <br><hr><br>




<!-- label:initKey side:left -->
## Keys

See: [Generating and resolving cryptographic keys](https://spec.smarthealth.cards/#protocol-details)  


### Issuer Public Key  

See:  [Determining keys associated with an issuer](https://spec.smarthealth.cards/#determining-keys-associated-with-an-issuer)  
This public key will be used to verify the JWS signature and must be available at:  

<div style="display: inline-block">
<label></label>
<input type="text" id='textIssuer' placeholder="https://<your-issuer-site>/issuer"
    style="width: 300px;" />
<label>/.well-known/jwks.json</label>
</div>

<br/><br/>

### Issuer Signing Key  

The credential payload will be signed with a private ES256 key.  

The __Signing Key__ is expected in the following form:  

    {
        "kty": "EC",
        "kid": "LR8EPRFYkdyreMNakALHRoq9ce3jaVbb9tyzji4jUzY",
        "use": "sig",
        "alg": "ES256",
        "crv": "P-256",
        "x": "Xm6UNA7d5BmR1LyrOdq9vuOw92AQiMl9ZfRh2u1fTDI",
        "y": "B_11Uf_Wzx-1Va8hx_E2-AX7KpJf9LXGQTHQmqchQOg",
        "d": "Kxhn2ve8W3KZPPLfNaXklghC9u5kDrzgt40dbSwWAKY"
    }



Use a sample ES256 key from [https://raw.githubusercontent.com/smart-on-fhir/health-cards/main/generate-examples/src/config/issuer.jwks.private.json](https://raw.githubusercontent.com/smart-on-fhir/health-cards/main/generate-examples/src/config/issuer.jwks.private.json) for creating a JWS signature:

<input type="button" id='buttonGenerateKey' value="Use Sample Key" onclick="downloadIssuerKeySample()" />

<br/><br/>
  

__Paste your ES256 private key below in JWK format:__   

<!-- label:initKey side:right-->
<!-- separator --> <br><hr><br>




<!-- label:createCredential side:left -->
## Create Credential

See: [Modeling W3C Verifiable Credentials in FHIR](https://spec.smarthealth.cards/credential-modeling/)

The __Fhir Bundle__ above is inserted into a Verifiable Credential (VC) structure. 
The issuer field `iss` is set to the value you enter into the __Issuer Signing Key__ text field above.  

### Trusted Issuers Directory

A trusted issuers directory can be specified by either selecting a known directory name from the list or by typing a URL pointing to a directory using the same format as the [VCI directory](https://raw.githubusercontent.com/the-commons-project/vci-directory/main/vci-issuers.json). 

The known directory names are:
 - `VCI`, corresponding to the VCI directory, and
 - `test`, a directory containing test issuers, including the one for the SMART Health Card specification examples.

>__Note__ : leave the Trusted Issuer Directory field empty to skip directory validation

&nbsp;  

<!-- label:createCredential side:right-->
Notice that the __vs.credentialSubject.fhirBundle__ contains the Fhir Bundle from above.  
```
{
    "iss": "https://spec.smarthealth.cards/examples/issuer",
    "nbr": 1617925250718,
    "vc": {
        "type": [
            "VerifiableCredential",
            "https://smarthealth.cards#health-card",
            "https://smarthealth.cards#immunization",
            "https://smarthealth.cards#covid19"
        ],
        "credentialSubject": {
            "fhirVersion": "4.0.1",
            "fhirBundle": {
                "<<FHIR Bundle>>"
            }
        }
    }
}
```
&nbsp;  

<!-- separator --> <br><hr><br>




<!-- label:minimizePayload side:left -->
## Minify Payload  

See: [Health Cards are Small](https://spec.smarthealth.cards/#health-cards-are-small)

The Verifiable Credential (VC) above is minified, all extraneous white-space is removed.

&nbsp;  
<!-- label:minimizePayload side:right-->
<!-- separator --> <br><hr><br>




<!-- label:deflatePayload side:left -->
## Deflate Payload  

See: [Health Cards are Small](https://spec.smarthealth.cards/#health-cards-are-small)

The minified credential above is deflated (compressed) using the DEFLATE algorithm.  
The deflated binary data is represented as Base64url below for display purposes.  
<br/>
<!-- label:deflatePayload side:right-->
<!-- separator --> <br><hr><br>




<!-- label:addHeader side:left -->
## Add JWS Header  

See: [Health Cards are Small/JWS Header](https://spec.smarthealth.cards/#health-cards-are-small)  

The JWS header is in the following form:  

    {"zip":"DEF","alg":"ES256","kid":"<<key thumbprint>>"}  

`"kid"` is equal to the base64url-encoded SHA-256 JWK Thumbprint of the key (see [RFC7638](https://tools.ietf.org/html/rfc7638))


The header is then base64url-encoded:

    eyJ6aXAiOiJERUYiLCJhbGciOiJFUzI1NiIsImtpZCI6IjEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MCJ9.<<Deflated JWS Payload>>

<br/>  

__Note:__ Additional line-breaks at the periods '.' below have been added for display purposes only.

<br/>
<!-- label:addHeader side:right-->
<!-- separator --> <br><hr><br>




<!-- label:signPayload side:left -->
## Sign Payload  

See: [Signing Health Cards](https://spec.smarthealth.cards/#signing-health-cards)  

The header and compressed payload are signed using the private key supplied in the __Issuer Signing Key__ field above.  

The signature is appended to the header.payload string resulting in header.payload.signature  
This form represents a _compact JWS_ string.  

<br/>  

__Note:__ Additional line-breaks at the periods '.' below have been added for display purposes only.

<br/> 
<!-- label:signPayload side:right-->
<!-- separator --> <br><hr><br>




<!-- label:smartHealthCard side:left -->
## SMART Health Card  

See: [SMART Health Card](https://spec.smarthealth.cards/#user-retrieves-health-cards)  

The SMART Health Card is formed by wrapping the JWS above in a `{ verifiableCredential[ <jws> [, <jws>, ...] }`  structure  
&nbsp; 
<!-- label:smartHealthCard side:right-->
<!-- separator --> <br><hr><br>




<!-- label:numericEncode side:left -->
## Numeric Encoding  

See: [Encoding Chunks as QR Codes](https://spec.smarthealth.cards/#encoding-chunks-as-qr-codes)  

Encoding the SMART Health Card as a Numerical Encoded QR-Code.  

&nbsp;    
<!-- label:numericEncode side:right-->
<!-- separator --> <br><hr><br>




<!-- label:qrCode side:left -->
## QR Encoding  

See: [Creating a QR code (or a set of QR codes) from a Health Card JWS](https://spec.smarthealth.cards/#creating-a-qr-code-or-a-set-of-qr-codes-from-a-health-card-jws)    

The Numeric encoded data is used to construct a QR-Code image.  

&nbsp; 
<!-- label:qrCode side:right-->
<!-- separator --> <br><hr><br>




