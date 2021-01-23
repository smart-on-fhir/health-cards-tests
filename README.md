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



## Run locally in dev, with node and parcel watchers

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
    
## Run locally in Docker
    docker build -t health-wallet-demo .
    docker run --rm -it --env SERVER_BASE=http://localhost:8080/api -p 8080:8080 health-wallet-demo

## Run dev-only containers with watchers in Docker-Compose

You can use the docker-compose.yaml file to spin up two dev containers with watchers, one for the UI and one for the server.
    export USER=$(id -u) 
    docker-compose --env-file ./compose.env up

Note the following:
1. Both containers have their `src` directories bind-mounted to the local directory's `src` folder. Any changes made in either container (or the host) will propagate to all 3 and be registered by the watchers. This is helpful since you can, for instance, launch programs inside the `dev` container and utilize dev dependencies without needing to ever install them locally.
2. Both containers have their `dist` folders mounted to a named volume. This means the parcel watcher in the `dev-ui` container can write changes that are accessible by the `dev` container. Note the `dev-ui` container needs `root` priviliges for this. See this [issue](https://github.com/moby/moby/issues/2259) for details. 
3. The `dev-ui` container has `root` priviliges. DO NOT make any `src` file changes from inside that container, or those files will be locked on the host for non-root users (such as most text editors). When the above issue is solved, giving the `dev-ui` container non-root priviliges will resolve this. 

## Testing endpoins
See [testing-endpoints.md](./testing-endpoints.md) for details.
