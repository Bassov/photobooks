import { z } from 'zod'
import type { LibraryMeta } from './types'

export const LIBRARY_SCHEMA_VERSION = 2

export type LibraryParseResult =
  | { ok: true; meta: LibraryMeta }
  | {
      ok: false
      code: 'newer-schema'
      schemaVersion: number
      supportedVersion: number
    }
  | { ok: false; code: 'corrupted' }

type LibraryMigrateFailure = Extract<
  LibraryParseResult,
  { ok: false; code: 'newer-schema' }
>

/*
 * Built per parse (like the book cover schema) so that its mutants are
 * reachable by per-test mutant switching.
 */
function makeLibrarySchema() {
  const entry = z.object({ status: z.enum(['draft', 'published']) })
  return z.object({ books: z.record(z.string().min(1), entry) })
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

/** v1 holds no fields; v2 adds the per-book publish status map. */
function migrateV1ToV2(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return { ...input, schemaVersion: 2, books: {} }
}

/**
 * Pure parse + migration chain for `library.json`. Anything that is not a
 * JSON object is treated as an empty v0 document; versions above
 * {@link LIBRARY_SCHEMA_VERSION} are rejected so they are never overwritten.
 */
export function migrateLibrary(
  input: unknown,
): { ok: true; value: Record<string, unknown> } | LibraryMigrateFailure {
  let doc: Record<string, unknown> = isRecord(input) ? input : {}
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
  if (version < 1) {
    doc = migrateV0ToV1(doc)
  }
  if (version < 2) {
    doc = migrateV1ToV2(doc)
  }
  return { ok: true, value: doc }
}

export function parseLibrary(input: unknown): LibraryParseResult {
  const migrated = migrateLibrary(input)
  if (!migrated.ok) {
    return migrated
  }
  const parsed = makeLibrarySchema().safeParse(migrated.value)
  if (!parsed.success) {
    return { ok: false, code: 'corrupted' }
  }
  return { ok: true, meta: { books: parsed.data.books } }
}

export function serializeLibrary(meta: LibraryMeta): Record<string, unknown> {
  return { schemaVersion: LIBRARY_SCHEMA_VERSION, books: meta.books ?? {} }
}
