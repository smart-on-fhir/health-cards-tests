// generates key-pair and self-signed cert for express site
// https is required to allow the browser to access the camera for QR code scanning

var fs = require('fs');
// var selfsigned = require('selfsigned');

// copies js file from the node_modules folder for use by the html pages in ./public
fs.copyFileSync('node_modules/jsqr/dist/jsQR.js', 'public/jsQR.js');
fs.copyFileSync('node_modules/github-markdown-css/github-markdown.css', 'public/github-markdown.css');

console.log("Copied QR-scanner scripts to ./public");
