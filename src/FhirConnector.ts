import axios from 'axios';
import base64url from 'base64url';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as crypto from 'crypto';
import qs from 'querystring';
import React from 'react';
import { HolderState, receiveSiopRequest } from './holder';
import { UiState, SmartState } from './holder-page';

export interface FhirConnection {
    newSmartState: SmartState,
}

export default async (uiState: UiState, holderState: HolderState): Promise<FhirConnection> => {
    const state = base64url.encode(crypto.randomBytes(32));
    const redirect_uri = window.location.origin + window.location.pathname + 'authorized.html';
    const smartConfig = (await axios.get(uiState.fhirClient.server + '/.well-known/smart-configuration')).data;
    const authorize = smartConfig.authorization_endpoint;
    const token = smartConfig.token_endpoint;
    const authzWindow = window.open(authorize + '?' + qs.stringify({
        scope: uiState.fhirClient.scope,
        state,
        client_id: uiState.fhirClient.client_id,
        response_type: 'code',
        redirect_uri,
        aud: uiState.fhirClient.server
    }), '_blank');
    const code: string = await new Promise((resolve) => {
        window.addEventListener("message", function onAuth({ data, source, origin }) {
            if (origin !== window.location.origin)
                return;
            if (source !== authzWindow)
                return;
            const dataParsed = qs.parse(data);
            if (dataParsed.state !== state)
                return;
            window.removeEventListener("message", onAuth);
            authzWindow.close();
            resolve(dataParsed.code as string);
        });
    });
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${uiState.fhirClient.client_id}:${uiState.fhirClient.client_secret}`).toString("base64")}`
    };
    const accessTokenResponse = (await axios.post(token, qs.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri
    }), { headers })).data;

    const newSmartState: SmartState = { ...accessTokenResponse };
    return {
        newSmartState,
    };
}

