import { DEFAULT_PAGE_PRESET_ID } from './pageSizePresets'

/** Helpers for Create book dialog field updates (kept pure for mutation tests). */

export function createBookFormDefaults() {
  return {
    title: '',
    presetId: DEFAULT_PAGE_PRESET_ID,
    orientation: 'portrait' as const,
    customWCm: 18,
    customHCm: 24,
  }
}
