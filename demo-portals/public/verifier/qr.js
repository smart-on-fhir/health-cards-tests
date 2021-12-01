const secScanQr = (() => {

    const sec = new Section('scanQr', "Scan QR Code");
    sec.addTextField("Numeric QR Data (Scan QR code or paste Numeric here:)", "QR 1");
    sec.setDocs(verifierDocs.scanQRCode.l, verifierDocs.scanQRCode.r);

    sec.process = async function () {

        this.clear();
        const scannedParts = await scanQrCodes();

        // for multi-part qrs add additional TAs with 'input' listeners
        for (let i = 0; i < scannedParts.length; i++) {
            i > 0 && sec.addTextField(`Multipart QR ${i + 1}`);
            // if muli-part scanning is canceled, we may have empty parts
            await sec.setValue(scannedParts[i]?.full, i);
        }

    }

    sec.validate = async function (field) {

        const regExpParts = /^shc:\/\d+\/(\d+)\//;
        let maxParts = 1;

        for (let i = 0; i < this.fields.length; i++) {
            maxParts = Math.max(parseInt(this.fields[i].value.match(regExpParts)?.[1] || 1), maxParts);
        }

        const currentParts = this.fields.length;
        const newParts = maxParts - currentParts;

        // adds new fields when we don't have enough
        for (let i = 0; i < newParts; i++) {
            this.addTextField(`Multipart QR ${currentParts + 1 + i}`).options.emptyIsValid = false;            
        }

        // removes extra fields (and data) when we have too many (newParts will be negative)
        for (let i = 0; i > newParts; i--) {
            this.fields[currentParts - 1 + i].delete();
        }

        this.setErrors(await validate.numeric(this.fields.map(f => f.value).filter(v => !!v)));

        return this.valid() ? this.goNext() : this.next.clear();
    };

    //
    // override the getValue function to return combined numeric data
    //
    sec.getValue = function () {
        const orderedParts = hasAllParts(this);
        if (orderedParts) {
            const reducer = (numericString, part) => numericString + part.data;
            return orderedParts.reduce(reducer, "sch:/");
        }
        return this.fields[0].value;
    }
    
    //
    // override the clear method to remove multi-part fields
    //
    sec.clear = async function() {
        Section.prototype.clear.call(this);
        this.resetTextFields();
    }

    //
    // Opens the scanner UI and scans single and multi-part qr codes
    //
    async function scanQrCodes() {

        // reveal the qr scanner ui
        const qrScanDiv = document.getElementById('CenterDIV');
        qrScanDiv.style.display = 'block';
        const multiLabel = document.getElementById('multipart');
        multiLabel.innerHTML = ''; // may be dirty from previous scans
        let scannedParts = [];

        while (true) {

            let label = 'Parts : ';
            const scanResult = await qrScanner.scan();

            // if the scanner returns an error
            if (scanResult?.error) {
                alert(`Camera Error '${scanResult.error}'`);
                break;
            };

            // if the scanner was closed by the user
            if (scanResult?.state === 'stopped') break;

            // sometimes the scanner returns without data, try again
            if (!scanResult.data) continue;

            let part = parseShc(scanResult.data);

            // construct a part if it could not be parsed
            if (!part) part = { full: scanResult.data };

            // set the qr version
            part.version = scanResult.version;

            // if the qr code could not be parse or it's a single part qr code, return it.
            if (part.parts === undefined) {
                scannedParts = [part];
                break;
            }

            // if previous multi-parts scan has n parts, and this scan has m parts,
            // clear and start over with this single part
            if (scannedParts.length && (part.parts != scannedParts.length)) {
                scannedParts = [];
            }

            // set the parts array to the number of expected parts
            if (scannedParts.length === 0) {
                scannedParts.length = part.parts;
            }

            // set the part. A second scan of part 'x' will replace existing part 'x'
            scannedParts[part.part - 1] = part;

            // create the label that shows the current number of parts and expected total
            for (let i = 0; i < scannedParts.length; i++) {
                let part = scannedParts[i];
                label += part ? `<span class="scannedPart">${i + 1}</span>&nbsp;&nbsp;` : `<span class="unscannedPart">${i + 1}</span>&nbsp;&nbsp;`;
            }
            multiLabel.innerHTML = label;

            // if we have all parts, exit the scan loop
            if (!scannedParts.includes(undefined)) break;

        }

        // close the scanner ui
        qrScanDiv.style.display = 'none';

        return scannedParts;
    }

    
    //
    // Parses single and multi-part QR code data into objects containing the part-number, part-count, numeric-data
    //   Note: Single part QR codes will have an 'undefined' 'parts' property.
    //
    function parseShc(schString) {

        schString = schString.trim();

        let regex = /^shc:\/(\d+)$/;
        let result = regex.exec(schString);
        if (result) return { part: 1, parts: undefined, data: result[1], full: schString };

        regex = /^shc:\/(\d+)\/(\d+)\/(\d+)$/;
        result = regex.exec(schString);
        if (result) return { part: parseInt(result[1]), parts: parseInt(result[2]), data: result[3], full: schString };

        return undefined;
    }


    //
    // Collects the shc string from each TextArea and parses each into an array of objects
    //   Note: if one of the fields cannot be parsed, 'undefined' is returned
    //
    function collectParts(section) {
        const parts = [];
        for (let i = 0; i < section.fields.length; i++) {
            const part = parseShc(section.fields[i].value);
            if (!part || part.parts === undefined) return undefined;
            parts.push(part);
        }
        return parts;
    }


    //
    // Collects and parses all the shc TextAreas and determines if each of the n parts is defined.
    // Additionally the parts are ordered 1..n
    //   Note: if one of the fields cannot be parsed, 'undefined' is returned
    // 
    function hasAllParts(section) {

        const partsArray = collectParts(section);
        if (!partsArray) return undefined;


        const order = [];

        for (let i = 0; i < partsArray.length; i++) {
            const part = partsArray[i];
            // the part total should equal the number of parts
            if (part.parts !== partsArray.length) return undefined;
            // order each part
            order[part.part - 1] = part;
        }

        for (let i = 0; i < partsArray.length; i++) {
            // if an element is missing, then we're missing or have duplicate parts
            if (!order[i]) return undefined;
        }

        return order;
    }

    return sec;

})();