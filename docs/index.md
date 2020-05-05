# Health Wallet Vocab

## Verifiable Credential (VC) Types

* https://healthwallet.cards#covid19: A VC designed to convey COVID-19 details
* https://healthwallet.cards#presentation-context-online: A VC designed for online presentation
* https://healthwallet.cards#presentation-context-in-person A VC designed for in-person presentation

## FHIR Extensions

 * https://healthwallet.cards#vc-attachment: Extension that decorates a FHIR "key resource" to attach a VC

## FHIR Codings

The following `code`s are defined in the `https://healthwallet.cards` system:

* `covid19`: Used for tagging a FHIR "key resource" (in `.meta.tag`) as containing a VC of type https://healthwallet.cards#covid19. This can facilitate search across FHIR resources to find resources with attached VCs.
