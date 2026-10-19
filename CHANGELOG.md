# Changelog

## Unreleased

## 0.2.1 - 2026-10-18

- Allow terminology entries to bind to governed Schema.org flat claims as well
  as FHIR flat claims, enabling cached NCBI Taxonomy labels for One Health card
  readers without accepting arbitrary UI field names.

## 0.2.0

- Correct the downloadable wire contract so every `data[]` entry is one
  CodeSystem or ValueSet in one language and version.
- Keep `attributes` strictly as a `code -> value` map and expose applicable
  canonical flat claims in entry metadata.
- Remove the incorrect per-code option snapshot model from the public API.

## 0.1.0

- Define versioned terminology snapshot, manifest, option and provenance contracts.
- Keep canonical English display and localized display separate.
- Add deterministic snapshot keys and accent-insensitive search normalization.
