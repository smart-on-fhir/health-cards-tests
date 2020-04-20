export const sampleVc = {
  '@context': [
    'https://www.w3.org/2018/credentials/v1'
  ],
  'type': [
    'VerifiableCredential',
    'https://example.com#fhir-backed-vc',
    'https://example.com#vc-presentation-context-online',
    'https://example.com#health-passport-stamp',
    'https://example.com#covid19-serology'
  ],
  'issuer': '<<did:ion identifier for lab>>',
  'issuanceDate': '2020-05-01T11:59:00-07:00',
  'display': 'Health passport for Josh Mandel',
  'credentialSubject': {
    'id': '<<did:identifier for subject if known>>',
    'fhirVersion': '1.0.2',
    'fhirBundle': {
      'resourceType': 'Bundle',
      'type': 'collection',
      'entry': [{
        'fullUrl': 'urn:uuid:643e199d-1aaf-49af-8a3b-c7ae375d11ce',
        'resource': {
          'resourceType': 'Patient',
          // Note that this VC is intended for Online Presentation;
          // we'd populate .photo instead of .name and .telecom to
          // enable In-person Presentation
          'name': [{
            'family': ['Mandel'],
            'given': ['Joshua', 'Craig']
          }],
          'telecom': [{
            'system': 'phone',
            'value': '617-500-3253',
            'use': 'mobile'
          }]
        }
      }, {
        'fullUrl': 'urn:uuid:4fe4f8d4-9b6e-4780-8ea5-6b5791230c85',
        'resource': {
          'resourceType': 'DiagnosticReport',
          'effectiveDateTime': '2020-05-01',
          'subject': {
            'reference': 'urn:uuid:643e199d-1aaf-49af-8a3b-c7ae375d11ce'
          },
          'result': [{
            'reference': 'urn:uuid:911791c4-5131-44ba-85bd-8e6bdf652fd4'
          }, {
            'reference': 'urn:uuid:05912d66-1e03-4dd1-91cf-b4769306c422'
          }],
          'conclusion': 'Patient has passed through the acute phase of covid-19 infection as of May 1, 2020'
        }
      }, {
        'fullUrl': 'urn:uuid:4fe4f8d4-9b6e-4780-8ea5-6b5791230c85',
        'resource': {
          'resourceType': 'Observation',
          'effectiveDateTime': '2020-05-01',
          'subject': {
            'reference': 'urn:uuid:643e199d-1aaf-49af-8a3b-c7ae375d11ce'
          },
          'code': {
            'coding': [{
                'system': 'http://loinc.org',
                'code': '94508-9',
                'display': 'SARS coronavirus 2 IgM Ab [Presence] in Serum or Plasma by Rapid immunoassay'
              }]
          },
          'valueCodebleConcept': {
            'coding': [{
                'system': 'http://loinc.org',
                'code': 'LA6577-6',
                'display': 'Negative'
              }]
          }
        }
      }, {
        'fullUrl': 'urn:uuid:05912d66-1e03-4dd1-91cf-b4769306c422',
        'resource': {
          'resourceType': 'Observation',
          'effectiveDateTime': '2020-05-01',
          'subject': {
            'reference': 'urn:uuid:643e199d-1aaf-49af-8a3b-c7ae375d11ce'
          },
          'code': {
            'coding': [{
                'system': 'http://loinc.org',
                'code': '94507-1',
                'display': 'SARS coronavirus 2 IgG Ab [Presence] in Serum or Plasma by Rapid immunoassay'
              }]
          },
          'valueCodebleConcept': {
            'coding': [{
                'system': 'http://loinc.org',
                'code': 'LA6576-8',
                'display': 'Positive'
              }]
          }
        }
      }]
    }
  }
};
