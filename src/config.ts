export let serverBase = process.env.SERVER_BASE || 'http://localhost:8080/api';
if (serverBase === 'relative') {
    serverBase = window.location.origin + '/api';
}
export const resolveUrl = `${serverBase}/did/`;

console.log('SERVER base', process.env, process.env.SERVER_BASE, serverBase);
