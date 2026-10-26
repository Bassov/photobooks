import { DEFAULT_PAGE_PRESET_ID } from './pageSizePresets'

/** Helpers for Create book dialog field updates (kept pure for mutation tests). */

export function acceptPositiveCm(raw: string, current: number): number {
  const n = Number(raw)
  if (Number.isFinite(n) && n > 0) {
    return n
  }
  return current
}

export function createBookFormDefaults() {
  return {
    title: '',
    presetId: DEFAULT_PAGE_PRESET_ID,
    orientation: 'portrait' as const,
    customWCm: 18,
    customHCm: 24,
  }
}
