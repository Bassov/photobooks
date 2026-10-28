import type { SavePhase } from './session/autosaveController'

export function saveIndicatorLabel(
  savePhase: SavePhase,
  dirty: boolean,
): string {
  if (savePhase === 'saving') {
    return 'Saving…'
  }
  if (savePhase === 'error') {
    return 'Save failed'
  }
  if (savePhase === 'pending' || dirty) {
    return 'Unsaved'
  }
  return 'Saved'
}
