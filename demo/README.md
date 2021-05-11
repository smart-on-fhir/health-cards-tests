# SMART Health Card Demo Service

This project demonstrates the issuance and validation of cards specified in the [SMART Health Card Framework](https://smarthealth.cards/).

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
    

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft 
trademarks or logos is subject to and must follow 
[Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general).
Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship.
Any use of third-party trademarks or logos are subject to those third-party's policies.
