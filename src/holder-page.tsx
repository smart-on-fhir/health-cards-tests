import { holderWorld, currentInteraction, initializeHolder, HolderState, holderEvent, receiveSiopRequest, retrieveVcs, prepareSiopResponse, SiopInteraction } from './holder';
import { simulatedOccurrence, verifierWorld } from './verifier'
import { issuerWorld } from './issuer'
import React, { useState, useEffect, useReducer, useRef } from 'react';
import ReactDOM from 'react-dom';

import QrScanner from 'qr-scanner';
QrScanner.WORKER_PATH = 'qr-scanner-worker.min.js';

const SIMULATED_SCAN = true

interface State {
    holder: HolderState;
    qrCode?: string;
}

const QRScanner: React.FC<{ label: string, onScanned: (s: string) => void, simulatedScan?: SiopInteraction }> = (props) => {
    const videoRef = useRef()
    useEffect(() => {
        let qrScanner = new QrScanner(videoRef.current, result => {
            if (!result.length) { return; }
            props.onScanned(result)
        });
        qrScanner.start();

        return function cancel() {
            qrScanner.destroy();
            qrScanner = null;
            console.log("Descriyed scanner")
        }
    }, [videoRef])

    useEffect(() => {
        if (props.simulatedScan) {
            const fakeEvent = simulatedOccurrence({
                who: props.simulatedScan.simulateBarcodeScanFrom,
                type: 'display-qr-code'
            })
            fakeEvent.then(({ url }) => props.onScanned(url))
        }
    }, [])

    return <>
        <span>Scan barcode for {props.label}</span><br />
        <video ref={videoRef} style={{ width: "100%", height: "100%" }}></video>
    </>
}


const App: React.FC<{ initialState: HolderState }> = (props) => {
    const [state, setState] = useState<State>({ holder: props.initialState})

    const interaction = currentInteraction(state.holder)

    const dispatchToHolder = async (ePromise) => {
        const e = await ePromise
        const holder = await holderEvent(state.holder, e)
        console.log("Dispatched", e, holder)
        setState(state => ({ ...state, holder }))
    }

    const connectTo = who => async () => {
        console.log("Begin with ", who)
        dispatchToHolder({ 'type': 'begin-interaction', who})
    }

    const retrieveVcClick = async () => {
        await dispatchToHolder(retrieveVcs(state.holder))
    }

    const onScanned = async (qrCodeUrl: string) => {
        console.log("Scanned", qrCodeUrl)
        await dispatchToHolder(receiveSiopRequest(qrCodeUrl, state.holder));
    }

    const onApproval = who => async () {
        await dispatchToHolder(prepareSiopResponse(state.holder));
    }

    return <>
        <a target="_blank" href="./issuer.html">Open Lab Demo</a> {" | "}
        <a target="_blank" href="./verifier.html">Open Verifier Demo</a> <br/>
        {interaction && interaction.status === "need-qrcode" && <QRScanner onScanned={onScanned} label="Lab"/>}
        <button onClick={connectTo('issuer')}>Connect to Lab</button> <br />
        <button onClick={onApproval('issuer')} disabled={!(interaction &&  state.holder.interactions.length == 1 && interaction.status === "need-approval")}>Approve sharing my identity</button> <br />
        <button onClick={retrieveVcClick}>Get Health Card from Lab</button> 
        {" "} Currently in VC Store: {state.holder.vcStore.length}<br />
        <button onClick={connectTo('verifier')}>Present Health Card</button> <br />
        <button onClick={onApproval('verifier')} disabled={!(interaction && state.holder.interactions.length ==2 && interaction.status === "need-approval")}>Approving sharing my health card</button> <br />
        <pre> {JSON.stringify(state, null, 2)} </pre>
    </>
}

export default async function main() {
    //issuerWorld(true)
    //verifierWorld(true)
    const state = await initializeHolder(false);
    ReactDOM.render(
        <App initialState={state} />,
        document.getElementById('app')
    );
}

main().then(r => console.log('Finished Holder Page,', r));