## Using the hosted demo components

### Mobile Wallet demo at https://c19.cards

* Click "Connect to Lab and get tested" to retrieve a VC
* Review details (URLs, DIDs, keys, etc) in Dev Tools
* Menu > "Scan QR Code" to share your VC with a verifier (e.g., the Verifier demo below)

### Verifier demo at https://c19.cards/venue

* OpenID Request QR code is displayed automatically
* Review details (URLs, DIDs, keys, etc) in Dev Tools
* Scan the barcode from your Mobile Wallet to share your VC (e.g., the Mobile Wallet demo above)

###  Lab demo at https://c19.cards/api/fhir

* Connect your own Mobile Wallet to this demo lab interface
* Supports SMART on FHIR discovery protocol (https://c19.cards/api/fhir/.well-known/smart-configuration)
* No UI provided -- just an automatic "sign-in" workflow that redirects back to your Mobile Wallet


## Run locally in dev, with node and web pack watchers

This demo should work wiht Node.js 15 (current LTS) as well as Node.js 13. See `Dockerfile` for details if you want to build/develop locally using docker; otherwise, you can get started with:

    git clone https://github.com/microsoft-healthcare-madison/health-wallet-demo
    cd health-wallet-demo

    # In first terminal
    export SERVER_BASE=http://localhost:8080/api
    npm run dev-ui # Terminal 1

    # In second terminal
    export SERVER_BASE=http://localhost:8080/api
    npm run dev    # Terminal 2


## Build and run locally (no watchers)
    npm run build-ui
    npm run build

    export SERVER_BASE=http://localhost:8080/api
    npm run dev

## Testing endpoins
See [testing-endpoints.md](./testing-endpoints.md) for details.
