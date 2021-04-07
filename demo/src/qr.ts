// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// converts SMART Health Card numeric QR chunks into a JWS
export function qrChunksToJws(shc: string[]): string {
    const chunkCount = shc.length;
    const jwsChunks = new Array<string>(chunkCount);

    for (const shcChunk of shc) {
        const chunkResult = qrChunkToJws(shcChunk, chunkCount);
        if (!chunkResult) throw "Invalid QR chunk";
        const chunkIndex = chunkResult.chunkIndex;
        if (jwsChunks[chunkIndex - 1]) {
            // we have a chunk index collision
            throw `Colliding QR chunks with index ${chunkIndex}`;
        } else {
            jwsChunks[chunkIndex - 1] = chunkResult.result;
        }
    }

    // make sure we have all chunks we expect
    for (let i = 0; i < chunkCount; i++) {
        if (!jwsChunks[i]) throw `Missing QR chunk with index ${i}`;
    }

    return jwsChunks.join('');
}

function qrChunkToJws(shc: string, chunkCount = 1): { result: string, chunkIndex: number } {
    let chunked = chunkCount > 1;
    const qrHeader = 'shc:/';
    let chunkIndex = 1;

    // check numeric QR header
    const isChunkedHeader = new RegExp(`^${qrHeader}[0-9]/${chunkCount}/.+$`).test(shc);
    if (chunked) {
        if (!isChunkedHeader) {
            // should have been a valid chunked header, check if we are missing one
            const hasBadChunkCount = new RegExp(`^${qrHeader}[0-9]/[0-9]/.+$`).test(shc);
            if (hasBadChunkCount) {
                const expectedChunkCount = parseInt(shc.substring(7, 8));
                throw `Missing QR code chunk: received ${chunkCount}, expected ${expectedChunkCount}`;

            }
        }
    }

    if (!new RegExp(chunked ? `^${qrHeader}[0-9]/${chunkCount}/.+$` : `^${qrHeader}.+$`, 'g').test(shc)) {
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        const expectedHeader = chunked ? `${qrHeader}[0-9]+` : `${qrHeader}[0-9]/[0-9]/[0-9]+`;
        throw `Invalid numeric QR header: expected ${expectedHeader}`;
    }
    // check numeric QR encoding
    if (!new RegExp(chunked ? `^${qrHeader}[0-9]/${chunkCount}/[0-9]+$` : `^${qrHeader}[0-9]+$`, 'g').test(shc)) {
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        const expectedBody = chunked ? `${qrHeader}[0-9]+` : `${qrHeader}[0-9]/[0-9]/[0-9]+`;
        throw `Invalid numeric QR: expected ${expectedBody}`;
    }

    // get the chunk index
    if (chunked) {
        // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
        chunkIndex = parseInt((shc.match(new RegExp('^shc:/[0-9]')) as RegExpMatchArray)[0].substring(5, 6));
        if (chunkIndex < 1 || chunkIndex > chunkCount) {
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            throw `Invalid QR chunk index: ${chunkIndex}`;
        }
    }

    const bodyIndex = chunked ? qrHeader.length + 4 : qrHeader.length;
    const b64Offset = '-'.charCodeAt(0);
    const digitPairs = shc.substring(bodyIndex).match(/(\d\d?)/g);

    if (digitPairs == null) { throw "Invalid numeric QR code"; }

    // breaks string array of digit pairs into array of numbers: 'shc:/123456...' = [12,34,56,...]
    const jws: string = digitPairs
        // for each number in array, add an offset and convert to a char in the base64 range
        .map((c: string) => String.fromCharCode(Number.parseInt(c) + b64Offset))
        // merge the array into a single base64 string
        .join('');

    return { result: jws, chunkIndex: chunkIndex };
}
