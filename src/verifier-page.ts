import { verifierWorld } from './verifier';

export default async function main () {
    await Promise.all([verifierWorld(false)]);
}
main().then(r => console.log('Finished Verifier Page,', r));
