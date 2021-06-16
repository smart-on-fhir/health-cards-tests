const secQR = (() => {

    const sec = new Section('qrContainer', 'Generate QR Code');
    sec.setDocs(developerDocs.qrCode.l, null);

    sec.process = async function () {

        // don't process if the numeric data isn't valid
        if(!secNumericEncode.valid()) return;

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
        return;
    }

    //
    // override the clear method to clear QR images
    //
    sec.clear = async function() {
        Section.prototype.clear.call(this);
        document.getElementById('qrContainer1').innerHTML = '';
    }

    return sec;

})();