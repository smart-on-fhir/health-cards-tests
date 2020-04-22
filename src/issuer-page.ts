import { issuerWorld } from './issuer';

export default async function main () {
    await Promise.all([issuerWorld(false)]);
}
main().then(r => console.log('Finished Lab Page,', r));
