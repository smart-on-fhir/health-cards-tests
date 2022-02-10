<!-- label:scanQRCode side:left -->
__Requirements for Scanner:__  
The QR Scanner requires that your browser has access to a camera.  

When accessing the portal from a remote server, the browser will require a __HTTPS__ connection to a access the camera.   

When using `localhost`, __HTTP__ is sufficient.  

To Scan your QR code, try to align the QR code within the square overlay.  As camera resolutions may differ, you may have to experiment with finding the best alignment. Make sure the QR-code is flat.

Download a sample __Numeric QR Code__ from [https://spec.smarthealth.cards/examples/example-00-f-qr-code-numeric-value-0.txt](https://spec.smarthealth.cards/examples/example-00-f-qr-code-numeric-value-0.txt)  

<input type="button" id='buttonDownloadSample' value="Download Sample" onclick="downloadNumericQRSample()" />
<br><br>
<!-- label:scanQRCode side:right-->
### Multipart Codes

__Scanning__: When scanning, the scanner will detect if the QR code uses multiple parts and will create a new field for each required part.

__Manual Entry__: When typing or pasting numeric data, the shc header will be inspected and new fields for each part will be created as need.

For example, if you type `shc:/1/2/...`, the validator will detect that you have 2-parts and add an additional numeric field.

>__Note:__ All parts of a multipart code must be supplied to continue validation. The parts are concatenated to create a single JWS string before later verfications can be performed.  When a part is missing, the JWS will be invalid.  

<input type="button" id='buttonDownloadSample' value="Download Multi-Part Sample" onclick="downloadMultiQRSample()" /> 

<!-- separator --> <br><hr><br>




<!-- label:decodeNumeric side:left -->
## Decode Numeric Encoding  

Converts the `shc:/567629095243206...` encoded data to the compact JWS format __base64url__.__base64url__.__base64url__

See: [Health Cards are encoded as Compact Serialization JSON Web Signatures (JWS)](https://spec.smarthealth.cards/#health-cards-are-encoded-as-compact-serialization-json-web-signatures-jws)

>__Note:__ Additional line-breaks at the periods '.' below have been added for display purposes only.  

<br><br>
<!-- label:decodeNumeric side:right -->
<!-- separator --> <br><hr><br>




<!-- label:decodeJWS side:left -->
## Decode Compact JWS  

Decodes the period-separated base64url segments of the compact JWS string.  

#### JWS Header  
The header is decoded into a JSON string.

#### JWS Payload
The payload is converted from base64url to bytes and then decompressed using the INFLATE algorithm into a JSON string.

#### JWS Signature
The signature is a 64-byte ES256 signature. It remains in its base64url form here.

<br><br>
<!-- label:decodeJWS side:right-->
<!-- separator --> <br><hr><br>




<!-- label:extractPublicKey side:left -->
## Extract Public Key URL  

Extracts the public key url from the iss field in the JWS payload field above.

`/.well-known/jwks.json` is appended to the end of the iss url.

>__Note__ : you may enter an alternate url here to use in the following steps.  

See: [Protocol Details](https://spec.smarthealth.cards/#protocol-details) for more information on `/.well-known/jwks.json`

<br><br>
<!-- label:extractPublicKey side:right-->

### Trusted Issuers Directory

A trusted issuers directory can be specified by either selecting a known directory name from the list or by typing a URL pointing to a directory using the same format as the [VCI directory](https://raw.githubusercontent.com/the-commons-project/vci-directory/main/vci-issuers.json). 

The known directory names are:
 - `VCI`, corresponding to the VCI directory, and
 - `test`, a directory containing test issuers, including the one for the SMART Health Card specification examples.

>__Note__ : leave the Trusted Issuer Directory field empty to skip directory validation

<!-- separator --> <br><hr><br>




<!-- label:downloadKey side:left -->
## Download Public Key(s)  

Using the Public Key Url above, a key-set is downloaded as JSON.  

The public key `kid` field must match the `kid` field in the JWS header.  

>__Note__ : you may enter an alternate key-set here to use in the remaining steps.

<br><br>
<!-- label:downloadKey side:right-->
Sample keys in a Key-Set.  x5c entries are truncated for display.    

	{
		"keys": [
			{
				"kty": "EC",
				"kid": "3Kfdg-XwP-7gXyywtUfUADwBumDOPKMQx-iELL11W9s",
				"use": "sig",
				"alg": "ES256",
				"crv": "P-256",
				"x": "11XvRWy1I2S0EyJlyf_bWfw_TQ5CJJNLw78bHXNxcgw",
				"y": "eZXwxvO1hvCY0KucrPfKo7yAyMT6Ajc3N7OkAB6VYy8"
			},
			{
				"kty": "EC",
				"kid": "bVKTnRwVq4YU9oLwwShYELnRtKop_MsCAjNklowYemg",
				"use": "sig",
				"alg": "ES256",
				"x5c": [
					"MIICBjCCAYygAwIBAgIUGgXqplmagmOhhHUnRDUnQhTKa...",
					"MIICBjCCAWigAwIBAgIUWgu3m7SToFGJKDerCOQcMK5Al...",
					"MIICMTCCAZOgAwIBAgIUB+niLVaidI3U3xO2i7niRkith...",
				],
				"crv": "P-256",
				"x": "f6GJiCnbnBaIm2jDaH_3UPC7Yl-x5yBAi5ddZ8v3Y_w",
				"y": "jKcqirFw4G9v9gWTDCqAjvcCRQpbIK76bWqKBtseFzQ"
			}
		]
	}  
<br>
<!-- separator --> <br><hr><br>




<!-- label:verifySignature side:left -->
## Verify Signature  

The signature field of the compact JWS is verified against the header and payload using the public key.  

Signature verification results in a __true__ or __false__ value.  

See: [Protocol Details](https://spec.smarthealth.cards/#protocol-details) for more information on signatures.

>__Note__ : For verification, the signature value is taken from the 'Decode Compact JWS / Signature' section and not the 'Decode Numeric Encoding' section.

<br><br>
<!-- label:verifySignature side:right-->
<!-- separator --> <br><hr><br>




<!-- label:extractFhirBundle side:left -->
## Extract FHIR Bundle  

After signature verification, the FHIR Bundle is extracted from the JWS payload field and formatted for display.    
<br/>

Select optional FHIR validation profile:  

<select id='profile-select' onchange="profileSelected()">
    <option value='profile:any'>default</option>
    <option value='profile:usa-covid19-immunization'>Profile: usa-covid19-immunization</option>
	<option value='validator:fhirvalidator'>Validator: HL7 FHIR Validator (slow)</option>
</select>

<br><br>
<!-- label:extractFhirBundle side:right-->
<!-- separator --> <br><hr><br>



