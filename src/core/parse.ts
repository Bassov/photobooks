import { checkBookInvariants, type InvariantViolation } from './invariants'
import { migrateToCurrent } from './migrate'
import { bookSchema, type Book } from './schema'

export type ParseResult =
  | { ok: true; book: Book }
  | {
      ok: false
      code: 'newer-schema'
      schemaVersion: number
      supportedVersion: number
    }
  | { ok: false; code: 'invalid-shape'; message: string }
  | { ok: false; code: 'invariant'; violation: InvariantViolation }

export function parseBook(input: unknown): ParseResult {
  const migrated = migrateToCurrent(input)
  if (!migrated.ok) {
    if (migrated.code === 'newer-schema') {
      return {
        ok: false,
        code: 'newer-schema',
        schemaVersion: migrated.schemaVersion,
        supportedVersion: migrated.supportedVersion,
      }
    }
    return { ok: false, code: 'invalid-shape', message: migrated.message }
  }

  const parsed = bookSchema.safeParse(migrated.value)
  if (!parsed.success) {
    return {
      ok: false,
      code: 'invalid-shape',
      message: parsed.error.issues[0]?.message ?? 'Invalid book shape',
    }
  }

  const invariants = checkBookInvariants(parsed.data)
  if (!invariants.ok) {
    return { ok: false, code: 'invariant', violation: invariants.violation }
  }

  return { ok: true, book: parsed.data }
}

export function serializeBook(book: Book): unknown {
  return structuredClone(book)
}
