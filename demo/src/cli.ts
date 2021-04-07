// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Command, Option } from 'commander';
import {generateHealthCard} from './issuer';
import {toFhirBundle} from './fhir';
import {generatePDFCard, generatePDFCardFromQRFile} from './pdf';

const hcData = {
  issuer: 'Contoso Hospital',
  patientData: {firstName:'John', lastName:'Smith', dob:'1953-02-12', immunizations: [{code: '207', lot: '4456', date: '2021-03-01'},{code: '207', lot: '6417', date: '2021-03-18'}]}
}

const program = new Command();
program.addOption(new Option('-t, --task <task>', 'task to perform').choices(['issue']));
program.option('-o, --outdir <outdir>', 'output directory');
program.option('-u, --userID <userID>', 'userID');
program.parse(process.argv);
interface Options {
    task: string;
    outdir: string;
    userID: string;
  }
const options = program.opts() as Options;

const issue = async () => {
  try {
    const fhirBundle = toFhirBundle(hcData);
    await generateHealthCard(fhirBundle, hcData, 'cards','12345');
  } catch (err) {
    console.log(err);
  }
}

if (options.task === 'issue') {
  issue();
}

