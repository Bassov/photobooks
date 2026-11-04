/** Pure web-derivative plan: presets config, cache ids, job order, start gate. */

type DerivativeMimeType = 'image/webp' | 'image/jpeg'

export interface DerivativePreset {
  id: string
  /** Long-edge px cap; sources below it keep their size (never upscaled). */
  maxEdge: number
  mimeType: DerivativeMimeType
  /** `convertToBlob` quality in (0, 1]. */
  quality: number
}

/** Site presets, smallest first: grid thumb, viewer, 4K lightbox, share card. */
export const DERIVATIVE_PRESETS: readonly DerivativePreset[] = [
  { id: 'site-thumb', maxEdge: 480, mimeType: 'image/webp', quality: 0.8 },
  { id: 'site-display', maxEdge: 1600, mimeType: 'image/webp', quality: 0.82 },
  { id: 'site-large', maxEdge: 3200, mimeType: 'image/webp', quality: 0.85 },
  { id: 'site-share', maxEdge: 1600, mimeType: 'image/jpeg', quality: 0.85 },
]

/** Derivative jobs in flight at once (one worker). */
export const DERIVATIVE_SLOT_CAP = 1

/**
 * Presets for `ids` in config order (all presets when `ids` is undefined).
 * Throws on an id that is not in config.
 */
export function resolvePresets(
  ids: readonly string[] | undefined,
  presets: readonly DerivativePreset[] = DERIVATIVE_PRESETS,
): DerivativePreset[] {
  if (ids === undefined) {
    return [...presets]
  }
  const wanted = new Set(ids)
  for (const id of wanted) {
    if (!presets.some((preset) => preset.id === id)) {
      throw new Error(`Unknown derivative preset: ${id}`)
    }
  }
  return presets.filter((preset) => wanted.has(preset.id))
}

/** Output size: long edge fit into `maxEdge`, never upscaled, ≥ 1 px. */
export function derivativeSize(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * `DerivedCache` preset id: edge, format and quality are part of it, so a
 * config change misses instead of serving stale bytes.
 */
export function presetCacheId(preset: DerivativePreset): string {
  const format = preset.mimeType === 'image/jpeg' ? 'jpeg' : 'webp'
  const quality = String(Math.round(preset.quality * 100))
  return `drv-${preset.id}-${String(preset.maxEdge)}-${format}-q${quality}`
}

export interface DerivativeRequest {
  assetHash: string
  /** Preset ids; all presets when omitted. */
  presetIds?: readonly string[]
}

export interface DerivativeJob<
  R extends DerivativeRequest = DerivativeRequest,
> {
  assetHash: string
  presets: DerivativePreset[]
  /** First request for this asset. */
  request: R
}

/**
 * One job per asset in first-request order; repeated assets merge their
 * presets, which stay in config order.
 */
export function planDerivativeJobs<R extends DerivativeRequest>(
  requests: readonly R[],
  presets: readonly DerivativePreset[] = DERIVATIVE_PRESETS,
): DerivativeJob<R>[] {
  const wanted = new Map<string, { request: R; ids: Set<string> }>()
  for (const request of requests) {
    const ids = resolvePresets(request.presetIds, presets).map((p) => p.id)
    const entry = wanted.get(request.assetHash) ?? {
      request,
      ids: new Set<string>(),
    }
    for (const id of ids) {
      entry.ids.add(id)
    }
    wanted.set(request.assetHash, entry)
  }
  return [...wanted].map(([assetHash, { request, ids }]) => ({
    assetHash,
    presets: presets.filter((preset) => ids.has(preset.id)),
    request,
  }))
}

export interface DerivativeGateSignals {
  /** Thumb + editor-tier decode jobs waiting in the shared decode queue. */
  queuedDecodeJobs: number
  metadataBusy: boolean
  /** Filmstrip scroll / interaction quiet window still open. */
  scrollQuiet: boolean
  activeDerivativeJobs: number
}

/** Derivatives are the lowest lane: start only when everything else is idle. */
export function canStartDerivative(signals: DerivativeGateSignals): boolean {
  return (
    signals.queuedDecodeJobs === 0 &&
    !signals.metadataBusy &&
    !signals.scrollQuiet &&
    signals.activeDerivativeJobs < DERIVATIVE_SLOT_CAP
  )
}
