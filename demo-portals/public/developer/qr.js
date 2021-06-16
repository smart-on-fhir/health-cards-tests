class QRSection extends Section {
    // override clear method to remove additional text fields from multi-part codes
    clear() {
        super.clear();
        const container = document.getElementById('qrContainer1');
        container.innerHTML = ''; // clear previous images
    }
}

const secQR = (() => {

    const sec = new QRSection('qrContainer', 'Generate QR Code');
    sec.setDocs(developerDocs.qrCode.l, null);

    sec.process = async function () {

        let shc = secNumericEncode.getValue();
        let url = '/generate-qr-code';

        let result = await restCall(url, { shc: shc }, 'POST');
        const container = document.getElementById('qrContainer1');
        container.innerHTML = ''; // clear previous images
        container.style.marginTop = '-100px';
        for (let i = 0; i < result.length; i++) {
            container.appendChild(document.createElement('img')).src = result[i];
        }
    }

    sec.validate = async function (field) {

    }

    return sec;

})();