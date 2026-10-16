export const TERMINOLOGY_SNAPSHOT_SCHEMA_VERSION = '2' as const;

export type TerminologySnapshotIdentity = Readonly<{
  sector: string;
  jurisdiction: string;
  fhirVersion: string;
  release: string;
}>;

export type TerminologySourceProvenance = Readonly<{
  id: string;
  system: string;
  version: string;
  license: string;
  provenance: string;
}>;

export type TerminologyEntryType = 'terminology-system' | 'terminology-value-set';

export type TerminologyEntry = Readonly<{
  type: TerminologyEntryType;
  /** Canonical CodeSystem or ValueSet identifier. */
  id: string;
  /** BCP 47 language of every value in attributes. */
  language: string;
  /** Deliberately simple and framework-neutral: terminology code -> label. */
  attributes: Readonly<Record<string, string>>;
  meta: Readonly<{
    versionId: string;
    /** Canonical Coding.system used when a code from this entry is selected. */
    system: string;
    /** Provenance identifiers declared by the enclosing snapshot. */
    sources: readonly string[];
    /** Canonical flat claims whose editor may use this entry. */
    flatClaims: readonly string[];
  }>;
}>;

export type TerminologySnapshot = Readonly<{
  jsonapi: Readonly<{ version: '1.1' }>;
  schemaVersion: typeof TERMINOLOGY_SNAPSHOT_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  identity: TerminologySnapshotIdentity;
  terminologyVersions: Readonly<Record<string, string>>;
  sources: readonly TerminologySourceProvenance[];
  /** One complete terminology/ValueSet in one language per entry. */
  data: readonly TerminologyEntry[];
}>;

export type TerminologyManifestEntry = Readonly<{
  id: string;
  identity: TerminologySnapshotIdentity;
  sha256: string;
  byteLength: number;
  downloadUrl: string;
}>;

export type TerminologyManifest = Readonly<{
  schemaVersion: typeof TERMINOLOGY_SNAPSHOT_SCHEMA_VERSION;
  generatedAt: string;
  snapshots: readonly TerminologyManifestEntry[];
}>;

function record(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function string(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value.trim();
}

function stringArray(value: unknown, code: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(code);
  return Object.freeze(value.map((item) => string(item, code)));
}

function absoluteUrl(value: unknown, code: string): string {
  const candidate = string(value, code);
  if (!URL.canParse(candidate)) throw new Error(code);
  return candidate;
}

function instant(value: unknown): string {
  const candidate = string(value, 'terminology_snapshot_generated_at_invalid');
  if (Number.isNaN(Date.parse(candidate)) || !/^\d{4}-\d{2}-\d{2}T/.test(candidate)) {
    throw new Error('terminology_snapshot_generated_at_invalid');
  }
  return candidate;
}

function language(value: unknown): string {
  const candidate = string(value, 'terminology_entry_language_invalid');
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(candidate)) {
    throw new Error('terminology_entry_language_invalid');
  }
  return candidate;
}

function identity(value: unknown): TerminologySnapshotIdentity {
  const item = record(value, 'terminology_snapshot_identity_invalid');
  const sector = string(item.sector, 'terminology_snapshot_sector_invalid').toLowerCase();
  const jurisdiction = string(item.jurisdiction, 'terminology_snapshot_jurisdiction_invalid').toUpperCase();
  const fhirVersion = string(item.fhirVersion, 'terminology_snapshot_fhir_version_invalid').toUpperCase();
  const release = string(item.release, 'terminology_snapshot_release_invalid');
  if (!/^[a-z][a-z0-9-]*$/.test(sector)) throw new Error('terminology_snapshot_sector_invalid');
  if (!/^[A-Z]{2}(?:-[A-Z0-9]{1,8})?$/.test(jurisdiction)) throw new Error('terminology_snapshot_jurisdiction_invalid');
  if (!/^R[45]$/.test(fhirVersion)) throw new Error('terminology_snapshot_fhir_version_invalid');
  return Object.freeze({ sector, jurisdiction, fhirVersion, release });
}

/** Stable identity for one versioned, multi-language downloadable release. */
export function buildTerminologySnapshotKey(value: TerminologySnapshotIdentity): string {
  const canonical = identity(value);
  return [canonical.sector, canonical.jurisdiction, canonical.fhirVersion, canonical.release]
    .map(encodeURIComponent)
    .join('::');
}

/** Stable local-cache key. The public entry id remains the canonical terminology id. */
export function buildTerminologyEntryKey(value: Pick<TerminologyEntry, 'type' | 'id' | 'language' | 'meta'>): string {
  const parsed = terminologyEntry(value);
  return [parsed.type, parsed.id, parsed.language, parsed.meta.versionId]
    .map(encodeURIComponent)
    .join('::');
}

/** Normalization shared by every local index; it never changes the stored label. */
export function normalizeTerminologySearchText(value: string): string {
  return value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function source(value: unknown): TerminologySourceProvenance {
  const item = record(value, 'terminology_snapshot_source_invalid');
  return Object.freeze({
    id: string(item.id, 'terminology_snapshot_source_id_invalid'),
    system: absoluteUrl(item.system, 'terminology_snapshot_source_system_invalid'),
    version: string(item.version, 'terminology_snapshot_source_version_invalid'),
    license: string(item.license, 'terminology_snapshot_source_license_invalid'),
    provenance: string(item.provenance, 'terminology_snapshot_source_provenance_invalid'),
  });
}

function attributes(value: unknown): Readonly<Record<string, string>> {
  const item = record(value, 'terminology_entry_attributes_invalid');
  const result: Record<string, string> = {};
  for (const [code, label] of Object.entries(item)) {
    if (!code.trim() || ['__proto__', 'constructor', 'prototype'].includes(code)) {
      throw new Error('terminology_entry_attribute_code_invalid');
    }
    result[code] = string(label, 'terminology_entry_attribute_value_invalid');
  }
  return Object.freeze(result);
}

function flatClaim(value: string): string {
  if (!isCanonicalTerminologyFlatClaim(value)) {
    throw new Error('terminology_entry_flat_claims_invalid');
  }
  return value;
}

/** Accepts governed FHIR or Schema.org claim paths, never arbitrary UI keys. */
export function isCanonicalTerminologyFlatClaim(value: string): boolean {
  return /^[A-Z][A-Za-z0-9]*\.[A-Za-z][A-Za-z0-9.:-]*$/.test(value)
    || /^org\.schema\.[A-Z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9-]*)+$/.test(value);
}

function terminologyEntry(value: unknown): TerminologyEntry {
  const item = record(value, 'terminology_entry_invalid');
  if (item.type !== 'terminology-system' && item.type !== 'terminology-value-set') {
    throw new Error('terminology_entry_type_invalid');
  }
  const meta = record(item.meta, 'terminology_entry_meta_invalid');
  const flatClaims = stringArray(meta.flatClaims, 'terminology_entry_flat_claims_invalid').map(flatClaim);
  return Object.freeze({
    type: item.type,
    id: absoluteUrl(item.id, 'terminology_entry_id_invalid'),
    language: language(item.language),
    attributes: attributes(item.attributes),
    meta: Object.freeze({
      versionId: string(meta.versionId, 'terminology_entry_version_invalid'),
      system: absoluteUrl(meta.system, 'terminology_entry_system_invalid'),
      sources: stringArray(meta.sources, 'terminology_entry_sources_invalid'),
      flatClaims: Object.freeze(flatClaims),
    }),
  });
}

/** Validates untrusted JSON before a snapshot can become active in a local cache. */
export function parseTerminologySnapshot(value: unknown): TerminologySnapshot {
  const item = record(value, 'terminology_snapshot_invalid');
  const jsonapi = record(item.jsonapi, 'terminology_snapshot_jsonapi_invalid');
  if (jsonapi.version !== '1.1') throw new Error('terminology_snapshot_jsonapi_invalid');
  if (item.schemaVersion !== TERMINOLOGY_SNAPSHOT_SCHEMA_VERSION) throw new Error('terminology_snapshot_schema_invalid');
  const parsedIdentity = identity(item.identity);
  const id = string(item.id, 'terminology_snapshot_id_invalid');
  if (id !== buildTerminologySnapshotKey(parsedIdentity)) throw new Error('terminology_snapshot_id_mismatch');
  if (!Array.isArray(item.sources) || item.sources.length === 0) throw new Error('terminology_snapshot_sources_invalid');
  if (!Array.isArray(item.data)) throw new Error('terminology_snapshot_data_invalid');
  const sources = item.sources.map(source);
  const sourceIds = new Set(sources.map((entry) => entry.id));
  const data = item.data.map(terminologyEntry);
  if (data.some((entry) => entry.meta.sources.some((sourceId) => !sourceIds.has(sourceId)))) {
    throw new Error('terminology_entry_source_unknown');
  }
  const keys = data.map(buildTerminologyEntryKey);
  if (new Set(keys).size !== keys.length) throw new Error('terminology_entry_duplicate');
  const versions = record(item.terminologyVersions, 'terminology_snapshot_versions_invalid');
  const terminologyVersions = Object.fromEntries(Object.entries(versions).map(([system, version]) => [
    absoluteUrl(system, 'terminology_snapshot_version_system_invalid'),
    string(version, 'terminology_snapshot_version_invalid'),
  ]));
  return Object.freeze({
    jsonapi: Object.freeze({ version: '1.1' }),
    schemaVersion: TERMINOLOGY_SNAPSHOT_SCHEMA_VERSION,
    id,
    generatedAt: instant(item.generatedAt),
    identity: parsedIdentity,
    terminologyVersions: Object.freeze(terminologyVersions),
    sources: Object.freeze(sources),
    data: Object.freeze(data),
  });
}

function manifestEntry(value: unknown): TerminologyManifestEntry {
  const item = record(value, 'terminology_manifest_entry_invalid');
  const parsedIdentity = identity(item.identity);
  const id = string(item.id, 'terminology_manifest_entry_id_invalid');
  if (id !== buildTerminologySnapshotKey(parsedIdentity)) throw new Error('terminology_manifest_entry_id_mismatch');
  const sha256 = string(item.sha256, 'terminology_manifest_sha256_invalid').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('terminology_manifest_sha256_invalid');
  if (!Number.isSafeInteger(item.byteLength) || Number(item.byteLength) < 1) throw new Error('terminology_manifest_byte_length_invalid');
  return Object.freeze({
    id,
    identity: parsedIdentity,
    sha256,
    byteLength: Number(item.byteLength),
    downloadUrl: absoluteUrl(item.downloadUrl, 'terminology_manifest_download_url_invalid'),
  });
}

export function parseTerminologyManifest(value: unknown): TerminologyManifest {
  const item = record(value, 'terminology_manifest_invalid');
  if (item.schemaVersion !== TERMINOLOGY_SNAPSHOT_SCHEMA_VERSION) throw new Error('terminology_manifest_schema_invalid');
  if (!Array.isArray(item.snapshots)) throw new Error('terminology_manifest_snapshots_invalid');
  return Object.freeze({
    schemaVersion: TERMINOLOGY_SNAPSHOT_SCHEMA_VERSION,
    generatedAt: instant(item.generatedAt),
    snapshots: Object.freeze(item.snapshots.map(manifestEntry)),
  });
}
