import { defaultCover, defaultEndpapers } from './cover'
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
        if (!Array.isArray((spread as { frames?: unknown } | null)?.frames)) {
          return spread
        }
        const frames = (spread as { frames: unknown[] }).frames.map((frame) =>
          frame !== null && typeof frame === 'object'
            ? { rotationDeg: 0, ...frame }
            : frame,
        )
        return { ...(spread as object), frames }
      })
    : input.spreads
  return {
    ...input,
    schemaVersion: 4,
    spreads,
  }
}

function migrateV4ToV5(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const title = typeof input.title === 'string' ? input.title : ''
  return {
    ...input,
    schemaVersion: 5,
    cover: defaultCover(title),
    endpapers: defaultEndpapers(),
  }
}

function migrateV5ToV6(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const spreads = Array.isArray(input.spreads)
    ? input.spreads.map((spread: unknown) => {
        if (!Array.isArray((spread as { frames?: unknown } | null)?.frames)) {
          return spread
        }
        const frames = (spread as { frames: unknown[] }).frames.map((frame) =>
          frame !== null && typeof frame === 'object'
            ? { kind: 'image', ...frame }
            : frame,
        )
        return { ...(spread as object), frames }
      })
    : input.spreads
  return { ...input, schemaVersion: 6, spreads }
}

/** v2 `left / right` margins become page-scoped `outside / inside`. */
function pageScopedGrid(grid: unknown): unknown {
  if (grid === null || typeof grid !== 'object' || Array.isArray(grid)) {
    return grid
  }
  const margins = (grid as { margins?: unknown }).margins
  if (
    margins === null ||
    typeof margins !== 'object' ||
    Array.isArray(margins)
  ) {
    return grid
  }
  const { left, right, ...rest } = margins as Record<string, unknown>
  return {
    ...grid,
    margins: {
      ...rest,
      ...(left === undefined ? {} : { outside: left }),
      ...(right === undefined ? {} : { inside: right }),
    },
  }
}

function migrateV6ToV7(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const spreads = Array.isArray(input.spreads)
    ? input.spreads.map((spread: unknown) =>
        spread !== null && typeof spread === 'object' && 'layoutGrid' in spread
          ? { ...spread, layoutGrid: pageScopedGrid(spread.layoutGrid) }
          : spread,
      )
    : input.spreads
  return {
    ...input,
    schemaVersion: 7,
    layoutGrid: pageScopedGrid(input.layoutGrid),
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
    version = 4
  }
  if (version === 4) {
    value = migrateV4ToV5(value as Record<string, unknown>)
    version = 5
  }
  if (version === 5) {
    value = migrateV5ToV6(value as Record<string, unknown>)
    version = 6
  }
  if (version === 6) {
    value = migrateV6ToV7(value as Record<string, unknown>)
  }
  return { ok: true, value }
}
