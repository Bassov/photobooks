/** Kit v0.9 page-size presets — one page, portrait base (cm). */

export type PageSizePresetId =
  'A6' | 'A5' | 'A4' | 'A3' | 'Letter' | 'sq20' | 'sq30' | 'custom'

export interface PageSizePreset {
  id: Exclude<PageSizePresetId, 'custom'>
  name: string
  /** Portrait base width in cm. */
  wCm: number
  /** Portrait base height in cm. */
  hCm: number
}

export const PAGE_SIZE_PRESETS: readonly PageSizePreset[] = [
  { id: 'A6', name: 'A6', wCm: 10.5, hCm: 14.8 },
  { id: 'A5', name: 'A5', wCm: 14.8, hCm: 21 },
  { id: 'A4', name: 'A4', wCm: 21, hCm: 29.7 },
  { id: 'A3', name: 'A3', wCm: 29.7, hCm: 42 },
  { id: 'Letter', name: 'Letter', wCm: 21.6, hCm: 27.9 },
  { id: 'sq20', name: 'Square 20×20', wCm: 20, hCm: 20 },
  { id: 'sq30', name: 'Square 30×30', wCm: 30, hCm: 30 },
]

export const DEFAULT_PAGE_PRESET_ID: PageSizePresetId = 'A5'
export const CUSTOM_CM_MIN = 10
export const CUSTOM_CM_MAX = 42

export function fmtCm(n: number): string {
  return (Math.round(n * 10) / 10).toString()
}

export function clampCustomCm(n: number): number {
  return Math.min(
    CUSTOM_CM_MAX,
    Math.max(CUSTOM_CM_MIN, Math.round(n * 10) / 10),
  )
}

export function cmToMm(cm: number): number {
  return Math.round(cm * 10 * 10) / 10
}

export function shouldSwapOrientation(
  landscape: boolean,
  wCm: number,
  hCm: number,
): boolean {
  return landscape && wCm !== hCm
}

export function presetLabel(
  preset: Pick<PageSizePreset, 'name' | 'wCm' | 'hCm'>,
  landscape = false,
): string {
  const swap = shouldSwapOrientation(landscape, preset.wCm, preset.hCm)
  const w = swap ? preset.hCm : preset.wCm
  const h = swap ? preset.wCm : preset.hCm
  return `${preset.name} · ${fmtCm(w)} × ${fmtCm(h)} cm`
}

export interface PageTrimMm {
  widthMm: number
  heightMm: number
}

export interface ResolvePageSizeInput {
  presetId: PageSizePresetId
  /** Portrait | landscape — ignored for square / custom. */
  orientation: 'portrait' | 'landscape'
  customWCm: number
  customHCm: number
}

/** Resolve dialog fields to book `settings.trim` millimetres. */
export function resolvePageTrimMm(input: ResolvePageSizeInput): PageTrimMm {
  if (input.presetId === 'custom') {
    return {
      widthMm: cmToMm(clampCustomCm(input.customWCm)),
      heightMm: cmToMm(clampCustomCm(input.customHCm)),
    }
  }
  const preset = PAGE_SIZE_PRESETS.find((p) => p.id === input.presetId)
  if (!preset) {
    // A5 portrait defaults when id is unknown (defensive).
    return { widthMm: cmToMm(14.8), heightMm: cmToMm(21) }
  }
  const swap = shouldSwapOrientation(
    input.orientation === 'landscape',
    preset.wCm,
    preset.hCm,
  )
  return {
    widthMm: cmToMm(swap ? preset.hCm : preset.wCm),
    heightMm: cmToMm(swap ? preset.wCm : preset.hCm),
  }
}
