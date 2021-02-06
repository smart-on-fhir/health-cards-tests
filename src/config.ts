import holderJwks  from './config/holder.jwks.private.json';
import issuerJwks  from './config/issuer.jwks.private.json';
import verifierJwks from './config/verifier.jwks.private.json';

export const privateJwks = {
    holder: holderJwks,
    issuer: issuerJwks,
    verifier: verifierJwks
};

const toPublic = (keys) => ({
    keys: keys.keys.map(k1 => ({
        ...k1,
        d: undefined
    }))
});

export const publicJwks = {
    holder: toPublic(privateJwks.holder),
    issuer: toPublic(privateJwks.issuer),
    verifier: toPublic(privateJwks.verifier)
};


export let serverBase = process.env.SERVER_BASE || 'relative';
if (serverBase === 'relative' && window?.location?.origin) {
    serverBase = window.location.origin + '/api';
}

export const resolveUrl = `${serverBase}/did/`;
export const ALLOW_INVALID_SIGNATURES=false;


console.log('SERVER base', process.env, process.env.SERVER_BASE, serverBase);
