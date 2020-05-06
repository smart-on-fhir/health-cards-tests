import 'bootstrap/dist/css/bootstrap.min.css';
import QrScanner from "qr-scanner";
import React, { useEffect, useRef } from 'react';
import { HolderState, SiopInteraction, prepareSiopResponse } from "./holder";
import './style.css';
import { ClaimType } from "./VerifierState";

type RedirectMode = "qr" | "window-open"
QrScanner.WORKER_PATH = 'qr-scanner-worker.min.js';

export interface SiopRequestReceiverProps {
    label: string;
    redirectMode: RedirectMode;
    onReady: (s: string) => void;
    interaction: SiopInteraction;
    startUrl: string;
}

export const SiopRequestReceiver: React.FC<SiopRequestReceiverProps> = (props) => {
    const videoRef = useRef()
    useEffect(() => {
        if (!videoRef.current) { return; }
        let qrScanner = new QrScanner(videoRef.current, result => {
            if (result.length)
                props.onReady(result)
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
        <video ref={videoRef} style={{ width: "25vmin", height: "25vmin" }} />
        <br />
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

