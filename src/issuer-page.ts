import { issuerWorld } from './issuer';

export default async function main () {
    await Promise.all([issuerWorld('fragment', !!window.location.search.match(/begin/))]);
}
main().then(r => console.log('Finished Lab Page,', r));
