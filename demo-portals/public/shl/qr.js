import * as validate from '../validate2.js';

const sec = document.getElementById('scanQr');

sec.initialize = async function () {
    this.clear();
    const link = await scanQrCodes();
    sec.value = link;
}

sec.update = async function (field) {
    if(field.value.trim() === '') return false;
    this.errors = await validate.shlink(field.value);;
    return !this.errors.length
};

export default sec;
