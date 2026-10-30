import type { LibraryMeta } from './types'

export const LIBRARY_SCHEMA_VERSION = 1

export type LibraryParseResult =
  | { ok: true; meta: LibraryMeta }
  | {
      ok: false
      code: 'newer-schema'
      schemaVersion: number
      supportedVersion: number
    }

function isRecord(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === 'object' && !Array.isArray(input)
}

/** v0 documents carry no `schemaVersion`; v1 stamps it. */
function migrateV0ToV1(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return { ...input, schemaVersion: 1 }
}

/**
 * Pure parse + migration chain for `library.json`. Anything that is not a
 * JSON object is treated as an empty v0 document; versions above
 * {@link LIBRARY_SCHEMA_VERSION} are rejected so they are never overwritten.
 */
export function migrateLibrary(
  input: unknown,
):
  | { ok: true; value: Record<string, unknown> }
  | Extract<LibraryParseResult, { ok: false }> {
  const doc: Record<string, unknown> = isRecord(input) ? input : {}
  const raw = doc.schemaVersion
  const version = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
  if (version > LIBRARY_SCHEMA_VERSION) {
    return {
      ok: false,
      code: 'newer-schema',
      schemaVersion: version,
      supportedVersion: LIBRARY_SCHEMA_VERSION,
    }
  }
  return { ok: true, value: version < 1 ? migrateV0ToV1(doc) : doc }
}

export function parseLibrary(input: unknown): LibraryParseResult {
  const migrated = migrateLibrary(input)
  if (!migrated.ok) {
    return migrated
  }
  // v1 carries no fields beyond `schemaVersion`.
  return { ok: true, meta: {} }
}

export function serializeLibrary(meta: LibraryMeta): Record<string, unknown> {
  return { ...meta, schemaVersion: LIBRARY_SCHEMA_VERSION }
}
