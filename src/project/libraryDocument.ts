import { z } from 'zod'
import type { SavedTemplate } from '../core'
import type { LibraryMeta } from './types'

export const LIBRARY_SCHEMA_VERSION = 3

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

/*
 * Bounded so a crafted file cannot overflow the frame math to `Infinity` (a
 * book that no longer saves) or ask for unbounded frames. Slots may sit off
 * the trim (bleed, pasteboard), so the bounds are wide.
 */
const MAX_SLOT_PCT = 1000
const MAX_SLOTS = 500

function makeTemplateSchema() {
  const pct = z.number().min(-MAX_SLOT_PCT).max(MAX_SLOT_PCT)
  return z.object({
    id: z.string().regex(/^user-[\w-]+$/),
    name: z.string().trim().min(1),
    pages: z.union([z.literal(1), z.literal(2)]),
    slots: z
      .array(z.object({ x: pct, y: pct, w: pct.positive(), h: pct.positive() }))
      .min(1)
      .max(MAX_SLOTS),
  })
}

/**
 * Saved layouts from untrusted input (`library.json`, the legacy
 * `localStorage` list): a non-list reads as none, and each invalid entry is
 * dropped on its own so one bad template never loses the others.
 */
export function parseSavedTemplates(input: unknown): SavedTemplate[] {
  return parseEach(input, makeTemplateSchema())
}

/**
 * The pre-`library.json` `localStorage` list: entries carry no `pages`, and
 * every one was saved on a two-page spread.
 */
export function parseLegacySavedTemplates(input: unknown): SavedTemplate[] {
  const legacy = makeTemplateSchema()
    .omit({ pages: true })
    .transform((entry) => ({ ...entry, pages: 2 as const }))
  return parseEach(input, legacy)
}

function parseEach(
  input: unknown,
  schema: z.ZodType<SavedTemplate>,
): SavedTemplate[] {
  if (!Array.isArray(input)) {
    return []
  }
  return input.flatMap((entry: unknown) => {
    const parsed = schema.safeParse(entry)
    return parsed.success ? [parsed.data] : []
  })
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

/** v3 adds the user's saved layouts (My templates). */
function migrateV2ToV3(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return { ...input, schemaVersion: 3, templates: [] }
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
  if (version < 3) {
    doc = migrateV2ToV3(doc)
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
  return {
    ok: true,
    meta: {
      books: parsed.data.books,
      templates: parseSavedTemplates(migrated.value.templates),
    },
  }
}

export function serializeLibrary(meta: LibraryMeta): Record<string, unknown> {
  return {
    schemaVersion: LIBRARY_SCHEMA_VERSION,
    books: meta.books ?? {},
    templates: meta.templates ?? [],
  }
}
