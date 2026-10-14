import { CURRENT_SCHEMA_VERSION } from './schema'

export type MigrateResult =
  | { ok: true; value: unknown }
  | {
      ok: false
      code: 'newer-schema'
      schemaVersion: number
      supportedVersion: typeof CURRENT_SCHEMA_VERSION
    }
  | { ok: false; code: 'invalid-shape'; message: string }

function readSchemaVersion(input: unknown): number | undefined {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return undefined
  }
  if (!('schemaVersion' in input)) {
    return undefined
  }
  const version = input.schemaVersion
  return typeof version === 'number' && Number.isFinite(version)
    ? version
    : undefined
}

/**
 * Pure migration scaffold: reject newer versions; identity for v1.
 * Future versions append steps here before Zod validation of the current shape.
 */
export function migrateToCurrent(input: unknown): MigrateResult {
  const schemaVersion = readSchemaVersion(input)
  if (schemaVersion === undefined) {
    return {
      ok: false,
      code: 'invalid-shape',
      message: 'Missing or non-numeric schemaVersion',
    }
  }
  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      code: 'newer-schema',
      schemaVersion,
      supportedVersion: CURRENT_SCHEMA_VERSION,
    }
  }
  if (schemaVersion < 1) {
    return {
      ok: false,
      code: 'invalid-shape',
      message: `Unsupported schemaVersion ${String(schemaVersion)}`,
    }
  }
  // v1 identity — later: for (let v = schemaVersion; v < CURRENT; v++) apply step
  return { ok: true, value: input }
}
