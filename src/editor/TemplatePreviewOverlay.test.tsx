import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import { resetBookStore } from './bookStore'
import { LayoutSection } from './LayoutSection'
import {
  setTemplatePreview,
  subscribeTemplatePreview,
  templatePreviewOn,
} from './templatePreview'
import { TemplatePreviewOverlay } from './TemplatePreviewOverlay'

function seed() {
  resetBookStore({
    book: makeBook({ spreads: [makeSpread({ id: 's1' })] }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

afterEach(() => {
  cleanup()
  setTemplatePreview(null)
  resetBookStore()
})

describe('templatePreview store (kit setTemplatePreview)', () => {
  it('reports the previewed template on its spread only', () => {
    expect(templatePreviewOn('s1')).toBe('')
    setTemplatePreview({ spreadId: 's1', templateId: 'panorama' })
    expect(templatePreviewOn('s1')).toBe('panorama')
    expect(templatePreviewOn('s2')).toBe('')
  })

  it('notifies on change only, and stops after unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeTemplatePreview(listener)
    setTemplatePreview({ spreadId: 's1', templateId: 'panorama' })
    setTemplatePreview({ spreadId: 's1', templateId: 'panorama' })
    expect(listener).toHaveBeenCalledTimes(1)
    setTemplatePreview({ spreadId: 's1', templateId: 'hero-two' })
    setTemplatePreview({ spreadId: 's2', templateId: 'hero-two' })
    expect(listener).toHaveBeenCalledTimes(3)
    setTemplatePreview(null)
    setTemplatePreview(null)
    expect(listener).toHaveBeenCalledTimes(4)
    unsubscribe()
    setTemplatePreview({ spreadId: 's1', templateId: 'panorama' })
    expect(listener).toHaveBeenCalledTimes(4)
  })
})

describe('TemplatePreviewOverlay (kit canvas.tsx:461)', () => {
  it('shows the previewed slots and label on its spread', () => {
    seed()
    render(<TemplatePreviewOverlay spreadId="s1" />)
    expect(screen.queryByTestId('tpl-preview')).toBeNull()
    act(() => {
      setTemplatePreview({ spreadId: 's1', templateId: 'hero-two' })
    })
    const layer = screen.getByTestId('tpl-preview')
    expect(layer.getAttribute('data-template')).toBe('hero-two')
    expect(screen.getAllByTestId('tpl-preview-slot')).toHaveLength(3)
    expect(layer.textContent).toBe('Preview · Hero + two')
    act(() => {
      setTemplatePreview(null)
    })
    expect(screen.queryByTestId('tpl-preview')).toBeNull()
  })

  it('clips a Full bleed preview to the trim', () => {
    seed()
    render(<TemplatePreviewOverlay spreadId="s1" />)
    act(() => {
      setTemplatePreview({ spreadId: 's1', templateId: 'full-bleed' })
    })
    expect(screen.getByTestId('tpl-preview-slot').getAttribute('style')).toBe(
      'left: 0%; top: 0%; width: 100%; height: 100%;',
    )
  })

  it('stays quiet for another or a missing spread', () => {
    seed()
    render(
      <>
        <TemplatePreviewOverlay spreadId="s1" />
        <TemplatePreviewOverlay spreadId="gone" />
      </>,
    )
    act(() => {
      setTemplatePreview({ spreadId: 'gone', templateId: 'panorama' })
    })
    expect(screen.queryByTestId('tpl-preview')).toBeNull()
  })
})

describe('LayoutSection drives the hover preview', () => {
  const tile = () =>
    screen.getByRole('button', { name: 'Apply layout Panorama' })

  it('previews on hover / focus and clears on leave / blur', () => {
    seed()
    render(<LayoutSection spreadId="s1" />)
    fireEvent.mouseEnter(tile())
    expect(templatePreviewOn('s1')).toBe('panorama')
    fireEvent.mouseLeave(tile())
    expect(templatePreviewOn('s1')).toBe('')
    fireEvent.focus(tile())
    expect(templatePreviewOn('s1')).toBe('panorama')
    fireEvent.blur(tile())
    expect(templatePreviewOn('s1')).toBe('')
  })

  it('clears the preview when a layout is applied or the section unmounts', () => {
    seed()
    const { unmount } = render(<LayoutSection spreadId="s1" />)
    fireEvent.mouseEnter(tile())
    fireEvent.click(tile())
    expect(templatePreviewOn('s1')).toBe('')
    fireEvent.mouseEnter(tile())
    unmount()
    expect(templatePreviewOn('s1')).toBe('')
  })
})
