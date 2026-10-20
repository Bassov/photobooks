import { describe, expect, it, vi } from 'vitest'
import { dialogOverlayProps } from './dialogOverlay'

describe('dialogOverlayProps', () => {
  it('defaults isDismissable true and omits uncontrolled props', () => {
    const props = dialogOverlayProps(undefined, undefined, true, 'x')
    expect(props.isDismissable).toBe(true)
    expect(props.className).toContain('pb-dialog-overlay')
    expect(props.className).toContain('x')
    expect('isOpen' in props).toBe(false)
    expect('onOpenChange' in props).toBe(false)
  })

  it('includes controlled isOpen and onOpenChange when provided', () => {
    const onOpenChange = vi.fn()
    const props = dialogOverlayProps(true, onOpenChange, false, undefined)
    expect(props.isOpen).toBe(true)
    expect(props.onOpenChange).toBe(onOpenChange)
    expect(props.isDismissable).toBe(false)
  })
})
