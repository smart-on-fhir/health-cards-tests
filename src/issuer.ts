import { initializeVerifier, prepareSiopRequest, receiveSiopResponse, verifierReducer, VerifierState, simulatedOccurrence, simulate } from './verifier';
import { sampleVc } from './fixtures';
import axios from 'axios';
import { serverBase } from './config';

import { encryptFor, generateDid, verifyJws } from './dids';
import Axios from 'axios';

export async function issuerWorld () {
    let state = await initializeVerifier({role: 'issuer', claimsRequired: []});
    const dispatch = async (ePromise) => {
        const e = await ePromise;
        const pre = state;
        state = await issuerReducer(state, e);
        console.log('Issuer Event', e.type, e, state);
    };
    console.log('Issuer initial state', state);
    await dispatch(prepareSiopRequest(state));
    await dispatch(receiveSiopResponse(state));
    await dispatch(issueVcToHolder(state));
    simulate({
        'type': 'notify-credential-ready',
        'who': state.config.role,
    });

}

const issueVcToHolder = async (state: VerifierState): Promise<any> => {
    const vcPayload = JSON.parse(JSON.stringify(sampleVc))
    const subjectDid = state.siopResponse.idTokenPayload.did
    vcPayload.credentialSubject.id =  subjectDid

    const vcSigned = await state.sk.sign({ kid: state.did + '#signing-key-1' }, vcPayload);
    const vcEncrypted = await encryptFor(vcSigned, subjectDid)
    const vcCreated = await axios.post(`${serverBase}/lab/vcs/${encodeURIComponent(subjectDid)}`, {
        vcs: [vcEncrypted]                
    })
    

    return({
        type: 'credential-ready'
    })

}

export async function issuerReducer (state: VerifierState, event: any): Promise<VerifierState> {
    if (event.type === 'credential-ready') {
        return {
            ...state,
            issuedCredentials: [state.siopResponse.idTokenPayload.did]
        }
    }

    return await verifierReducer.call(null, ...arguments);
}

