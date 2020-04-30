import { initializeVerifier, prepareSiopRequest, receiveSiopResponse, verifierReducer, VerifierState, simulatedOccurrence, simulate, displayRequest, SiopRequestMode } from './verifier';
import { sampleVc } from './fixtures';
import axios from 'axios';
import { serverBase } from './config';

import { encryptFor, generateDid, verifyJws } from './dids';
import Axios from 'axios';

export async function issuerWorld(requestMode: SiopRequestMode  = 'form_post', reset = false) {
    let state = await initializeVerifier({ role: 'issuer', claimsRequired: [], requestMode: requestMode, reset, displayQr: false});
    const dispatch = async (ePromise) => {
        const e = await ePromise;
        const pre = state;
        state = await issuerReducer(state, e);
        console.log('Issuer Event', e.type, e, state);
    };
    console.log('Issuer initial state', state);

    if (!state.siopRequest) {
        await dispatch(prepareSiopRequest(state));
        displayRequest(state)
    }

    if (!state.siopResponse) {
        await dispatch(receiveSiopResponse(state));
        await dispatch(issueVcToHolder(state));
    }
    
    if (state.fragment?.id_token) {
        displayThanks(state)
    } else {
        displayResponse(state)
    }
}

export function displayThanks(state) {
    const link = document.getElementById('redirect-link');
    if (link) {
        window['clickRedirect'] = function () {
            window.localStorage[state.config.role + '_state'] = JSON.stringify(state)
            window.close()
        }

        link.innerHTML = "Thanks for getting tested. Your result will be ready soon. <button  onclick=\"clickRedirect()\">Close</button>";
    }

}


export function displayResponse(state: VerifierState) {
    simulate({
        'type': 'notify-credential-ready',
        'who': state.config.role,
    });

    const link = document.getElementById('redirect-link');
    if (link) {
        window['clickRedirect'] = function () {
            window.localStorage[state.config.role + '_state'] = JSON.stringify(state)
            window.opener.postMessage({
                "type": "credential-ready",
                "vcs": state.issuedCredentials
            }, "*")
            window.close()
        }

        link.innerHTML = "<button  onclick=\"clickRedirect()\">Download credential</button>";
    }
}



const issueVcToHolder = async (state: VerifierState): Promise<any> => {
    const vcPayload = JSON.parse(JSON.stringify(sampleVc))
    const subjectDid = state.siopResponse.idTokenPayload.did
    vcPayload.credentialSubject.id = subjectDid

    const vcSigned = await state.sk.sign({ kid: state.did + '#signing-key-1' }, vcPayload);
    const vcEncrypted = await encryptFor(vcSigned, subjectDid)
    const vcCreated = await axios.post(`${serverBase}/lab/vcs/${encodeURIComponent(subjectDid)}`, {
        vcs: [vcEncrypted]
    })


    return ({
        type: 'credential-ready',
        vcs: [vcEncrypted]
    })

}

export async function issuerReducer(state: VerifierState, event: any): Promise<VerifierState> {
    if (event.type === 'credential-ready') {
        return {
            ...state,
            issuedCredentials: event.vcs
        }
    }

    return await verifierReducer.call(null, ...arguments);
}

