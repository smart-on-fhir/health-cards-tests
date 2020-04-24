import { holderWorld, currentInteraction, initializeHolder, HolderState, holderReducer, receiveSiopRequest, retrieveVcs, prepareSiopResponse, SiopInteraction } from './holder';
import { simulatedOccurrence, verifierWorld } from './verifier'
import { issuerWorld } from './issuer'
import React, { useState, useEffect, useReducer, useRef } from 'react';
import ReactDOM from 'react-dom';

import QrScanner from 'qr-scanner';
QrScanner.WORKER_PATH = 'qr-scanner-worker.min.js';

const SIMULATED_SCAN = true

interface State {
}

const QRScanner: React.FC<{ label: string, onScanned: (s: string) => void, simulatedScan?: SiopInteraction }> = (props) => {
    const videoRef = useRef()
    useEffect(() => {
        let qrScanner = new QrScanner(videoRef.current, result => {
            result.length && props.onScanned(result)
        });
        qrScanner.start();

        return function cancel() {
            qrScanner.destroy();
            qrScanner = null;
        }
    }, [videoRef])

    useEffect(() => {
        if (props.simulatedScan) {
            simulatedOccurrence({
                who: props.simulatedScan.simulateBarcodeScanFrom,
                type: 'display-qr-code'
            }).then(({ url }) => props.onScanned(url))
        }
    }, [])

    return <>
        <span>Scan barcode for {props.label}</span><br />
        <video ref={videoRef} style={{ width: "25vmin", height: "25vmin" }}></video>
        <br/>
    </>
}

const App: React.FC<{ initialState: HolderState, simulatedBarcodeScan: boolean }> = (props) => {
    const [holderState, setHolderState] = useState<HolderState>(props.initialState)
    const [state, setState] = useState<State>({})

    const interaction = currentInteraction(holderState)

    const dispatchToHolder = async (ePromise) => {
        const e = await ePromise
        const holder = await holderReducer(holderState, e)
        setHolderState(state => holder)
    }

    const connectTo = who => async () => {
        dispatchToHolder({ 'type': 'begin-interaction', who})
    }

    const retrieveVcClick = async () => {
        await dispatchToHolder(retrieveVcs(holderState))
    }

    const onScanned = async (qrCodeUrl: string) => {
        await dispatchToHolder(receiveSiopRequest(qrCodeUrl, holderState));
    }

    const onApproval = who => async () => {
        await dispatchToHolder(prepareSiopResponse(holderState));
    }

    const showIssuerApproval = (interaction && holderState.interactions.length == 1 && interaction.status === "need-approval")
    const showVerifierApproval = (interaction && holderState.interactions.length == 2 && interaction.status === "need-approval")

    return <>
        {!props.simulatedBarcodeScan ? <><a href=".?simulate-barcode">Simulate barcode scans</a> {" | "}</> : ""}
        <a target="_blank" href="./issuer">Open Lab Demo</a> {" | "}
        <a target="_blank" href="./verifier">Open Verifier Demo</a> <br/>
        {interaction && interaction.status === "need-qrcode" && <QRScanner 
            onScanned={onScanned}
            label="Lab"
            simulatedScan={props.simulatedBarcodeScan ? interaction : null}/>}
        <button onClick={connectTo('issuer')}>Connect to Lab</button> <br />
        <button onClick={onApproval('issuer')} disabled={!showIssuerApproval}>Approve sharing my identity</button> <br />
        <button onClick={retrieveVcClick}>Get Health Card from Lab</button> 
        {" "} Currently in VC Store: {holderState.vcStore.length}<br />
        <button onClick={connectTo('verifier')}>Present Health Card</button> <br />
        <button onClick={onApproval('verifier')} disabled={!showVerifierApproval}>Approving sharing my health card</button> <br />
        <pre> {JSON.stringify(holderState, null, 2)} </pre>
    </>
}

export default async function main() {
    const simulatedBarcodeScan = !!window.location.search.match(/simulate-barcode/)
    console.log("Simulated", simulatedBarcodeScan)
    if (simulatedBarcodeScan) {
        issuerWorld()
        verifierWorld()
    }
    const state = await initializeHolder();
    ReactDOM.render(
        <App initialState={state} simulatedBarcodeScan={simulatedBarcodeScan} />,
        document.getElementById('app')
    );
}

main().then(r => console.log('Finished Holder Page,', r));