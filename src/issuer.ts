import { initializeVerifier, prepareSiopRequest, receiveSiopResponse, verifierEvent, VerifierState, simulatedOccurrence, simulate } from './verifier';
import { sampleVc } from './fixtures';
import axios from 'axios';
import { serverBase } from './config';

import { encryptFor, generateDid, verifyJws } from './dids';
import Axios from 'axios';

export async function issuerWorld (simulated: boolean) {
    let state = await initializeVerifier({simulated, role: 'issuer', claimsRequired: []});
    const event = async (e) => {
        const pre = state;
        state = await issuerEvent(state, e);
        console.log('Issuer Event', e.type, e, state);
    };
    console.log('Issuer initial state', state);
    await prepareSiopRequest(state, event);
    await receiveSiopResponse(state, event);
    await issueVcToHolder(state, event);
}

const issueVcToHolder = async (state: VerifierState, event: any): Promise<void> => {
    const vcPayload = JSON.parse(JSON.stringify(sampleVc))
    const subjectDid = state.siopResponse.idTokenPayload.did
    vcPayload.credentialSubject.id =  subjectDid

    const vcSigned = await state.sk.sign({ kid: state.did + '#signing-key-1' }, vcPayload);
    const vcEncrypted = await encryptFor(vcSigned, subjectDid)
    const vcCreated = await axios.post(`${serverBase}/lab/vcs/${encodeURIComponent(subjectDid)}`, {
        vcs: [vcEncrypted]                
    })

    event({
        type: 'credential-ready'
    })

    if (state.config.simulated) {
        simulate({
            'type': 'notify-credential-ready',
            'who': state.config.role,
        });
    }
 

    return
}

export async function issuerEvent (state: VerifierState, event: any): Promise<VerifierState> {
    if (event.type === 'credential-ready') {
        return {
            ...state,
            issuedCredentials: [state.siopResponse.idTokenPayload.did]
        }
    }

    return await verifierEvent.call(null, ...arguments);
}

