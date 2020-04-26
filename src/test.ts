import * as crypto from 'crypto';
import { issuerWorld } from './issuer';
import { holderWorld } from './holder';
import { verifierWorld } from './verifier';

export default async function main () {
    await Promise.all([issuerWorld('form_post', true), holderWorld(), verifierWorld('verifier', 'form_post', true)]);
}

main().then(r => console.log('Resolved,', r));
