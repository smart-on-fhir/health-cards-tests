import {Config} from './config';

// TODO: validate vaccine code https://www.cdc.gov/vaccines/programs/iis/COVID-19-related-codes.html
// Moderna: 207, Pfizer: 208, AstraZeneca: 210, J&J: 212
export interface Bundle {
    id?: string;
    meta?: Record<string, unknown>;
    entry: {
      fullUrl: string;
      resource: {
        meta?: Record<string, unknown>;
        id?: string;
        [k: string]: unknown;
      };
    }[];
  }
  
export interface Entry {
    fullUrl: string;
    resource: {
        [k: string]: unknown;
    };
};  

export const toFhirBundle = (hcd: HealthCardData): Bundle => {
    const immunizationEntries: Entry[] = hcd.patientData.immunizations.map((immunization,i) => 
        {return {
            "fullUrl": `resource:${i}`,
            "resource":
            {
                resourceType: "Immunization", status:"completed",
                vaccineCode: {coding: [{system: "http://hl7.org/fhir/sid/cvx",code: immunization.code}]},
                patient: {reference: "resource:0"},
                occurrenceDateTime: immunization.date,"lotNumber": immunization.lot,
                performer: [{actor: {display: hcd.issuer}}]
            }
        }});
    console.log(JSON.stringify(immunizationEntries));
      
    const patientEntry: Entry = {
      fullUrl: "resource:0",
      resource: {resourceType: "Patient",name:[{family: hcd.patientData.lastName, given: [hcd.patientData.firstName]}], birthDate: hcd.patientData.dob}
    };
    
    let bundle = 
    {
        resourceType:"Bundle",type:"collection",
        entry: [patientEntry]
    };
    bundle.entry = bundle.entry.concat(immunizationEntries);
    return bundle as Bundle;
}

export const toHealthCardData = (fhirBundle: Bundle): HealthCardData => {
    // we expect the first resource to be the patient
    const patientEntry = fhirBundle.entry[0] as {fullUrl: string, resource: {resourceType: string,name:[{family: string, given: string[]}]}, birthDate: string};
    const immunizationEntries = fhirBundle.entry.slice(1) as {
        fullUrl: string,
        resource:
        {
            resourceType: string, status: string,
            vaccineCode: {coding: [{system: string,code: string}]},
            patient: {reference: string},
            occurrenceDateTime: string,
            lotNumber: string,
            performer: [{actor: {display: string}}]
        }
    }[]
    const immunizations: Immunization[] = immunizationEntries.map(ie => 
        {return {'code': ie.resource.vaccineCode.coding[0].code, 'lot': ie.resource.lotNumber, 'date': ie.resource.occurrenceDateTime}});

    return {
        issuer: immunizationEntries[0].resource.performer[0].actor.display,
        patientData: {
            firstName: (patientEntry.resource.name[0].given instanceof Array) ? patientEntry.resource.name[0].given.join(' ') : patientEntry.resource.name[0].given,
            lastName: patientEntry.resource.name[0].family,
            dob: patientEntry.birthDate,
            immunizations: immunizations
        }
    };
}

export const codeToVaccine = (code: string) => {
    switch (code) {
        case "207": return "Moderna";
        case "208": return "Pfizer";
        case "210": return "AstraZeneca";
        case "212": return "Janssen";
        default: return "unknown";
    }
};