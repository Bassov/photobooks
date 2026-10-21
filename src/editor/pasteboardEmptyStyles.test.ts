import { describe, expect, it } from 'vitest'
import {
  pasteboardEmptyActionsStyle,
  pasteboardEmptyCardStyle,
  pasteboardEmptyOverlayStyle,
  pasteboardPlacementHintStyle,
} from './pasteboardEmptyStyles'

describe('pasteboardEmptyStyles', () => {
  it('keeps the empty overlay non-interactive and the card interactive', () => {
    expect(pasteboardEmptyOverlayStyle.pointerEvents).toBe('none')
    expect(pasteboardEmptyCardStyle.pointerEvents).toBe('auto')
    expect(pasteboardEmptyActionsStyle.justifyContent).toBe('center')
    expect(pasteboardPlacementHintStyle.pointerEvents).toBe('none')
  })
})
