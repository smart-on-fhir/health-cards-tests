import {jsPDF, ImageOptions} from 'jspdf';
import {codeToVaccine} from './fhir';
import fs from 'fs';

// generates a PDF Health Card from a QR image
// input:
//  - qrCodePath: path to the QR image
//  - outPath: output path for the PDF file
// return: path to the generated PDF
export const generatePDFCard = (hcData: HealthCardData, qrCode: Buffer, outPath: string) => {
    // dimension 2 3/8" x 3 5/8" === Driver's licence size
    const cardWidth = 2.375;
    const cardHeigth = 3.625;
    const qrWidth = 2;
    const qrHeigth = 2;
    const margin = (cardWidth - qrWidth) / 2; // centered on x-axis
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "in",
        format: [cardWidth, cardHeigth] 
      });
      let x = 0.1;
      let y = 0.3;
      const yIncrement = 0.17;
      doc.setFontSize(12);
      doc.text("SMART Health Card", x, y); y += yIncrement;
      doc.setFontSize(9);
      doc.text("Issued by: " + hcData.issuer, x, y); y += yIncrement;
      doc.text("Issued to: " + hcData.patientData.firstName + " " + hcData.patientData.lastName, x, y); y += yIncrement;
      doc.text("Birth Date: " + hcData.patientData.dob, x, y); y += yIncrement;
      doc.text("Immunizations:", x, y); y += yIncrement;
      hcData.patientData.immunizations.map((imm, i) => {
        doc.text(codeToVaccine(imm.code) + " (" + imm.date + ")", x + 0.2, y); y += yIncrement;
      });
      doc.addImage(qrCode, "PNG", margin, cardHeigth - (margin + qrHeigth), qrWidth, qrHeigth);
      doc.setLineWidth(0.05);
      doc.rect(0,0,cardWidth,cardHeigth);
      doc.save(outPath);
}

export const generatePDFCardFromQRFile = (hcData: HealthCardData, qrCodePath: string, outPath: string) =>
{   
    const qrCodeBuffer = fs.readFileSync(qrCodePath);
    generatePDFCard(hcData, qrCodeBuffer, outPath);
}

