const developerDocs = {
  "initFhir": {
    "l": "<h2 id=\"fhirbundle\">FHIR Bundle</h2>\n<p><strong>FHIR Bundle</strong> resource of type \"collection\" that includes all required FHIR resources (content + identity resources)  </p>\n<p>See: <a href=\"https://smarthealth.cards/credential-modeling/\">Modeling W3C Verifiable Credentials in FHIR</a></p>\n<p>The <strong>FHIR Bundle</strong> is expected in the following form:  </p>\n<pre><code>{\n    \"resourceType\": \"Bundle\",\n    \"type\": \"collection\",\n    \"entry\": [\n        \"&lt;&lt;FHIR Resource&gt;&gt;\", \n        \"&lt;&lt;FHIR Resource&gt;&gt;\", \n        \"...\"\n    ]\n}\n</code></pre>\n<p><br/></p>\n<p>Download a sample <strong>FHIR Bundle</strong> from <a href=\"https://smarthealth.cards/examples/example-00-a-fhirBundle.json\">https://smarthealth.cards/examples/example-00-a-fhirBundle.json</a>  </p>\n<p><input type=\"button\" id='buttonDownloadSample' value=\"Download Sample\" onclick=\"downloadFhirBundleSample()\" />  </p>\n<p><br/><br/> \n<strong>Paste your FHIR Bundle in the text box below:</strong>\n<br/> </p>",
    "r": ""
  },
  "initKey": {
    "l": "<h2 id=\"keys\">Keys</h2>\n<p>See: <a href=\"https://smarthealth.cards/#protocol-details\">Generating and resolving cryptographic keys</a>  </p>\n<h3 id=\"issuerpublickey\">Issuer Public Key</h3>\n<p>See:  <a href=\"https://smarthealth.cards/#determining-keys-associated-with-an-issuer\">Determining keys associated with an issuer</a><br />\nThis public key will be used to verify the JWS signature and must be available at:  </p>\n<div style=\"display: inline-block\">\n<label></label>\n<input type=\"text\" id='textIssuer' placeholder=\"https://<your-issuer-site>/issuer\"\n    style=\"width: 300px;\" />\n<label>/.well-known/jwks.json</label>\n</div>\n<p><br/><br/></p>\n<h3 id=\"issuersigningkey\">Issuer Signing Key</h3>\n<p>The credential payload will be signed with a private ES256 key.  </p>\n<p>The <strong>Signing Key</strong> is expected in the following form:  </p>\n<pre><code>{\n    \"kty\": \"EC\",\n    \"kid\": \"LR8EPRFYkdyreMNakALHRoq9ce3jaVbb9tyzji4jUzY\",\n    \"use\": \"sig\",\n    \"alg\": \"ES256\",\n    \"crv\": \"P-256\",\n    \"x\": \"Xm6UNA7d5BmR1LyrOdq9vuOw92AQiMl9ZfRh2u1fTDI\",\n    \"y\": \"B_11Uf_Wzx-1Va8hx_E2-AX7KpJf9LXGQTHQmqchQOg\",\n    \"d\": \"Kxhn2ve8W3KZPPLfNaXklghC9u5kDrzgt40dbSwWAKY\"\n}\n</code></pre>\n<p>Use a sample ES256 key from <a href=\"https://raw.githubusercontent.com/smart-on-fhir/health-cards/main/generate-examples/src/config/issuer.jwks.private.json\">https://raw.githubusercontent.com/smart-on-fhir/health-cards/main/generate-examples/src/config/issuer.jwks.private.json</a> for creating a JWS signature:  </p>\n<p><input type=\"button\" id='buttonGenerateKey' value=\"Use Sample Key\" onclick=\"downloadIssuerKeySample()\" /></p>\n<p><br/><br/></p>\n<p><strong>Paste your ES256 private key below in JWK format:</strong>   </p>",
    "r": ""
  },
  "createCredential": {
    "l": "<h2 id=\"createcredential\">Create Credential</h2>\n<p>See: <a href=\"https://smarthealth.cards/credential-modeling/\">Modeling W3C Verifiable Credentials in FHIR</a></p>\n<p>The <strong>Fhir Bundle</strong> above is inserted into a Verifiable Credential (VC) structure. \nThe issuer field <code>iss</code> is set to the value you enter into the <strong>Issuer Signing Key</strong> text field above.<br />\n&nbsp;  </p>",
    "r": "<p>Notice that the <strong>vs.credentialSubject.fhirBundle</strong> contains the Fhir Bundle from above.  </p>\n<pre><code>{\n    \"iss\": \"https://smarthealth.cards/examples/issuer\",\n    \"nbr\": 1617925250718,\n    \"vc\": {\n        \"type\": [\n            \"VerifiableCredential\",\n            \"https://smarthealth.cards#health-card\",\n            \"https://smarthealth.cards#immunization\",\n            \"https://smarthealth.cards#covid19\"\n        ],\n        \"credentialSubject\": {\n            \"fhirVersion\": \"4.0.1\",\n            \"fhirBundle\": {\n                \"&lt;&lt;FHIR Bundle&gt;&gt;\"\n            }\n        }\n    }\n}\n</code></pre>\n<p>&nbsp;  </p>"
  },
  "minimizePayload": {
    "l": "<h2 id=\"minifypayload\">Minify Payload</h2>\n<p>See: <a href=\"https://smarthealth.cards/#health-cards-are-small\">Health Cards are Small</a></p>\n<p>The Verfiable Credential (VC) above is minified, all extraneous white-space is removed.</p>\n<p>&nbsp;  </p>",
    "r": ""
  },
  "deflatePayload": {
    "l": "<h2 id=\"deflatepayload\">Deflate Payload</h2>\n<p>See: <a href=\"https://smarthealth.cards/#health-cards-are-small\">Health Cards are Small</a></p>\n<p>The minified credential above is deflated (compressed) using the DEFLATE algorithm.<br />\nThe deflated binary data is represented as Base64url below for display purposes.<br />\n<br/></p>",
    "r": ""
  },
  "addHeader": {
    "l": "<h2 id=\"addjwsheader\">Add JWS Header</h2>\n<p>See: <a href=\"https://smarthealth.cards/#health-cards-are-small\">Health Cards are Small/JWS Header</a>  </p>\n<p>The JWS header is in the following form:  </p>\n<pre><code>{\"zip\":\"DEF\",\"alg\":\"ES256\",\"kid\":\"&lt;&lt;key thumbprint&gt;&gt;\"}  \n</code></pre>\n<p>`\"kid\"` is equal to the base64url-encoded SHA-256 JWK Thumbprint of the key (see <a href=\"https://tools.ietf.org/html/rfc7638\">RFC7638</a>)</p>\n<p>The header is then base64url-encoded:</p>\n<pre><code>eyJ6aXAiOiJERUYiLCJhbGciOiJFUzI1NiIsImtpZCI6IjEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MCJ9.&lt;&lt;Deflated JWS Payload&gt;&gt;\n</code></pre>\n<p><br/>  </p>\n<p><strong>Note:</strong> Additional line-breaks at the periods '.' below have been added for display purposes only.</p>\n<p><br/></p>",
    "r": ""
  },
  "signPayload": {
    "l": "<h2 id=\"signpayload\">Sign Payload</h2>\n<p>See: <a href=\"https://smarthealth.cards/#signing-health-cards\">Signing Health Cards</a>  </p>\n<p>The header and compressed payload are signed using the private key supplied in the <strong>Issuer Signing Key</strong> field above.  </p>\n<p>The signature is appended to the header.payload string resulting in header.payload.signature<br />\nThis form represents a <em>compact JWS</em> string.  </p>\n<p><br/>  </p>\n<p><strong>Note:</strong> Additional line-breaks at the periods '.' below have been added for display purposes only.</p>\n<p><br/> </p>",
    "r": ""
  },
  "smartHealthCard": {
    "l": "<h2 id=\"smarthealthcard\">SMART Health Card</h2>\n<p>See: <a href=\"https://smarthealth.cards/#user-retrieves-health-cards\">SMART Health Card</a>  </p>\n<p>The SMART Health Card is formed by wrapping the JWS above in a <code>{ verifiableCredential[ &lt;jws&gt; [, &lt;jws&gt;, ...] }</code>  structure<br />\n&nbsp; </p>",
    "r": ""
  },
  "numericEncode": {
    "l": "<h2 id=\"numericencoding\">Numeric Encoding</h2>\n<p>See: <a href=\"https://smarthealth.cards/#encoding-chunks-as-qr-codes\">Encoding Chunks as QR Codes</a>  </p>\n<p>Encoding the SMART Health Card as a Numerical Encoded QR-Code.  </p>\n<p>&nbsp;    </p>",
    "r": ""
  },
  "qrCode": {
    "l": "<h2 id=\"qrencoding\">QR Encoding</h2>\n<p>See: <a href=\"https://smarthealth.cards/#creating-a-qr-code-or-a-set-of-qr-codes-from-a-health-card-jws\">Creating a QR code (or a set of QR codes) from a Health Card JWS</a>    </p>\n<p>The Numeric encoded data is used to construct a QR-Code image.  </p>\n<p>&nbsp; </p>",
    "r": ""
  }
}