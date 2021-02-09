import axios from 'axios';
import base64 from 'base-64';
import 'bootstrap/dist/css/bootstrap.min.css';
import React, { useEffect, useState } from 'react';
import * as RS from 'reactstrap';
import { Button, Card, CardSubtitle, CardText, CardTitle, DropdownItem, DropdownMenu, DropdownToggle } from 'reactstrap';
import { HolderState, receiveVcs } from './holder';
import { SmartState, UiState } from './holder-page';
import './style.css';

enum CardStep {
    CONFIGURE_WALLET = 1,
    CONNECT_TO_ISSUER = 2,
    DOWNLOAD_CREDENTIAL = 3,
    COMPLETE = 4
}

const CovidCard: React.FC<{
    holderState: HolderState,
    smartState: SmartState,
    uiState: UiState,
    displayQr: (vc) => Promise<void>,
    openScannerUi: () => Promise<void>,
    connectToIssuer: () => Promise<void>,
    connectToFhir: () => Promise<void>,
    dispatchToHolder: (e: Promise<any>) => Promise<void>
}> = ({ holderState, smartState, uiState, displayQr, openScannerUi, connectToFhir, connectToIssuer, dispatchToHolder }) => {
    const issuerInteractions = holderState.interactions.filter(i => i.siopPartnerRole === 'issuer').slice(-1)
    const issuerInteraction = issuerInteractions.length ? issuerInteractions[0] : null


    let currentStep = CardStep.CONFIGURE_WALLET;
    /* tslint:disable-next-line:prefer-conditional-expression */
    if (issuerInteraction?.status !== 'complete') {
        currentStep = CardStep.CONNECT_TO_ISSUER;
    } else {
        currentStep = CardStep.DOWNLOAD_CREDENTIAL;
    }
    if (holderState.vcStore.length) {
        currentStep = CardStep.COMPLETE
    }

    const retrieveVcClick = async () => {
        const onMessage = async ({ data, source }) => {
            const { verifiableCredential } = data
            window.removeEventListener("message", onMessage)
            await dispatchToHolder(receiveVcs(verifiableCredential, holderState))
        }
        window.addEventListener("message", onMessage)
        window.open(uiState.issuer.issuerDownloadUrl)
    }

    useEffect(() => {
        if (smartState?.access_token && holderState.vcStore.length === 0) {
            const credentials = axios.post(uiState.fhirClient.server + `/Patient/${smartState.patient}/$HealthWallet.issueVc`, {
                "resourceType": "Parameters",
                "parameter": [{
                    "name": "credentialType",
                    "valueUri": "https://smarthealth.cards#immunization"
                },{
                    "name": "presentationContext",
                    "valueUri": "https://smarthealth.cards#presentation-context-online"
                }, {
                    "name": "encryptForKeyId",
                    "valueString": "#encryption-key-1"
                }]
            })
            credentials.then(response => {
                const vcs = response.data.parameter.filter(p => p.name === 'verifiableCredential').map(p => base64.decode(p.valueAttachment.data))
                dispatchToHolder(receiveVcs(vcs, holderState))
            })
        }
    }, [smartState])


    const covidVcs = holderState.vcStore.filter(vc => vc.type.includes("https://smarthealth.cards#covid19"));

    const resources = covidVcs.flatMap(vc =>
        vc.vcPayload.vc.credentialSubject.fhirBundle.entry
            .flatMap(e => e.resource))

    const doses = resources.filter(r => r.resourceType === 'Immunization').length;
    const patient = resources.filter(r => r.resourceType === 'Patient')[0];
    console.log("P", patient);


    useEffect(() => {
        if (covidVcs.length === 0) {
            return;
        }
        let file = new File([JSON.stringify({
            "verifiableCredential": covidVcs.map(v => v.vcSigned)
        })], "c19.smart-health-card", {
            type: "application/smart-health-card"
        })
        const url = window.URL.createObjectURL(file);
        setDownloadFileUrl(url)
    }, [covidVcs.length])
    const [downloadFileUrl, setDownloadFileUrl] = useState("");

    return <> {
        currentStep === CardStep.COMPLETE && <Card style={{ border: "1px solid grey", padding: ".5em", marginBottom: "1em" }}>
            <CardTitle style={{ fontWeight: "bolder" }}>
                COVID Cards ({covidVcs.length})
                </CardTitle>

            <CardSubtitle className="text-muted">Your COVID results are ready to share, based on {" "}
                {resources && <>{resources.length} FHIR Resource{resources.length > 1 ? "s" : ""} <br /> </>}
            </CardSubtitle>
            <ul>
                <li> Name: {patient.name[0].given[0]} {patient.name[0].family}</li>
                <li> Birthdate: {patient.birthDate}</li>
                <li> Immunization doses received: {doses}</li>
            </ul>
            <Button className="mb-1" color="info" onClick={() => displayQr(covidVcs[0])}>Display QR</Button>
            <a href={downloadFileUrl} download="covid19.smart-health-card">Download file</a>
        </Card>
    } {currentStep < CardStep.COMPLETE &&
        <Card style={{ border: ".25em dashed grey", padding: ".5em", marginBottom: "1em" }}>
            <CardTitle>COVID Cards </CardTitle>
            <CardSubtitle className="text-muted">You don't have any COVID cards in your wallet yet.</CardSubtitle>

            <Button disabled={true} className="mb-1" color="info">
                {currentStep > CardStep.CONFIGURE_WALLET && '✓ '} 1. Set up your Health Wallet</Button>

            <RS.UncontrolledButtonDropdown className="mb-1" >
                <DropdownToggle caret color={currentStep === CardStep.CONNECT_TO_ISSUER ? 'success' : 'info'} >
                    {currentStep > CardStep.CONNECT_TO_ISSUER && '✓ '}
                                    2. Get your Vaccination Credential
                                </DropdownToggle>
                <DropdownMenu style={{ width: "100%" }}>
                    <DropdownItem onClick={connectToFhir} >Connect with SMART on FHIR </DropdownItem>
                    <DropdownItem >Load from file (todo)</DropdownItem>
                    <DropdownItem onClick={openScannerUi} >Scan from QR (todo)</DropdownItem>
                </DropdownMenu>
            </RS.UncontrolledButtonDropdown>
            <Button
                disabled={currentStep !== CardStep.DOWNLOAD_CREDENTIAL}
                onClick={retrieveVcClick}
                className="mb-1"
                color={currentStep === CardStep.DOWNLOAD_CREDENTIAL ? 'success' : 'info'} >
                3. Save COVID card to wallet</Button>
        </Card>
        }
    </>

}

export default CovidCard;