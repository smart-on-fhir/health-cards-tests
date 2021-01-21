import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import * as RS from 'reactstrap';
import { NavbarBrand } from 'reactstrap';
import { serverBase } from './config';
import { keyGenerators } from './keys';
import './style.css';
import { initializeVerifier, receiveSiopResponse } from './verifier';
import { VerifierState } from './VerifierState';
import { verifierReducer, prepareSiopRequest } from './VerifierLogic';
import QRCode from 'qrcode';
import { url } from 'inspector';

const QrDisplay: React.FC<{ url: string }> = (props) => {
    useEffect(() => {
        console.log("QR canvas", props.url)
    }, [props.url])

    const canvasCallback = useCallback(canvasElement => {
        if (!canvasElement) return;
        QRCode.toCanvas(canvasElement, props.url, { scale: 20 }, (error) => {
            canvasElement.style.width = '';
            canvasElement.style.height = '';
            if (error) console.error(error);
        });
    }, [props.url])

    return <div>
        <a href={props.url}>
            <canvas ref={canvasCallback} style={{ maxHeight: "50vmin", maxWidth: "50vmin", width: undefined, height: undefined }} />
        </a>
    </div>
}

const App: React.FC<{
    initialState: VerifierState
}> = (props) => {
    const [verifierState, setVerifierState] = useState<VerifierState>(props.initialState)
    const [runCount, setRunCount] = useState(0)

    useEffect(() => {
        dispatchToVerifier(prepareSiopRequest(verifierState))
    }, [runCount])

    useEffect(() => {
        if (!verifierState?.siopRequest?.siopRequestQrCodeUrl)
            return;

        setTimeout(async () => {
            dispatchToVerifier(receiveSiopResponse(verifierState))
        })

        console.log("Display barcode for", verifierState.siopRequest.siopRequestQrCodeUrl)
    }, [verifierState?.siopRequest?.siopRequestQrCodeUrl])

    useEffect(() => {
        console.log("Have response", verifierState.siopResponse)
    }, [verifierState?.siopResponse])

    const dispatchToVerifier = async (e) => {
        const nextState = await verifierReducer(verifierState, await e)
        setVerifierState(nextState)
        console.log("Verifier state after", e, nextState)
    }

    const displayResponse = verifierState?.siopResponse
    const displayRequest = (verifierState?.siopRequest?.siopRequestQrCodeUrl && !displayResponse)

    let did, name, conclusion;
    if (displayResponse) {
        did = displayResponse.idTokenPayload.did.replace(/\?.*/, "");
        const fhirName = displayResponse?.idTokenVcs[0].vc.credentialSubject.fhirBundle.entry[0].resource.name[0]
        name = fhirName?.given[0]  + " " + fhirName?.family
        conclusion = displayResponse?.idTokenVcs.map(jwtPayload => jwtPayload.vc.credentialSubject.fhirBundle.entry[1].resource.conclusion)
    }

    return <div style={{ paddingTop: "5em" }}>
        <RS.Navbar expand="" className="navbar navbar-dark bg-success fixed-top">
            <RS.Container>
                <NavbarBrand style={{ marginRight: "2em" }} href="/">
                    <img className="d-inline-block" style={{ maxHeight: "1em", maxWidth: "1em", marginRight: "10px" }} src="img/wallet.svg" />
                            Share your COVID Card with <b>Venue</b>
                </NavbarBrand>
            </RS.Container>
        </RS.Navbar>
        <RS.Container >
            {displayRequest &&
                <>
                    <RS.Row>
                        <RS.Col xs="12">
                            <QrDisplay url={verifierState.siopRequest.siopRequestQrCodeUrl}></QrDisplay>
                        </RS.Col>
                    </RS.Row>
                    <RS.Row>
                        <RS.Col xs="12">
                            <RS.Alert color="primary">
                                Scan to continue
                </RS.Alert>
                        </RS.Col>
                    </RS.Row>
                </>}
            {displayResponse &&
                <>
                    <RS.Row>
                        <RS.Col xs="12">
                            <RS.Card style={{ border: "1px solid grey", padding: ".5em", marginBottom: "1em" }}>
                                <RS.CardTitle style={{ fontWeight: "bolder" }}>
                                    COVID Card Shared!
                                </RS.CardTitle>
                                <RS.CardSubtitle className="text-muted">Verified name: {JSON.stringify(name)}</RS.CardSubtitle>
                                <RS.CardText style={{ fontFamily: "monospace" }}> {conclusion.join("; ")}</RS.CardText>
                            </RS.Card>
                        </RS.Col>
                    </RS.Row>
                </>}

            <RS.Row>
                <RS.Col xs="12">
                    <button onClick={e => setRunCount(c => c + 1)}>Again!</button>
                </RS.Col>
            </RS.Row>
        </RS.Container>
        <div>
        </div>
    </div>
}

export default async function main() {
    const state = await initializeVerifier({
        role: 'venue',
        claimsRequired: ['https://healthwallet.cards#covid19'],
        responseMode: 'form_post',
        postRequest: async (url, r) => (await axios.post(url, r)).data,
        serverBase,
        keyGenerators,
    });

    ReactDOM.render(
        <App initialState={state}
        />, document.getElementById('app')
    );
}

main().then(r => console.log('Finished Holder Page,', r));