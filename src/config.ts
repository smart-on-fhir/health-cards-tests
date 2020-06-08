export let serverBase = process.env.SERVER_BASE || 'relative';
if (serverBase === 'relative') {
    serverBase = window.location.origin + '/api';
}
export const resolveUrl = `${serverBase}/did/`;

console.log('SERVER base', process.env, process.env.SERVER_BASE, serverBase);
