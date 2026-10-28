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

function migrateV1ToV2(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const assetsIn = input.assets
  const assets: Record<string, Record<string, never>> = {}
  if (
    assetsIn !== null &&
    typeof assetsIn === 'object' &&
    !Array.isArray(assetsIn)
  ) {
    for (const key of Object.keys(assetsIn)) {
      assets[key] = {}
    }
  }
  return {
    ...input,
    schemaVersion: 2,
    assets,
  }
}

function migrateV2ToV3(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const title = typeof input.title === 'string' ? input.title : ''
  return {
    ...input,
    schemaVersion: 3,
    title,
  }
}

function migrateV3ToV4(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const spreads = Array.isArray(input.spreads)
    ? input.spreads.map((spread: unknown) => {
        if (
          spread === null ||
          typeof spread !== 'object' ||
          !Array.isArray((spread as { frames?: unknown }).frames)
        ) {
          return spread
        }
        const frames = (spread as { frames: unknown[] }).frames.map((frame) =>
          frame !== null && typeof frame === 'object'
            ? { rotationDeg: 0, ...frame }
            : frame,
        )
        return { ...spread, frames }
      })
    : input.spreads
  return {
    ...input,
    schemaVersion: 4,
    spreads,
  }
}

/**
 * Pure migration: reject newer versions; upgrade supported older versions
 * before Zod validation of the current shape.
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

  let value: unknown = input
  let version = schemaVersion
  if (version === 1) {
    value = migrateV1ToV2(value as Record<string, unknown>)
    version = 2
  }
  if (version === 2) {
    value = migrateV2ToV3(value as Record<string, unknown>)
    version = 3
  }
  if (version === 3) {
    value = migrateV3ToV4(value as Record<string, unknown>)
  }
  return { ok: true, value }
}
