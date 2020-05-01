import { initializeVerifier, simulatedOccurrence, simulate, displayRequest, SiopRequestMode, receiveSiopResponse } from './verifier';
import axios from 'axios';
import { serverBase } from './config';

import { encryptFor, generateDid, verifyJws } from './dids';
import { VerifierState } from './VerifierState';
import { keyGenerators } from './keys';
import { prepareSiopRequest, verifierReducer, issuerReducer, issueVcToHolder } from './VerifierLogic';

export async function issuerWorld(requestMode: SiopRequestMode  = 'form_post', reset = false) {
    let state = await initializeVerifier({
        role: 'issuer',
        claimsRequired: [],
        requestMode: requestMode,
        reset,
        displayQr: false,
        postRequest: async (url, r) => (await axios.post(url, r)).data,
        serverBase,
        keyGenerators
    });
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
