import type { BadgeProps } from '../ui/Badge'
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

/** Badge color for the chrome save indicator (status tokens, not ad-hoc hex). */
export function saveIndicatorBadgeColor(
  savePhase: SavePhase,
  dirty: boolean,
): NonNullable<BadgeProps['color']> {
  if (savePhase === 'error') {
    return 'error'
  }
  if (savePhase === 'saving' || savePhase === 'pending' || dirty) {
    return 'warning'
  }
  return 'success'
}
