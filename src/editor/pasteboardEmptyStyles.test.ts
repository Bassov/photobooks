import { describe, expect, it } from 'vitest'
import {
  pasteboardEmptyActionsStyle,
  pasteboardEmptyCardStyle,
  pasteboardEmptyOverlayStyle,
  pasteboardPlacementHintStyle,
} from './pasteboardEmptyStyles'

describe('pasteboardEmptyStyles', () => {
  it('keeps pasteboard pan free; only empty-card actions capture hits', () => {
    expect(pasteboardEmptyOverlayStyle.pointerEvents).toBe('none')
    expect(pasteboardEmptyCardStyle.pointerEvents).toBe('none')
    expect(pasteboardEmptyActionsStyle.pointerEvents).toBe('auto')
    expect(pasteboardEmptyActionsStyle.justifyContent).toBe('center')
    expect(pasteboardPlacementHintStyle.pointerEvents).toBe('none')
  })
})
