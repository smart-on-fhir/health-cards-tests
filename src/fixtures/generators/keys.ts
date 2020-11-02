
import jose from 'node-jose';

const keystore = jose.JWK.createKeyStore();
const encryptionKeyPros = {
    "kty": "EC",
    "crv": "P-256",
    "alg": 'ECDH-ES',
}


async function main() {
    const key = await keystore.generate("EC", "P-256", encryptionKeyPros);
    console.log(key.toJSON(true))
}

main()