import { holderWorld, currentInteraction, initializeHolder, HolderState, holderReducer, receiveSiopRequest, retrieveVcs, prepareSiopResponse, SiopInteraction } from './holder';
import { simulatedOccurrence, verifierWorld } from './verifier'
import { issuerWorld } from './issuer'
import React, { useState, useEffect, useReducer, useRef } from 'react';
import ReactDOM from 'react-dom';
import * as RS from 'reactstrap';
import { Navbar, NavbarBrand, NavItem, DropdownItem, DropdownMenu, UncontrolledDropdown, NavbarToggler, Nav, NavbarText, Collapse, NavLink, DropdownToggle, Card, Button, CardSubtitle, CardTitle, CardText } from 'reactstrap';
import 'bootstrap/dist/css/bootstrap.min.css';


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
        <br />
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
        dispatchToHolder({ 'type': 'begin-interaction', who })
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

    const [isOpen, setIsOpen] = useState(false);
    const toggle = () => setIsOpen(!isOpen);

    return <div style={{paddingTop: "5em"}}>
        
        <RS.Container>
            <RS.Row>
                
                <RS.Col xs="12">
                    <RS.Navbar expand="" className="navbar-dark bg-info fixed-top">
                        <NavbarBrand style={{ marginRight: "2em" }} href="/">
                            <img className="d-inline-block" style={{ maxHeight: "1em", maxWidth: "1em", marginRight: "10px" }} src="img/wallet.svg" />
                            Health Wallet Demo
                    </NavbarBrand>
                        <NavbarToggler onClick={toggle}></NavbarToggler>
                        <Collapse navbar>
                            <Nav navbar>
                                <NavbarText>Help</NavbarText>
                                <NavbarText>About</NavbarText>
                            </Nav>
                        </Collapse>
                    </RS.Navbar>
                </RS.Col>
            </RS.Row>
            <RS.Row>
                <RS.Col xs="12">
                <Card style={{border: "1px solid grey", padding: ".5em", marginBottom: "1em"}}>
                    <CardTitle>
                        Your Decentralized Identifier (DID)
                    </CardTitle>
                        <CardSubtitle className="text-muted">This identifier is all yours, with keys stored safely on your device.</CardSubtitle>
<CardText style={{fontFamily: "monospace"}}> {holderState.did.split('?')[0]}</CardText>
                </Card>
 
                <Card style={{border: "1px dashed grey", padding: ".5em"}}>
                    <CardTitle>
                        COVID Card
                    </CardTitle>
                        <CardSubtitle className="text-muted">You don't have a COVID card in your wallet yet.</CardSubtitle>
                        <CardText></CardText>
                        <Button disabled className="mb-1" color="info">✓ 1. Set up your Health Wallet</Button>
                        <Button className="mb-1" color="success"> 2. Find a lab</Button>
                        <Button disabled className="mb-1" color="info">3. Get tested</Button>
                    <Button disabled className="mb-1" color="info">4. Download your results</Button>
                </Card>
                </RS.Col>
            </RS.Row>
        </RS.Container>
    </div>
}
/*
        {!props.simulatedBarcodeScan ? <><a href=".?simulate-barcode">Simulate barcode scans</a> {" | "}</> : ""}
        <a target="_blank" href="./issuer">Open Lab Demo</a> {" | "}
        <a target="_blank" href="./verifier">Open Verifier Demo</a> <br />
        {interaction && interaction.status === "need-qrcode" && <QRScanner
            onScanned={onScanned}
            label="Lab"
            simulatedScan={props.simulatedBarcodeScan ? interaction : null} />}
        <button onClick={connectTo('issuer')}>Connect to Lab</button> <br />
        <button onClick={onApproval('issuer')} disabled={!showIssuerApproval}>Approve sharing my identity</button> <br />
        <button onClick={retrieveVcClick}>Get Health Card from Lab</button>
        {" "} Currently in VC Store: {holderState.vcStore.length}<br />
        <button onClick={connectTo('verifier')}>Present Health Card</button> <br />
        <button onClick={onApproval('verifier')} disabled={!showVerifierApproval}>Approving sharing my health card</button> <br />
        <pre> {JSON.stringify(holderState, null, 2)} </pre>

*/

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