// generates key-pair and self-signed cert for express site
// https is required to allow the browser to access the camera for QR code scanning

var selfsigned = require('selfsigned');
var fs = require('fs');

var attrs = [{ name: 'commonName', value: 'localhost' }];
var options = { days: 365, keySize: 2048, extensions: [
    { name: 'basicConstraints', cA: true },
    { name: 'keyUsage', keyCertSign: true, digitalSignature: true,
      nonRepudiation: true, keyEncipherment: true, dataEncipherment: true }, 
    { name: 'subjectAltName',
      altNames: [{ type: 2, /* DNS */ value: 'localhost' }]
    }]};
var pems = selfsigned.generate(attrs, options);

fs.writeFileSync("public/localhost.crt", pems.cert);
fs.writeFileSync("private/localhost.key", pems.private);

console.log("Created self-signed certificate for https : localhost.crt");

// copies js file from the node_modules qr-scanner folder for use by the html pages in ./public

fs.copyFileSync('node_modules/qr-scanner/qr-scanner-worker.min.js', 'public/qr-scanner-worker.min.js');
fs.copyFileSync('node_modules/qr-scanner/qr-scanner-worker.min.js.map', 'public/qr-scanner-worker.min.js.map');
fs.copyFileSync('node_modules/qr-scanner/qr-scanner.umd.min.js', 'public/qr-scanner.umd.min.js');
fs.copyFileSync('node_modules/qr-scanner/qr-scanner.umd.min.js.map', 'public/qr-scanner.umd.min.js.map');

console.log("Copied QR-scanner scripts to ./public");