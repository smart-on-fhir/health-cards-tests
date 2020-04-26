import { verifierWorld } from './verifier';

export default async function main () {
    await Promise.all([verifierWorld('verifier', 'fragment', !!window.location.search.match(/begin/))]);
}
main().then(r => console.log('Finished Verifier Page,', r));
