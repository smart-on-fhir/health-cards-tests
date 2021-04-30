const verifierDocs = {
  "scanQRCode": {
    "l": "<p><strong>Requirements for Scanner:</strong><br />\nThe QR Scanner requires that your browser has access to a camera.<br />\nThe browser may only use the camera when using <strong>HTTPS</strong> connection to the server.<br />\nBy default, the server is using a self-signed certificate for <strong>HTTPS</strong> connections.<br />\nYour browser will likely warn you against making this connection, requiring you to consent before doing so.  </p>\n<p>To Scan your QR code, try to align the QR code within the square overlay.  As camera resolutions may differ, you may have experiment with finding \n<br><br></p>",
    "r": ""
  },
  "decodeNumeric": {
    "l": "<h2 id=\"decodenumericencoding\">Decode Numeric Encoding</h2>\n<p>Converts the `shc:/567629095243206…` encoded data to the compact JWS format <strong>base64url</strong>.<strong>base64url</strong>.<strong>base64url</strong></p>\n<blockquote>\n  <p><strong>Note:</strong> Additional line-breaks at the periods '.' below have been added for display purposes only.  </p>\n</blockquote>\n<p><br><br></p>",
    "r": ""
  },
  "decodeJWS": {
    "l": "<h2 id=\"decodecompactjws\">Decode Compact JWS</h2>\n<p>Decodes the period-separated base64url segments of the compact JWS string.  </p>\n<h3 id=\"header\">Header</h3>\n<p>The header is decoded into a JSON string.</p>\n<h3 id=\"payload\">Payload</h3>\n<p>The payload is converted from base64url to bytes and then uncompressed using the INFLATE algorith into a JSON string.</p>\n<h3 id=\"signature\">Signature</h3>\n<p>The signature is a 64-byte ES256 signature. It remains in its base64url form here.</p>\n<p><br><br></p>",
    "r": ""
  },
  "extractPublicKey": {
    "l": "<h2 id=\"extractpublickeyurl\">Extract Public Key URL</h2>\n<p>Extracts the public key url from the iss field in the JWS payload field above.</p>\n<p>`/.well-known/jwks.json` is appended to the end of the iss url.</p>\n<blockquote>\n  <p><strong>Note</strong> : you may enter an alternate url here to use in the following steps.</p>\n</blockquote>\n<p><br><br></p>",
    "r": ""
  },
  "downloadKey": {
    "l": "<h2 id=\"downloadpublickeys\">Download Public Key(s)</h2>\n<p>Using the Public Key Url above, a key-set is downloaded as JSON.  </p>\n<p>The public key `kid` field must match the `kid` field in the JWS header.  </p>\n<blockquote>\n  <p><strong>Note</strong> : you may enter an alternate key-set here to use in the following steps.</p>\n</blockquote>\n<p><br><br></p>",
    "r": "<p>Sample keys in a Key-Set.  x5c entries are truncated for display.    </p>\n<pre><code>{\n    \"keys\": [\n        {\n            \"kty\": \"EC\",\n            \"kid\": \"3Kfdg-XwP-7gXyywtUfUADwBumDOPKMQx-iELL11W9s\",\n            \"use\": \"sig\",\n            \"alg\": \"ES256\",\n            \"crv\": \"P-256\",\n            \"x\": \"11XvRWy1I2S0EyJlyf_bWfw_TQ5CJJNLw78bHXNxcgw\",\n            \"y\": \"eZXwxvO1hvCY0KucrPfKo7yAyMT6Ajc3N7OkAB6VYy8\"\n        },\n        {\n            \"kty\": \"EC\",\n            \"kid\": \"bVKTnRwVq4YU9oLwwShYELnRtKop_MsCAjNklowYemg\",\n            \"use\": \"sig\",\n            \"alg\": \"ES256\",\n            \"x5c\": [\n                \"MIICBjCCAYygAwIBAgIUGgXqplmagmOhhHUnRDUnQhTKa...\",\n                \"MIICBjCCAWigAwIBAgIUWgu3m7SToFGJKDerCOQcMK5Al...\",\n                \"MIICMTCCAZOgAwIBAgIUB+niLVaidI3U3xO2i7niRkith...\",\n            ],\n            \"crv\": \"P-256\",\n            \"x\": \"f6GJiCnbnBaIm2jDaH_3UPC7Yl-x5yBAi5ddZ8v3Y_w\",\n            \"y\": \"jKcqirFw4G9v9gWTDCqAjvcCRQpbIK76bWqKBtseFzQ\"\n        }\n    ]\n}  \n</code></pre>\n<p><br></p>"
  },
  "verifySignature": {
    "l": "<h2 id=\"verifysignature\">Verify Signature</h2>\n<p>The signature field of the compact JWS is verified against the header and payload using the public key.  </p>\n<p>Signature verification results in a <strong>true</strong> or <strong>false</strong> value.  </p>\n<p><br><br></p>",
    "r": ""
  },
  "extractFhirBundle": {
    "l": "<h2 id=\"extractfhirbundle\">Extract Fhir Bundle</h2>\n<p>After signature verification, the Fhir Bundle is extracted from the JWS payload field and formatted for display.    </p>\n<p><br><br></p>",
    "r": ""
  }
}