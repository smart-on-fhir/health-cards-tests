# SMART Health Card Demo Service

This project demonstrates the issuance and validation of cards specified in the [SMART Health Card Framework](https://spec.smarthealth.cards/).

# Live Demo

* https://demo-portals.smarthealth.cards/VerifierPortal.html
* https://demo-portals.smarthealth.cards/DevPortal.html

# Development

## Setup

1. Make sure [node.js](https://nodejs.org/) and [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) are installed on your system; the latest Long-Term Support (LTS) version is recommended for both.

2. Get the source, for example using git:

                git clone -b sample-service https://github.com/microsoft/health-cards-tests
                cd health-cards-tests/demo

3. Build the npm package:

                npm install
                npm run build

4. Deploy the demo service (edit `src/config.ts` to change configuration):

                npm run deploy


5. (Optionally) Deploy the service in a Docker container:

        docker build -t health-wallet-demo-portals .
        docker run --rm -it -p 8080:8080 health-wallet-demo-portals


    The demo stands up an endpoint illustrating the SMART Health Card operations listening on port 8080:
    - [developer](https://localhost:8080/DevPortal.html) portal for constructing SMART Health Cards from FHIR data.
    - [verifier](https://localhost:8080/VerifierPortal.html) for validating SMART Health Cards and extracting embedded FHIR data.  
