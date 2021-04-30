const docs = {

		docsScanQRCode: {
				docs:
`
## Scan QR Code  

__Requirements for Scanner:__  
The QR Scanner requires that your browser has access to a camera.  
The browser may only use the camera when using __HTTPS__ connection to the server.   
By default, the server is using a self-signed certificate for __HTTPS__ connections.  
Your browser will likely warn you against making this connection, requiring you to consent before doing so.  

To Scan your QR code, try to align the QR code within the square overlay.  As camera resolutions may differ, you may have experiment with finding 


<br><br>
`,
				code:
``
		},


		docsDecodeNumeric: {
				docs:
`
## Decode Numeric Encoding  

Converts the \`shc:/567629095243206...\` encoded data to the compact JWS format __base64url__.__base64url__.__base64url__

>__Note:__ Additional line-breaks at the periods '.' below have been added for display purposes only.


<br><br>
`,
				code:
``
		},




		docsDecodeJWS: {
				docs:
`
## Decode Compact JWS  

Decodes the period-separated base64url segments of the compact JWS string.  

### Header  
The header is decoded into a JSON string.

### Payload
The payload is converted from base64url to bytes and then uncompressed using the INFLATE algorith into a JSON string.

### Signature
The signature is a 64-byte ES256 signature. It remains in its base64url form here.


<br><br>
`,
				code:
``
		},



		docsExtractPublicKey: {
				docs:
`
## Extract Public Key URL  

Extracts the public key url from the iss field in the JWS payload field above.

\`/.well-known/jwks.json\` is appended to the end of the iss url.

>__Note__ : you may enter an alternate url here to use in the following steps.

<br><br>
`,
				code:
``
		},



		docsDownloadKey: {
				docs:
`
## Download Public Key(s)  

Using the Public Key Url above, a key-set is downloaded as JSON.  

The public key \`kid\` field must match the \`kid\` field in the JWS header.  

>__Note__ : you may enter an alternate key-set here to use in the following steps.

<br><br>
`,
				code:
`
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
`
		},



		docsVerifySignature: {
			docs:
`
## Verify Signature  

The signature field of the compact JWS is verified against the header and payload using the public key.  

Signature verification results in a __true__ or __false__ value.  

<br><br>
`,
			code:
``
	},


	
	docsExtractFhirBundle: {
		docs:
`
## Extract Fhir Bundle  

After signature verification, the Fhir Bundle is extracted from the JWS payload field and formatted for display.    

<br><br>
`,
		code:
``
},
		
}