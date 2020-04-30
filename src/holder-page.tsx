import { holderWorld, currentInteraction, initializeHolder, HolderState, holderReducer, receiveSiopRequest, retrieveVcs, prepareSiopResponse, SiopInteraction } from './holder';
import { simulatedOccurrence, verifierWorld, ClaimType } from './verifier'
import { issuerWorld } from './issuer'
import React, { useState, useEffect, useReducer, useRef, Ref, DOMElement, useCallback } from 'react';
import ReactDOM from 'react-dom';
import * as RS from 'reactstrap';
import { Navbar, NavbarBrand, NavItem, DropdownItem, DropdownMenu, UncontrolledDropdown, NavbarToggler, Nav, NavbarText, Collapse, NavLink, DropdownToggle, Card, Button, CardSubtitle, CardTitle, CardText } from 'reactstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import querystring from 'querystring';


import QrScanner from 'qr-scanner';
QrScanner.WORKER_PATH = 'qr-scanner-worker.min.js';


type RedirectMode = "qr" | "window-open"
const SiopRequestReceiver: React.FC<{ label: string; redirectMode: RedirectMode; onReady: (s: string) => void; interaction: SiopInteraction, startUrl: string}> = (props) => {
    const videoRef = useRef()
    useEffect(() => {
        if (!videoRef.current) { return; }
        let qrScanner = new QrScanner(videoRef.current, result => {
            result.length && props.onReady(result)
        });
        qrScanner.start();
        return function cancel() {
            qrScanner.destroy();
            qrScanner = null;
        }
    }, [videoRef])

    useEffect(() => {
        if (props.redirectMode === "window-open") {
            const onMessage = ({ data, source }) => {
                props.onReady(data)
            }
            const registered = window.addEventListener("message", onMessage)
            const opened = window.open(props.startUrl)
            return () => {
                window.removeEventListener("message", onMessage)
            }
        }
        return;
    }, [])


    return props.redirectMode === "qr" ? <>
        <span>Scan barcode for {props.label}</span><br />
        <video ref={videoRef} style={{ width: "25vmin", height: "25vmin" }}></video>
        <br />
    </> : <>
            <span>Waiting for redirect...</span>
        </>
}

interface SiopApprovalProps {
    share: ClaimType[];
    with: string;
    onApproval: () => void;
    onDenial: () => void;
}

const parseSiopApprovalProps = (holderState: HolderState, onApproval: any, onDenial: any): SiopApprovalProps | null => {
    const siopAtNeedApproval = holderState.interactions.filter(i => i.status === 'need-approval').slice(-1)
    if (siopAtNeedApproval.length === 0) {
        return null
    }

    let req = siopAtNeedApproval[0]
    let claims = Object
        .keys(req.siopRequest?.claims?.id_token || {}) as ClaimType[]

    //TODO replace this with SIOP registratation data + whitelist based lookup
    const issuerName = req.siopPartnerRole === 'issuer' ? 'Lab' : 'Employer'

    return {
        share: claims,
        with: req.siopPartnerRole,
        onApproval: onApproval(req.siopPartnerRole),
        onDenial: onDenial(req.siopPartnerRole)
    }
}
const SiopApprovalModal: React.FC<SiopApprovalProps | null> = (props) => {

    if (!props.onApproval) {
        return null
    }

    const focusCallback = useCallback(b => {
        setTimeout(() => b && b.focus())
    }, [])

    return <>
        <RS.Modal isOpen={true} >
            <RS.ModalHeader>Share with {props.with}?</RS.ModalHeader>
            <RS.ModalBody>The following details will be shared:
        <ul>
                    <li><b>Your ID Card:</b> allows secure communications</li>
                    {props.share.includes("vc-health-passport-stamp-covid19-serology") && <li>
                        <b>Your COVID Card:</b> labs and vaccines for COVID-19
            </li>
                    }
                    {props.share.includes("vc-health-passport-stamp") && <li>
                        <b>Your Immunizations Card:</b> full vaccine history
            </li>
                    }
                </ul>
            </RS.ModalBody>
            <RS.ModalFooter>
                <Button color="danger" onClick={props.onDenial}>Do not share</Button>
                <Button innerRef={focusCallback}
                    color="success"
                    onClick={props.onApproval}>
                    Share {props.share.length > 0 ? "these cards" : "this card"}
                </Button>
            </RS.ModalFooter>
        </RS.Modal>
    </>
}

interface IssuerProps {
    issuerStartUrl: string;
    issuerDownloadUrl: string;
}
interface VerifierProps{
   verifierStartUrl: string;
}


const App: React.FC<{ initialState: HolderState, simulatedBarcodeScan: boolean, issuer: IssuerProps, verifier: VerifierProps }> = (props) => {
    const [holderState, setHolderState] = useState<HolderState>(props.initialState)

    const issuerInteractions = holderState.interactions.filter(i => i.siopPartnerRole === 'issuer').slice(-1)
    const issuerInteraction = issuerInteractions.length ? issuerInteractions[0] : null

    const verifierInteractions = holderState.interactions.filter(i => i.siopPartnerRole === 'verifier').slice(-1)
    const verifierInteraction = verifierInteractions.length ? verifierInteractions[0] : null


    useEffect(() => {
        holderState.interactions.filter(i => i.status === 'need-redirect').forEach(i => {
            const redirectUrl = i.siopRequest.client_id + '#' + querystring.encode(i.siopResponse.formPostBody)
            const opened = window.open(redirectUrl, "issuer")
            dispatchToHolder({ 'type': "siop-response-complete" })
        })
    }, [holderState.interactions])

    const dispatchToHolder = async (ePromise) => {
        const e = await ePromise
        const holder = await holderReducer(holderState, e)
        setHolderState(state => holder)
    }

    const connectTo = who => async () => {
        dispatchToHolder({ 'type': 'begin-interaction', who })
    }

    const retrieveVcClick = async () => {
        const onMessage = async ({ data, source }) => {
            const {vcs} = data
            await dispatchToHolder(retrieveVcs(vcs, holderState))
            window.removeEventListener("message", onMessage)
        }
        window.addEventListener("message", onMessage)
        window.open(props.issuer.issuerDownloadUrl)
    }

    const onScanned = async (qrCodeUrl: string) => {
        await dispatchToHolder(receiveSiopRequest(qrCodeUrl, holderState));
    }

    const onApproval = who => async () => {
        await dispatchToHolder(prepareSiopResponse(holderState));
    }

    const onDenial = who => async () => {
        await dispatchToHolder({ type: "siop-response-complete" });
    }

    const [isOpen, setIsOpen] = useState(false);
    const toggle = () => setIsOpen(!isOpen);

    let current_step = 1;
    if (issuerInteraction?.status !== 'complete') {
        current_step = 2;
    } else {
        current_step = 3;
    }
    if (holderState.vcStore.length) {
        current_step = 4
    }

    const siopAtNeedQr = issuerInteractions.concat(verifierInteractions).filter(i => i.status === 'need-qrcode').slice(-1)

    return <div style={{ paddingTop: "5em" }}>
        <RS.Navbar expand="" className="navbar-dark bg-info fixed-top">
            <RS.Container>
                <NavbarBrand style={{ marginRight: "2em" }} href="/">
                    <img className="d-inline-block" style={{ maxHeight: "1em", maxWidth: "1em", marginRight: "10px" }} src="img/wallet.svg" />
                            Health Wallet Demo
                    </NavbarBrand>
                <NavbarToggler onClick={toggle}></NavbarToggler>
                <Collapse navbar isOpen={isOpen}>
                    <Nav navbar>
                        <NavLink href="#" onClick={connectTo('verifier')}> Open Employer Portal</NavLink>
                        <NavbarText>Help</NavbarText>
                        <NavbarText>About</NavbarText>
                    </Nav>
                </Collapse></RS.Container>
        </RS.Navbar>
        {siopAtNeedQr.length > 0 &&
            <SiopRequestReceiver
                onReady={onScanned}
                redirectMode="window-open"
                label={siopAtNeedQr[0].siopPartnerRole}
                startUrl={siopAtNeedQr[0].siopPartnerRole === 'issuer' ? 
                 props.issuer.issuerStartUrl: props.verifier.verifierStartUrl}
                interaction={siopAtNeedQr[0]} />}
        <SiopApprovalModal  {...parseSiopApprovalProps(holderState, onApproval, onDenial)} />

        <RS.Container >
            <RS.Row>
                <RS.Col xs="12">
                    <Card style={{ border: "1px solid grey", padding: ".5em", marginBottom: "1em" }}>
                        <CardTitle style={{ fontWeight: "bolder" }}>
                            ID Card
                    </CardTitle>
                        <CardSubtitle className="text-muted">This identifier is all yours, with keys stored safely on your device.</CardSubtitle>
                        <CardText style={{ fontFamily: "monospace" }}> {holderState.did.split('?')[0]}</CardText>
                    </Card>

                    {current_step == 4 && <Card style={{ border: "1px solid grey", padding: ".5em", marginBottom: "1em" }}>
                        <CardTitle style={{ fontWeight: "bolder" }}>
                            COVID Card
                    </CardTitle>
                        <CardSubtitle className="text-muted">Your COVID results are ready to share</CardSubtitle>
                        <CardText style={{ fontFamily: "monospace" }}> {holderState.vcStore[0].vc.slice(0, 100)}...</CardText>
                    </Card>}

                    {current_step < 4 &&
                        <Card style={{ border: ".25em dashed grey", padding: ".5em", marginBottom: "1em" }}>
                            <CardTitle style={{ fontWeight: "bolder" }}>
                                COVID Card
                        </CardTitle>
                            <CardSubtitle className="text-muted">You don't have a COVID card in your wallet yet.</CardSubtitle>

                            <Button disabled className="mb-1" color="info">
                                {current_step > 1 && '✓ '} 1. Set up your Health Wallet</Button>
                            <Button disabled={current_step !== 2} onClick={connectTo('issuer')} className="mb-1" color={current_step == 2 ? 'success' : 'info'}>
                                {current_step > 2 && '✓ '}
                             2. Find a lab and get tested</Button>
                            <Button disabled={current_step !== 3} onClick={retrieveVcClick} className="mb-1" color={current_step == 3 ? 'success' : 'info'} >
                                {current_step > 3 && '✓ '}
                            3. Save COVID card to wallet</Button>
                        </Card>
                    }
                    <Card style={{ padding: ".5em" }}>
                        <CardTitle style={{ fontWeight: "bolder" }}>
                            Debugging Details
                    </CardTitle>
                        <CardSubtitle className="text-muted">Just for developers to see what's going on</CardSubtitle>
                        <pre> {JSON.stringify({
                            ...holderState, ek: {
                                ...holderState.ek,
                                privateJwk: "redacted"
                            }, sk: {
                                ...holderState.sk,
                                privateJwk: "redacted"
                            }
                        }, null, 2)} </pre>
                    </Card>
                </RS.Col>
            </RS.Row>
        </RS.Container>
    </div>
}

export default async function main() {
    const simulatedBarcodeScan = !!window.location.search.match(/simulate-barcode/)
    if (simulatedBarcodeScan) {
        issuerWorld()
        verifierWorld()
    }
    const state = await initializeHolder();
    const queryProps = querystring.parse(window.location.search.slice(1))
    const issuerStartUrl = queryProps.issuerStartUrl as string || `./issuer.html?begin`
    const issuerDownloadUrl = queryProps.issuerDownloadUrl as string || `./issuer.html`
    const verifierStartUrl = queryProps.verifierStartUrl as string || `./verifier.html?begin`
    console.log("issuersta", issuerStartUrl)
    
    ReactDOM.render(
        <App initialState={state} simulatedBarcodeScan={simulatedBarcodeScan} verifier={{verifierStartUrl}} issuer={{issuerStartUrl, issuerDownloadUrl}} />,
        document.getElementById('app')
    );
}

main().then(r => console.log('Finished Holder Page,', r));