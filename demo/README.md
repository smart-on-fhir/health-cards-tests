# SMART Health Card Demo Service

This project demonstrates the issuance and validation of cards specified in the [SMART Health Card Framework](https://smarthealth.cards/).

## Setup

1. Make sure [node.js](https://nodejs.org/) and [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) are installed on your system; the latest Long-Term Support (LTS) version is recommended for both.

2. Get the source, for example using git:

                git clone -b sample-service https://github.com/microsoft/health-cards-tests
                cd health-cards-tests

3. Build the npm package:

                npm install
                npm run build

3. Deploy the demo service (edit `src/config.ts` to change configuration):

                npm run deploy

The demo stands up two endpoint illustrating the SMART Health Card operations:
 - one listening on port 8081 offering a demo API, as documented in [RESTAPI.md](RESTAPI.md)
 - one listening on port 8443 offering a finer-grained API for testing, as used by [issuer](https://localhost:8443/IssuerPortal.html) or [developer](https://localhost:8443/DevPortal.html) portals

The default config creates a self-signed TLS certificate for localhost (needed for the in-browser QR scanning to work), that will not be trusted by the browser. Chrome and Edge, for example, rightfully complain that "Your connection isn't private"); to access the portal pages, you need to click "Advanced" and then "Continue to localhost (unsafe)". The config can be updated with new endoints and certificate to avoid these warnings.

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
