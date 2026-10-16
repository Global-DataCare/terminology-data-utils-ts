// Flow contract: reuse shared test fixtures and canonical types; do not introduce duplicated literals.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTerminologyEntryKey,
  buildTerminologySnapshotKey,
  normalizeTerminologySearchText,
  parseTerminologySnapshot,
} from '../dist/index.js';

const SNAPSHOT_IDENTITY = Object.freeze({
  sector: 'health-care',
  jurisdiction: 'CA-BC',
  fhirVersion: 'R4',
  release: '2026-09',
});

const VALUE_SET_ID = 'https://example.invalid/ValueSet/conditions';

const SOURCE = Object.freeze({
  id: 'ICD10',
  system: 'http://hl7.org/fhir/sid/icd-10',
  version: '2026',
  license: 'configured-license',
  provenance: 'configured-source',
});

function entry(language, attributes) {
  return {
    type: 'terminology-value-set',
    id: VALUE_SET_ID,
    language,
    attributes,
    meta: {
      versionId: '2026-09',
      system: SOURCE.system,
      sources: [SOURCE.id],
      flatClaims: ['Condition.code', 'AllergyIntolerance.code'],
    },
  };
}

test('builds stable keys for a release and for each terminology-language entry', () => {
  assert.equal(
    buildTerminologySnapshotKey(SNAPSHOT_IDENTITY),
    'health-care::CA-BC::R4::2026-09',
  );
  assert.notEqual(
    buildTerminologyEntryKey(entry('en', { J10: 'Influenza' })),
    buildTerminologyEntryKey(entry('es', { J10: 'Gripe' })),
  );
});

test('normalizes localized labels for accent-insensitive local search', () => {
  assert.equal(normalizeTerminologySearchText('  Reacción   alérgica '), 'reaccion alergica');
});

test('keeps each ValueSet and language in one data entry with a plain code-to-value map', () => {
  const snapshot = parseTerminologySnapshot({
    jsonapi: { version: '1.1' },
    schemaVersion: '2',
    id: buildTerminologySnapshotKey(SNAPSHOT_IDENTITY),
    generatedAt: '2026-09-28T12:00:00.000Z',
    identity: SNAPSHOT_IDENTITY,
    terminologyVersions: { [SOURCE.system]: SOURCE.version },
    sources: [SOURCE],
    data: [
      entry('en', { J10: 'Influenza due to identified seasonal influenza virus' }),
      entry('es', { J10: 'Gripe debida a virus de la gripe estacional identificado' }),
    ],
  });

  assert.deepEqual(snapshot.data[1].attributes, {
    J10: 'Gripe debida a virus de la gripe estacional identificado',
  });
  assert.deepEqual(snapshot.data[1].meta.flatClaims, [
    'Condition.code',
    'AllergyIntolerance.code',
  ]);
  assert.equal(snapshot.data[1].id, VALUE_SET_ID);
  assert.equal(snapshot.data[1].language, 'es');
  assert.equal('options' in snapshot, false);
});

test('binds a terminology entry to canonical Schema.org flat claims for One Health cards', () => {
  const taxonomySystem = 'https://www.ncbi.nlm.nih.gov/taxonomy';
  const taxonomyEntry = {
    type: 'terminology-system',
    id: taxonomySystem,
    language: 'en',
    attributes: { 9615: 'Canis lupus familiaris' },
    meta: {
      versionId: '2026-09',
      system: taxonomySystem,
      sources: ['NCBI_TAXONOMY'],
      flatClaims: ['org.schema.Organization.member.additionalType'],
    },
  };
  const snapshot = parseTerminologySnapshot({
    jsonapi: { version: '1.1' },
    schemaVersion: '2',
    id: buildTerminologySnapshotKey(SNAPSHOT_IDENTITY),
    generatedAt: '2026-09-28T12:00:00.000Z',
    identity: SNAPSHOT_IDENTITY,
    terminologyVersions: { [taxonomySystem]: '2026-09' },
    sources: [{
      id: 'NCBI_TAXONOMY', system: taxonomySystem, version: '2026-09',
      license: 'public-domain-source-terms', provenance: 'configured-source',
    }],
    data: [taxonomyEntry],
  });

  assert.deepEqual(snapshot.data[0].meta.flatClaims, [
    'org.schema.Organization.member.additionalType',
  ]);
});

test('rejects nested per-code objects because attributes is only code to value', () => {
  assert.throws(() => parseTerminologySnapshot({
    jsonapi: { version: '1.1' },
    schemaVersion: '2',
    id: buildTerminologySnapshotKey(SNAPSHOT_IDENTITY),
    generatedAt: '2026-09-28T12:00:00.000Z',
    identity: SNAPSHOT_IDENTITY,
    terminologyVersions: { [SOURCE.system]: SOURCE.version },
    sources: [SOURCE],
    data: [entry('es', { J10: { display: 'Influenza', localizedDisplay: 'Gripe' } })],
  }), /terminology_entry_attribute_value_invalid/);
});

test('rejects entries without governed flat-claim bindings or source provenance', () => {
  const invalidEntry = entry('es', { J10: 'Gripe' });
  invalidEntry.meta.flatClaims = [];
  invalidEntry.meta.sources = ['UNKNOWN'];
  assert.throws(() => parseTerminologySnapshot({
    jsonapi: { version: '1.1' },
    schemaVersion: '2',
    id: buildTerminologySnapshotKey(SNAPSHOT_IDENTITY),
    generatedAt: '2026-09-28T12:00:00.000Z',
    identity: SNAPSHOT_IDENTITY,
    terminologyVersions: { [SOURCE.system]: SOURCE.version },
    sources: [SOURCE],
    data: [invalidEntry],
  }), /terminology_entry_flat_claims_invalid|terminology_entry_source_unknown/);
});
