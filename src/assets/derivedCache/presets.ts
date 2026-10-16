export const THUMB_PRESET_ID = 'thumb'

export function tierPresetId(tier: number): string {
  return `tier-${String(tier)}`
}
