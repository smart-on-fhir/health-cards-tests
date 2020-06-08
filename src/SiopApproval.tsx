import 'bootstrap/dist/css/bootstrap.min.css';
import QrScanner from "qr-scanner";
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { HolderState, SiopInteraction, prepareSiopResponse } from "./holder";
import './style.css';
import { ClaimType } from "./VerifierState";
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, InputGroup, InputGroupAddon, InputGroupText, Input } from 'reactstrap';

type RedirectMode = "qr" | "window-open"
QrScanner.WORKER_PATH = 'qr-scanner-worker.min.js';

export interface SiopRequestReceiverProps {
    label: string;
    redirectMode: RedirectMode;
    onReady: (s: string) => void;
    onCancel?: () => void;
    startUrl?: string;
}

export const SiopRequestReceiver: React.FC<SiopRequestReceiverProps> = (props) => {

    const [currentCode, setCurrentCode] = useState("")

    const runningQrScanner = useRef(null)

    let qrScanner; // scope bound to callback
    const videoCallback = useCallback((videoElement) => {
        if (!videoElement) {
            if (qrScanner) {
                qrScanner.destroy()
            }
            return;
        }
        qrScanner = new QrScanner(videoElement, result => {
            if (result.length)
                props.onReady(result)
        });
        runningQrScanner.current = qrScanner 
        qrScanner.start();
    }, [])

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
    }, [])

    return props.redirectMode === "qr" ? <>
        <Modal isOpen={true}>
            <ModalHeader>Connect to {props.label}</ModalHeader>
            <ModalBody>
                <div>Scan a QR Code</div>
                <video ref={videoCallback} style={{ maxWidth: "100vw", maxHeight: "50vh" }} />
            </ModalBody>
            <ModalFooter  >
                <InputGroup>
                    <Input placeholder="Or paste a URL directly..." type="text" autoFocus={true} value={currentCode} onChange={e => setCurrentCode(e.target.value)}>
                    </Input>
                </InputGroup>

                {props.onCancel ?
                    <Button color="error" onClick={e => props.onCancel()}>
                        Cancel
                </Button> : ""
                }

                <Button color="success" onClick={e => props.onReady(currentCode)}>
                    Connect
                </Button>

            </ModalFooter>
        </Modal>
    </> : <>
            <span>Waiting for redirect...</span>
        </>
}

export interface SiopApprovalProps {
    share: ClaimType[];
    with: string;
    onApproval: () => void;
    onDenial: () => void;
}

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

export const parseSiopApprovalProps = (holderState: HolderState, dispatchToHolder: any): SiopApprovalProps | null => {
    const siopAtNeedApproval = holderState.interactions.filter(i => i.status === 'need-approval').slice(-1)
    if (siopAtNeedApproval.length === 0) {
        return null
    }

    const req = siopAtNeedApproval[0]
    const claims = Object
        .keys(req.siopRequest?.claims?.id_token || {}) as ClaimType[]

    // TODO replace this with SIOP registratation data + whitelist based lookup
    const issuerName = req.siopPartnerRole === 'issuer' ? 'Lab' : 'Employer'

    const onApproval = who => async () => {
        await dispatchToHolder(prepareSiopResponse(holderState));
    }

    const onDenial = who => async () => {
        await dispatchToHolder({ type: "siop-response-complete" });
    }


    return {
        share: claims,
        with: req.siopPartnerRole,
        onApproval: onApproval(req.siopPartnerRole),
        onDenial: onDenial(req.siopPartnerRole)
    }
}

