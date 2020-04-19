import * as crypto from 'crypto';
import { holderWorld } from './holder';
import { verifierWorld } from './verifier';

export default async function main () {
    await Promise.all([holderWorld(true), verifierWorld(true)]);
}

main().then(r => console.log('Resolved,', r));
