import { holderWorld, currentInteraction, initializeHolder, HolderState, holderReducer, receiveSiopRequest, retrieveVcs, prepareSiopResponse, SiopInteraction } from './holder';
import { simulatedOccurrence, verifierWorld, ClaimType, receiveSiopResponse } from './verifier'
import axios from 'axios';
import { issuerWorld } from './issuer'
import * as crypto from 'crypto';
import base64url from 'base64url';
import React, { useState, useEffect, useReducer, useRef, Ref, DOMElement, useCallback } from 'react';
import ReactDOM from 'react-dom';
import * as RS from 'reactstrap';
import { Navbar, NavbarBrand, NavItem, DropdownItem, DropdownMenu, UncontrolledDropdown, NavbarToggler, Nav, NavbarText, Collapse, NavLink, DropdownToggle, Card, Button, CardSubtitle, CardTitle, CardText } from 'reactstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import qs from 'querystring';


import QrScanner from 'qr-scanner';
QrScanner.WORKER_PATH = 'qr-scanner-worker.min.js';


type RedirectMode = "qr" | "window-open"
const SiopRequestReceiver: React.FC<{ label: string; redirectMode: RedirectMode; onReady: (s: string) => void; interaction: SiopInteraction, startUrl: string }> = (props) => {
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
interface VerifierProps {
    verifierStartUrl: string;
}

interface OAuthProps {
    client_id?: string;
    client_secret?: string;
    scope?: string;
    server?: string;
}

interface SmartState {
    access_token: string;
    patient: string;
    server: string;
}

const App: React.FC<{ initialState: HolderState, simulatedBarcodeScan: boolean, issuer: IssuerProps, verifier: VerifierProps, oauth: OAuthProps }> = (props) => {
    const [holderState, setHolderState] = useState<HolderState>(props.initialState)

    const [smartState, setSmartState] = useState<SmartState | null>(null)

    const issuerInteractions = holderState.interactions.filter(i => i.siopPartnerRole === 'issuer').slice(-1)
    const issuerInteraction = issuerInteractions.length ? issuerInteractions[0] : null

    const verifierInteractions = holderState.interactions.filter(i => i.siopPartnerRole === 'verifier').slice(-1)
    const verifierInteraction = verifierInteractions.length ? verifierInteractions[0] : null

    useEffect(()=> {
        if (smartState?.access_token && issuerInteraction?.siopResponse && holderState.vcStore.length === 0) {
            const credentials = axios.get(smartState.server + `/Patient/${smartState.patient}/$HealthWallet.issue`)
            credentials.then(response => {
                const vcs = response.data.parameter.filter(p => p.name === 'vc').map(p => p.valueString)
                dispatchToHolder(retrieveVcs(vcs, holderState))
            })
        }
    }, [smartState, holderState.interactions])

    useEffect(() => {
        holderState.interactions.filter(i => i.status === 'need-redirect').forEach(i => {
            const redirectUrl = i.siopRequest.client_id + '#' + qs.encode(i.siopResponse.formPostBody)
            const opened = window.open(redirectUrl, "issuer")
            dispatchToHolder({ 'type': "siop-response-complete" })
        })
    }, [holderState.interactions])

    const dispatchToHolder = async (ePromise) => {
        const e = await ePromise
        const holder = await holderReducer(holderState, e)
        setHolderState(state => holder)
        console.log("Holder state", e, holder)
    }

    const connectTo = who => async () => {
        dispatchToHolder({ 'type': 'begin-interaction', who })
    }

    const retrieveVcClick = async () => {
        const onMessage = async ({ data, source }) => {
            const { vcs } = data
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
        console.log("PRepare response to", who)
        await dispatchToHolder(prepareSiopResponse(holderState));
    }

    const onDenial = who => async () => {
        await dispatchToHolder({ type: "siop-response-complete" });
    }

    const fhirConnect = async () => {
        const state = base64url.encode(crypto.randomBytes(32))
        const server = props.oauth?.server || './api/fhir'
        const client_id = props.oauth?.client_id || 'sample_client_id'
        const client_secret = props.oauth?.client_secret || 'sample_client_secret'
        const scope = props.oauth?.scope || 'launch launch/patient patient/*.*'
        const redirect_uri = window.location.origin + window.location.pathname + 'authorized.html'

        const smartConfig = (await axios.get(server + '/.well-known/smart-configuration.json')).data

        const authorize = smartConfig.authorization_endpoint
        const token = smartConfig.token_endpoint
        const authzWindow = window.open(authorize + '?' + qs.stringify({
            scope,
            state,
            client_id,
            response_type: 'code',
            redirect_uri,
            aud: server
        }), '_blank')

        const code: string = await new Promise((resolve) => {
            window.addEventListener("message", function onAuth({ data, source, origin }) {
                if (origin !== window.location.origin) return
                if (source !== authzWindow) return
                const dataParsed = qs.parse(data)
                if (dataParsed.state !== state) return
                window.removeEventListener("message", onAuth)
                authzWindow.close()
                resolve(dataParsed.code as string)
            })
        })
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${client_id}:${client_secret}`).toString("base64")}`
        }
        const accessTokenResponse = (await axios.post(token, qs.stringify({
            grant_type: "authorization_code",
            code,
            redirect_uri
        }), { headers })).data

        setSmartState({...accessTokenResponse, server} as SmartState)
        const siopParameters = (await axios.get(server + `/Patient/${accessTokenResponse.patient}/$HealthWallet.connect`)).data
        const siopUrl = siopParameters.parameter.filter(p => p.name === 'openidUrl').map(p => p.valueUrl)[0]
        await dispatchToHolder(receiveSiopRequest(siopUrl, holderState))
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
                        <NavLink href="#" onClick={fhirConnect}> Connect to Lab via FHIR API</NavLink>
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
                    props.issuer.issuerStartUrl : props.verifier.verifierStartUrl}
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
                        <CardText style={{ fontFamily: "monospace" }}>
                            <pre>
                            {holderState.vcStore[0].vc.slice(0,25)}...
                            </pre>
                            <pre>
                            {JSON.stringify(holderState.vcStore[0], null)}
                            </pre>
                            
                            </CardText>
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
    const queryProps = qs.parse(window.location.search.slice(1))
    const issuerStartUrl = queryProps.issuerStartUrl as string || `./issuer.html?begin`
    const issuerDownloadUrl = queryProps.issuerDownloadUrl as string || `./issuer.html`
    const verifierStartUrl = queryProps.verifierStartUrl as string || `./verifier.html?begin`
    console.log("issuersta", issuerStartUrl)

    ReactDOM.render(
        <App initialState={state}
            simulatedBarcodeScan={simulatedBarcodeScan}
            verifier={{ verifierStartUrl }}
            issuer={{ issuerStartUrl, issuerDownloadUrl }}
            oauth={{}} />,
        document.getElementById('app')
    );
}

main().then(r => console.log('Finished Holder Page,', r));