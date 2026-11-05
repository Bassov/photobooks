/** Derivative lab grid: candidate presets, pass thresholds, picks, table. */
import type { DerivativePreset } from '../plan'
import type { LabFixture } from './fixtures'

/** Web image sizes (roadmap Musts). */
export const LAB_EDGES: readonly number[] = [1600, 2048, 3200]

const WEBP_QUALITIES = [0.75, 0.8, 0.85, 0.9]
const JPEG_QUALITIES = [0.8, 0.85, 0.9]

function candidate(
  maxEdge: number,
  mimeType: DerivativePreset['mimeType'],
  quality: number,
): DerivativePreset {
  const format = mimeType === 'image/jpeg' ? 'jpeg' : 'webp'
  const id = `${String(maxEdge)}-${format}-q${String(Math.round(quality * 100))}`
  return { id, maxEdge, mimeType, quality }
}

/** Every edge × (WebP 0.75–0.90, JPEG 0.80–0.90), edge-major. */
export const LAB_CANDIDATES: readonly DerivativePreset[] = LAB_EDGES.flatMap(
  (edge) => [
    ...WEBP_QUALITIES.map((q) => candidate(edge, 'image/webp', q)),
    ...JPEG_QUALITIES.map((q) => candidate(edge, 'image/jpeg', q)),
  ],
)

/** One encoded candidate on one fixture. */
export interface LabResult {
  fixture: LabFixture
  preset: DerivativePreset
  width: number
  height: number
  byteLength: number
  ssim: number
  /** Worst added step between neighbouring 16 px blocks, 8-bit levels. */
  bandStep: number
}

/**
 * Pass bar: luma SSIM at or above `minSsim` on every fixture (foliage sets
 * the floor), and on the `bandFixture` gradient no step between neighbouring
 * 16 px blocks above `maxBandStep` levels: grain removal alone costs ~1
 * level, a 2-level contour across a smooth sky reads as a band.
 */
export const LAB_THRESHOLDS = {
  minSsim: 0.97,
  maxBandStep: 1.5,
  bandFixture: 'sky',
} as const

export function passes(result: LabResult): boolean {
  return (
    result.ssim >= LAB_THRESHOLDS.minSsim &&
    (result.fixture !== LAB_THRESHOLDS.bandFixture ||
      result.bandStep <= LAB_THRESHOLDS.maxBandStep)
  )
}

export interface LabPick {
  maxEdge: number
  mimeType: DerivativePreset['mimeType']
  /** Lowest quality passing on every fixture; undefined when none passes. */
  preset: DerivativePreset | undefined
  /** Bytes summed over the fixtures for `preset` (0 without one). */
  byteLength: number
}

/**
 * Per edge and format (groups ordered by their lowest quality, then first
 * seen): the lowest quality whose results all pass (lowest quality = fewest
 * bytes for one encoder).
 */
export function pickPresets(results: readonly LabResult[]): LabPick[] {
  const byPreset = new Map<
    string,
    { preset: DerivativePreset; rows: LabResult[] }
  >()
  for (const result of results) {
    const entry = byPreset.get(result.preset.id) ?? {
      preset: result.preset,
      rows: [],
    }
    entry.rows.push(result)
    byPreset.set(result.preset.id, entry)
  }
  const picks = new Map<string, LabPick>()
  const ascending = [...byPreset.values()].sort(
    (a, b) => a.preset.quality - b.preset.quality,
  )
  for (const { preset, rows } of ascending) {
    const key = `${String(preset.maxEdge)} ${preset.mimeType}`
    const pick: LabPick = picks.get(key) ?? {
      maxEdge: preset.maxEdge,
      mimeType: preset.mimeType,
      preset: undefined,
      byteLength: 0,
    }
    if (!pick.preset && rows.every(passes)) {
      pick.preset = preset
      pick.byteLength = rows.reduce((sum, row) => sum + row.byteLength, 0)
    }
    picks.set(key, pick)
  }
  return [...picks.values()]
}

function kb(bytes: number): string {
  return (bytes / 1024).toFixed(1)
}

/** Markdown table: one row per fixture × candidate. */
export function labTable(results: readonly LabResult[]): string {
  const rows = results.map(
    (r) =>
      `| ${r.fixture} | ${r.preset.id} | ${String(r.width)}×${String(r.height)} | ${kb(r.byteLength)} | ${r.ssim.toFixed(4)} | ${r.bandStep.toFixed(2)} | ${passes(r) ? 'pass' : 'fail'} |`,
  )
  return [
    '| fixture | preset | size | KB | SSIM | band step | verdict |',
    '| --- | --- | --- | ---: | ---: | ---: | --- |',
    ...rows,
  ].join('\n')
}
