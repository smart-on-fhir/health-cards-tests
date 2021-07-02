declare var process: NodeJS.Process;

interface Immunization {
    // vaccine code
    code: string;
    // lot
    lot: string;
    // date administered
    date: string;
}

interface HealthCard {
    iss: string;
    nbf: number;
    vc: {
        type: string[];
        credentialSubject: {
            fhirVersion: string;
            fhirBundle: FhirBundle;
        };
    };
}

interface HealthCardPatientData {
    // patient first name
    firstName: string;
    // patient last name
    lastName: string;
    // date of birht
    dob: string;
    // patient completed immunizations
    immunizations: Immunization[];
}

interface HealthCardData {
    // the card issuer name
    issuer: string;
    // the validated card data
    patientData: HealthCardPatientData;
}

interface ValidationResult {
    // validated card data, on success
    result?: HealthCardData;
    // encoded FHIR bundle
    fhirBundle?: string;
    // an error message, on failure
    error?: string
}

interface FhirBundle {
    text: string;
    Coding: { display: unknown };
    CodeableConcept: { text: unknown };
    meta: unknown;
    id: unknown;
    "resourceType": string,
    "type": string,
    "entry": BundleEntry[]
}

type Resource = { resourceType: string } & Record<string, unknown>;

interface BundleEntry {
    id?: string,
    extension?: unknown[],
    modifierExtension?: unknown[],
    link?: string[],
    fullUrl?: string,
    resource: Resource,
    search?: unknown,
    request?: unknown,
    response?: unknown
}

interface Schema {
    $schema?: string,
    $id?: string,
    description?: string,
    discriminator?: {
        propertyName: string,
        mapping: Record<string, string>
    },
    oneOf?: { $ref: string }[],
    definitions: Record<string, SchemaProperty>
}

interface SchemaProperty {
    properties?: Record<string, SchemaProperty>
    items?: { $ref: string } | { enum: string[] },  // SchemaProperty (more general)
    oneOf?: { $ref: string }[], //SchemaProperty[] (more general)
    pattern?: string,
    type?: string,
    description?: string,
    $ref?: string,
    additionalProperties?: boolean,
    enum?: string[],
    const?: string
}

interface Key {
    kty: string,
    kid: string,
    use: string,
    alg: string,
    crv: string,
    x: string,
    y: string,
    d?: string
}

interface VerifiableCredential {
    verifiableCredential: string[]
}