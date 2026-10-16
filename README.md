# terminology-data-utils-ts

Runtime-neutral contracts for downloadable, versioned terminology catalogs.

Each JSON:API `data[]` entry represents one complete CodeSystem or ValueSet in
one language and one version. Its `attributes` member is deliberately only a
plain `code -> value` map:

```json
{
  "type": "terminology-value-set",
  "id": "https://example.invalid/fhir/ValueSet/conditions",
  "language": "es",
  "attributes": {
    "J10": "Gripe debida a virus de la gripe estacional identificado"
  },
  "meta": {
    "versionId": "2026-09",
    "system": "http://hl7.org/fhir/sid/icd-10",
    "sources": ["ICD10"],
    "flatClaims": ["Condition.code"]
  }
}
```

English and localized labels are separate entries with the same canonical
`id`, terminology version and codes, but a different `language`. Consumers
select entries using `meta.flatClaims` for the field being edited, such as
`Condition.code`, `Observation.category` or `Immunization.vaccine-code`.
Neither UI field names nor display metadata are inserted into `attributes`.
Canonical Schema.org claims are also valid bindings when the terminology is
cross-sector rather than a FHIR resource field. For example, an NCBI Taxonomy
entry may bind to `org.schema.Organization.member.additionalType` so a portal
can enrich an animal-card species label without moving the card identity into
a veterinary-only package.

## Lineage

This package preserves a grouped terminology-document model that predates the
current standalone package family. Its wire contract is aligned with the
actively developed
[`terminology-api-node-ts`](https://github.com/Global-DataCare/terminology-api-node-ts)
service. It does not copy portal product policy or redistribute licensed
terminology content.

## Boundary

This package contains data contracts and deterministic validation only. HTTP,
filesystem, SQLite, IndexedDB and framework adapters belong in their respective
SDK packages.
