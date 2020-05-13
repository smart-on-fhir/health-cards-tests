import axios from 'axios';
import base64 from 'base-64';
import 'bootstrap/dist/css/bootstrap.min.css';
import React, { useEffect } from 'react';
import * as RS from 'reactstrap';
import { Button, Card, CardSubtitle, CardText, CardTitle, DropdownItem, DropdownMenu, DropdownToggle } from 'reactstrap';
import { HolderState, retrieveVcs } from './holder';
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
    connectToIssuer: () => Promise<void>,
    connectToFhir: () => Promise<void>,
    dispatchToHolder: (e: Promise<any>) => Promise<void>
}> = ({ holderState, smartState, uiState, connectToFhir, connectToIssuer, dispatchToHolder }) => {
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
            const { vcs } = data
            window.removeEventListener("message", onMessage)
            console.log("Dispatch,", vcs, holderState)
            await dispatchToHolder(retrieveVcs(vcs, holderState))
        }
        window.addEventListener("message", onMessage)
        window.open(uiState.issuer.issuerDownloadUrl)
    }


    useEffect(() => {
        if (smartState?.access_token && issuerInteraction?.siopResponse && holderState.vcStore.length === 0) {

            const credentials = axios.get(uiState.fhirClient.server + `/DiagnosticReport?patient=${smartState.patient}&_tag=https://healthwallet.cards|covid19`)
            credentials.then(response => {
                const vcs = response.data.entry[0].resource.extension
                    .filter(e => e.url === 'https://healthwallet.cards#vc-attachment')
                    .map(e => base64.decode(e.valueAttachment.data))

                dispatchToHolder(retrieveVcs(vcs, holderState))
            })
            /* 
             const credentials = axios.get(smartState.server + `/Patient/${smartState.patient}/$HealthWallet.issue`)
             credentials.then(response => {
                 const vcs = response.data.parameter.filter(p => p.name === 'vc').map(p => p.valueString)
                 dispatchToHolder(retrieveVcs(vcs, holderState))
             })
             */
        }
    }, [smartState, holderState.interactions])

    const conclusions = holderState.vcStore.flatMap(vc =>
        vc.vcPayload.vc.fhirBundle.entry
            .filter(e => e.resource.resourceType === 'DiagnosticReport')
            .flatMap(e => e.resource.conclusion))

    const resources = holderState.vcStore.flatMap(vc =>
        vc.vcPayload.vc.fhirBundle.entry
            .flatMap(e => e.resource))


    return <> {
        currentStep === CardStep.COMPLETE && <Card style={{ border: "1px solid grey", padding: ".5em", marginBottom: "1em" }}>
            <CardTitle style={{ fontWeight: "bolder" }}>
                COVID Card
                </CardTitle>

            <CardSubtitle className="text-muted">Your COVID results are ready to share, based on {" "}
                {resources && <>{resources.length} FHIR Resource{resources.length > 1 ? "s" : ""} <br /> </>}
            </CardSubtitle>
            <CardText style={{ fontFamily: "monospace" }}>
                <span>
                    Conclusions: {conclusions && conclusions.join("\n ")}
                </span>
            </CardText>
        </Card>
    } {currentStep < CardStep.COMPLETE &&
        <Card style={{ border: ".25em dashed grey", padding: ".5em", marginBottom: "1em" }}>
            <CardTitle>COVID Card </CardTitle>
            <CardSubtitle className="text-muted">You don't have a COVID card in your wallet yet.</CardSubtitle>

            <Button disabled={true} className="mb-1" color="info">
                {currentStep > CardStep.CONFIGURE_WALLET && '✓ '} 1. Set up your Health Wallet</Button>

            <RS.UncontrolledButtonDropdown className="mb-1" >
                <DropdownToggle caret color={currentStep === CardStep.CONNECT_TO_ISSUER ? 'success' : 'info'} >
                    {currentStep > CardStep.CONNECT_TO_ISSUER && '✓ '}
                                    2. Connect to Lab and get tested
                                </DropdownToggle>
                <DropdownMenu style={{ width: "100%" }}>
                    <DropdownItem onClick={connectToFhir} >Connect with SMART on FHIR </DropdownItem>
                    <DropdownItem onClick={connectToIssuer} >Start from Lab Portal</DropdownItem>
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