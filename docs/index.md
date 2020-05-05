# Health Wallet Vocab

## Verifiable Credential Types

* https://healthwallet.cards#presentation-context-online: A VC designed for online presentation
* https://healthwallet.cards#presentation-context-in-person A VC designed for in-person presentation

## FHIR Extensions

 * https://healthwallet.cards#description: Extension that decorates a FHIR resource to communicate what sorts of VCs are attached. Uses `valueString` to convey a human-readable description.
 * https://healthwallet.cards#presentation-context-online: Extension that decorates a FHIR resource to attach a VC designed for online presentation what sorts of VCs are attached. Uses `valueString` to convey a VC as a signed JWT.
 * https://healthwallet.cards#presentation-context-in-person: Extension that decorates a FHIR resource to attach a VC designed for in-person presentation what sorts of VCs are attached. Uses `valueString` to convey a VC as a signed JWT.
