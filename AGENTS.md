# terminology-data-utils-ts

- Use red-green-refactor TDD for every behavior change.
- Begin each test file with a flow-contract comment.
- Keep this package runtime-neutral and product-neutral.
- Do not embed terminology datasets, licensed content, product hostnames or secrets.
- Preserve each terminology or ValueSet as one `data[]` entry per language and version.
- Keep entry `attributes` strictly as a flat `code -> value` map.
- Bind entries to one or more canonical flat claims through entry metadata.
- A snapshot identity includes sector, jurisdiction, FHIR version and release;
  language and claim belong to each grouped entry.
