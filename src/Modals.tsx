import React, { useCallback, useState } from 'react';
import { Button, InputGroupAddon, ModalHeader, Modal, ModalBody, ModalFooter, InputGroup, InputGroupText, Input } from 'reactstrap';
import { UiState } from './holder-page';
import { SiopApprovalProps } from './SiopApproval';

export const SiopApprovalModal: React.FC<SiopApprovalProps | null> = (props) => {
    if (!props.onApproval) {
        return null;
    }
    const focusCallback = useCallback(b => {
        setTimeout(() => b && b.focus());
    }, []);
    return <>
        <Modal isOpen={true}>
            <ModalHeader>Share with {props.with}?</ModalHeader>
            <ModalBody>The following details will be shared:
        <ul>
                    <li><b>Your ID Card:</b> allows secure communications</li>
                    {props.share.includes('https://healthwallet.cards#covid19') && <li>
                        <b>Your COVID Card:</b> labs and vaccines for COVID-19
            </li>}
                    {props.share.includes('https://healthwallet.cards#immunization') && <li>
                        <b>Your Immunizations Card:</b> full vaccine history
            </li>}
                </ul>
            </ModalBody>
            <ModalFooter>
                <Button color="danger" onClick={props.onDenial}>Do not share</Button>
                <Button innerRef={focusCallback} color="success" onClick={props.onApproval}>
                    Share {props.share.length > 0 ? "these cards" : "this card"}
                </Button>
            </ModalFooter>
        </Modal>
    </>;
};
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
