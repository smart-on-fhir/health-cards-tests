import { holderWorld } from './holder';

export default async function main () {
    await Promise.all([holderWorld(false)]);
}
main().then(r => console.log('Finished Holder Page,', r));
