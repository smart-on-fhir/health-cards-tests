import React, { useCallback, useState } from 'react';
import { Button, InputGroupAddon, ModalHeader, Modal, ModalBody, ModalFooter, InputGroup, InputGroupText, Input } from 'reactstrap';
import { UiState } from './holder-page';
import { SiopApprovalProps } from './SiopApproval';
import { HealthCard } from './siop';
import { HolderState } from './holder';
import { QrDisplay } from './venue-page';

const ConfigEditOption: React.FC<{
    title: string;
    default: string;
    value: string;
    onChange: (string) => void;
}> = (props) => {
    return <>
        <InputGroup>
            <InputGroupAddon addonType='prepend' className='config-prepend'>
                <InputGroupText>{props.title}</InputGroupText>
            </InputGroupAddon>
            <Input type="text" value={props.value} onChange={e => props.onChange(e.target.value)}>
            </Input>
            <InputGroupAddon addonType="prepend">
                <Button onClick={e => props.onChange(props.default)}>↻</Button>
            </InputGroupAddon>
        </InputGroup>
        <br />
    </>;
};
export const ConfigEditModal: React.FC<{
    defaultUiState: UiState;
    uiState: UiState;
    dispatch: any;
}> = ({ defaultUiState, uiState, dispatch }) => {

    const onSave = ui => {
        window.location.hash = JSON.stringify({ ...ui, editingConfig: undefined }, null, 0)
        dispatch({ type: 'save-ui-state', newState: ui })
    }
    const onDiscard = () => {
        dispatch({ type: 'toggle-editing-config' });
    }

    const [ui, setUi] = useState(uiState);
    return <>
        <Modal isOpen={true}>
            <ModalHeader>Edit Config Settings</ModalHeader>
            <ModalBody>
                <ConfigEditOption
                    title="FHIR Server"
                    default={defaultUiState.fhirClient.server}
                    value={ui.fhirClient.server}
                    onChange={v => setUi({ ...ui, fhirClient: { ...ui.fhirClient, server: v } })} />
                <ConfigEditOption
                    title="Client ID"
                    default={defaultUiState.fhirClient.client_id}
                    value={ui.fhirClient.client_id}
                    onChange={v => setUi({ ...ui, fhirClient: { ...ui.fhirClient, client_id: v } })} />
                <ConfigEditOption
                    title="Client Secret"
                    default={defaultUiState.fhirClient.client_secret}
                    value={ui.fhirClient.client_secret}
                    onChange={v => setUi({ ...ui, fhirClient: { ...ui.fhirClient, client_secret: v } })} />
                <ConfigEditOption
                    title="Scopes"
                    default={defaultUiState.fhirClient.scope}
                    value={ui.fhirClient.scope}
                    onChange={v => setUi({ ...ui, fhirClient: { ...ui.fhirClient, scope: v } })} />
            </ModalBody>
            <ModalFooter>
                <Button color="danger" onClick={e => onDiscard()}>Cancel</Button>
                <Button color="success" onClick={e => onSave(ui)}>Save to Bookmarkable URL</Button>
            </ModalFooter>
        </Modal>
    </>;
};


interface QrPresentationState {
    healthCard: HolderState["vcStore"][number],
    dispatch: any
}
export const QRPresentationModal: React.FC<QrPresentationState> = ({ healthCard, dispatch }) => {
    const done = () => {
        dispatch({ type: 'end-qr-presentation' });
    }

    const SMALLEST_B64_CHAR_CODE = 45; // "-".charCodeAt(0) === 45
    const encodeToNumeric = (jws: string): number[] => jws
        .split("")
        .map(c => c.charCodeAt(0) - SMALLEST_B64_CHAR_CODE)
        .flatMap(c => [
            Math.floor(c / 10),
            c % 10
        ]);

    return <>
        <Modal isOpen={true}>
            <ModalHeader>Present Health Card</ModalHeader>
            <ModalBody><QrDisplay numeric={encodeToNumeric(healthCard.vcSigned)} noLink={true}></QrDisplay></ModalBody>
            <ModalFooter className="json"><pre>{JSON.stringify(healthCard.vcPayload, null, 2)}</pre></ModalFooter>
            <ModalFooter>
                <Button color="success" onClick={e => done()}>Done</Button>
            </ModalFooter>
        </Modal>
    </>
}