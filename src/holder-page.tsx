import axios from 'axios';
import base64url from 'base64url';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as crypto from 'crypto';
import qs from 'querystring';
import React, { useEffect, useReducer, useState } from 'react';
import ReactDOM from 'react-dom';
import * as RS from 'reactstrap';
import { Button, Card, CardSubtitle, CardText, CardTitle, Collapse, DropdownItem, DropdownMenu, DropdownToggle, Nav, NavbarBrand, NavbarToggler, NavLink } from 'reactstrap';
import * as config from './config';
import { holderReducer, HolderState, initializeHolder, prepareSiopResponse, receiveSiopRequest, retrieveVcs } from './holder';
import { issuerWorld } from './issuer';
import { ConfigEditModal, SiopApprovalModal } from './Modals';
import './style.css';
import { verifierWorld } from './verifier';
import { SiopRequestReceiver, parseSiopApprovalProps } from './SiopApproval';
import makeFhirConnector from './FhirConnector';
import CovidCard from './CovidCard';

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

export interface SmartState {
    access_token: string;
    patient: string;
}

export interface UiState {
    issuer: IssuerProps,
    verifier: VerifierProps,
    fhirClient: OAuthProps,
    editingConfig?: boolean
}

interface AppProps {
    initialHolderState: HolderState;
    simulatedBarcodeScan: boolean;
    initialUiState: UiState;
    defaultUiState: UiState;
}

type UiEvent = { type: 'save-ui-state', newState: UiState } | { type: 'toggle-editing-config' }

const uiReducer = (prevState: UiState, action: UiEvent): UiState => {
    if (action.type === 'save-ui-state') {
        return {
            ...action.newState,
            editingConfig: false
        }
    }

    if (action.type === 'toggle-editing-config') {
        return {
            ...prevState,
            editingConfig: !prevState.editingConfig
        }
    }
}

const App: React.FC<AppProps> = (props) => {
    const [holderState, setHolderState] = useState<HolderState>(props.initialHolderState)
    const [uiState, dispatch] = useReducer(uiReducer, props.initialUiState)

    const [smartState, setSmartState] = useState<SmartState | null>(null)

    const issuerInteractions = holderState.interactions.filter(i => i.siopPartnerRole === 'issuer').slice(-1)
    const verifierInteractions = holderState.interactions.filter(i => i.siopPartnerRole === 'verifier').slice(-1)
    const siopAtNeedQr = issuerInteractions.concat(verifierInteractions).filter(i => i.status === 'need-qrcode').slice(-1)

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
        console.log("After event", e, "Holder state is", holder)
    }

    const connectTo = who => async () => {
        dispatchToHolder({ 'type': 'begin-interaction', who })
    }

    const onScanned = async (qrCodeUrl: string) => {
        await dispatchToHolder(receiveSiopRequest(qrCodeUrl, holderState));
    }

    const connectToFhir = async () => {
        const connected = await makeFhirConnector(uiState, holderState)
        setSmartState(connected.newSmartState)
        dispatchToHolder(receiveSiopRequest(connected.siopUrl, holderState))
    }

    const [isOpen, setIsOpen] = useState(false);
    const toggle = () => setIsOpen(!isOpen);


    return <div style={{ paddingTop: "5em" }}>
        <RS.Navbar expand="" className="navbar-dark bg-info fixed-top">
            <RS.Container>
                <NavbarBrand style={{ marginRight: "2em" }} href="/">
                    <img className="d-inline-block" style={{ maxHeight: "1em", maxWidth: "1em", marginRight: "10px" }} src="img/wallet.svg" />
                            Health Wallet Demo
                    </NavbarBrand>
                <NavbarToggler onClick={toggle} />
                <Collapse navbar={true} isOpen={isOpen}>
                    <Nav navbar={true}>
                        <NavLink href="#" onClick={connectTo('verifier')}> Open Employer Portal</NavLink>
                        <NavLink href="#config" onClick={e => dispatch({ type: 'toggle-editing-config' })}> Edit Config</NavLink>
                        <NavLink target="_blank" href="https://github.com/microsoft-healthcare-madison/health-wallet-demo">Source on GitHub</NavLink>
                    </Nav>
                </Collapse></RS.Container>
        </RS.Navbar>

        {siopAtNeedQr.length > 0 &&
            <SiopRequestReceiver
                onReady={onScanned}
                redirectMode="window-open"
                label={siopAtNeedQr[0].siopPartnerRole}
                startUrl={siopAtNeedQr[0].siopPartnerRole === 'issuer' ? uiState.issuer.issuerStartUrl : uiState.verifier.verifierStartUrl}
                interaction={siopAtNeedQr[0]} />}

        {uiState.editingConfig && <ConfigEditModal uiState={uiState} defaultUiState={props.defaultUiState} dispatch={dispatch} />}

        <SiopApprovalModal  {...parseSiopApprovalProps(holderState, dispatchToHolder)} />

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
                    <CovidCard
                        holderState={holderState}
                        smartState={smartState}
                        uiState={uiState}
                        connectToIssuer={connectTo('issuer')}
                        connectToFhir={connectToFhir}
                        dispatchToHolder={dispatchToHolder}
                    />
                    <Card style={{ padding: ".5em" }}>
                        <CardTitle style={{ fontWeight: "bolder" }}>
                            Debugging Details
                        </CardTitle>
                        <CardSubtitle className="text-muted">Your browser's dev tools will show details on current page state + events </CardSubtitle>
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


    const defaultUiState: UiState = {
        issuer: {
            issuerStartUrl: './issuer.html?begin',
            issuerDownloadUrl: './issuer.html'
        },
        verifier: {
            verifierStartUrl: './verifier.html?begin'
        },
        fhirClient: {
            server: config.serverBase + '/fhir',
            client_id: 'sample_client_id',
            client_secret: 'sample_client_secret',
            scope: 'launch launch/patient patient/*.*'
        }
    }

    let initialUiState: UiState = defaultUiState

    try {
        initialUiState = JSON.parse(decodeURIComponent(window.location.hash.slice(1))) as UiState
    } catch (e) {
        console.log("No default UI state from url")
    }

    ReactDOM.render(
        <App initialHolderState={state}
            simulatedBarcodeScan={simulatedBarcodeScan}
            initialUiState={initialUiState}
            defaultUiState={defaultUiState}
        />, document.getElementById('app')
    );
}

main().then(r => console.log('Finished Holder Page,', r));