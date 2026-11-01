import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import type { BookOp } from '../core'
import { coalesceKey } from './bookHistory'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { EndpaperCanvas } from './EndpaperCanvas'
import { EndpaperRow } from './EndpaperRow'
import { EndpaperSection } from './EndpaperSection'
import { FIELD, SUB, T } from './editorChromeTokens'
import {
  getSelectedEndpaper,
  setEndpaperSelected,
  subscribeEndpaperSelection,
} from './endpaperSelection'
import { setCoverSelected } from './coverSelection'
import {
  AdjustSection,
  CaptionSection,
  FrameStyleSection,
} from './FrameLookSections'
import { ASSET_DRAG_MIME } from './dropTargets'

const target = { spreadId: 's1', frameId: 'f1' }

function seed(frame = makeFrame({ id: 'f1', assetId: 'a1' })) {
  resetBookStore({
    book: makeBook({
      assets: { a1: {} },
      gallery: ['a1'],
      spreads: [makeSpread({ id: 's1', frames: [frame] })],
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

const frameNow = () => getBookStoreSnapshot().book.spreads[0]?.frames[0]

afterEach(() => {
  cleanup()
  setCoverSelected(false)
  resetBookStore()
})

describe('endpaperSelection', () => {
  it('notifies on change only and is cleared by picking the cover', () => {
    const listener = vi.fn()
    const stop = subscribeEndpaperSelection(listener)
    expect(getSelectedEndpaper()).toBeNull()
    setEndpaperSelected(null)
    expect(listener).not.toHaveBeenCalled()
    setEndpaperSelected('back')
    setEndpaperSelected('back')
    expect(getSelectedEndpaper()).toBe('back')
    expect(listener).toHaveBeenCalledTimes(1)
    setCoverSelected(true)
    expect(getSelectedEndpaper()).toBeNull()
    stop()
    setEndpaperSelected('front')
    expect(listener).toHaveBeenCalledTimes(2)
  })
})

describe('EndpaperRow', () => {
  it('selects its side and shows the kit caption', () => {
    seed()
    render(<EndpaperRow side="back" />)
    const row = screen.getByTestId('endpaper-list-item-back')
    expect(row.textContent).toContain('Endpaper')
    expect(row.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(row)
    expect(getSelectedEndpaper()).toBe('back')
    expect(row.getAttribute('aria-pressed')).toBe('true')
  })
})

describe('EndpaperCanvas', () => {
  it('labels the glued board and takes a dropped photo', () => {
    seed()
    render(<EndpaperCanvas side="front" />)
    const canvas = screen.getByTestId('canvas-endpaper')
    // Kit v7.tsx:78-85: no inner label; the caption sits under the spread.
    expect(canvas.textContent).not.toContain('Pastedown')
    expect(canvas.textContent).toBe('Endpaper')
    const drop = (id: string) => {
      const data = new Map([[ASSET_DRAG_MIME, id]])
      fireEvent.drop(canvas, {
        dataTransfer: {
          getData: (type: string) => data.get(type) ?? '',
          types: [...data.keys()],
        },
      })
    }
    drop('')
    expect(getBookStoreSnapshot().book.endpapers.front.assetId).toBeUndefined()
    drop('a1')
    expect(getBookStoreSnapshot().book.endpapers.front.assetId).toBe('a1')
    expect(canvas.getAttribute('data-photo-id')).toBe('a1')
  })

  it('accepts only asset drags and keeps the mini thumbnail plain', () => {
    seed()
    const { rerender } = render(<EndpaperCanvas side="back" />)
    const canvas = screen.getByTestId('canvas-endpaper')
    const over = (types: string[]) => {
      const event = new Event('dragover', { bubbles: true, cancelable: true })
      Object.assign(event, { dataTransfer: { types, dropEffect: '' } })
      act(() => {
        canvas.dispatchEvent(event)
      })
      return event.defaultPrevented
    }
    expect(over([ASSET_DRAG_MIME])).toBe(true)
    expect(over(['text/plain'])).toBe(false)
    rerender(<EndpaperCanvas side="back" mini />)
    expect(screen.queryByTestId('canvas-endpaper')).toBeNull()
    expect(document.querySelector('.endpaper-caption')).toBeNull()
  })
})

describe('EndpaperSection', () => {
  it('shows the kit header, pattern fill and the Same toggle', () => {
    seed()
    render(<EndpaperSection side="front" />)
    expect(screen.getByTestId('inspector-context').textContent).toBe(
      'Endpaper · front',
    )
    expect(
      screen.getByText('Pastedown and free leaf, printed full bleed'),
    ).toBeTruthy()
    expect(screen.getAllByText('Pattern')).toHaveLength(2)
    const same = screen.getByRole('switch', { name: 'Same on back endpaper' })
    expect(same.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(same)
    expect(getBookStoreSnapshot().book.settings.endpapers.same).toBe(false)
    expect(same.getAttribute('aria-checked')).toBe('false')
  })

  it('shows a photo fill with a way back to the pattern', () => {
    seed()
    render(<EndpaperSection side="back" />)
    expect(screen.queryByTestId('endpaper-clear')).toBeNull()
    act(() => {
      resetBookStore({
        book: {
          ...getBookStoreSnapshot().book,
          endpapers: {
            front: {},
            back: {
              assetId: 'a1',
              crop: { zoom: 1, center: { x: 0.5, y: 0.5 } },
            },
          },
        },
        sessionMeta: new Map(),
        importRunning: false,
        importExpectedCount: 0,
      })
    })
    expect(
      screen.getByTestId('endpaper-fill').getAttribute('data-photo-id'),
    ).toBe('a1')
    expect(screen.getByTestId('endpaper-style').textContent).toBe('Photo')
    expect(
      screen
        .getByTestId('endpaper-sec-fill')
        .querySelectorAll('.endpaper-row')[1]?.firstElementChild?.textContent,
    ).toBe('Photo')
    fireEvent.click(screen.getByTestId('endpaper-clear'))
    expect(getBookStoreSnapshot().book.endpapers.back).toEqual({})
  })

  it('lays out the kit Fill and Apply sections (Owner Must M48, round 8)', () => {
    seed()
    render(<EndpaperSection side="front" />)
    const fill = screen.getByTestId('endpaper-sec-fill')
    const apply = screen.getByTestId('endpaper-sec-apply')
    expect(fill.className).toBe('px-4 py-4')
    expect(apply.className).toBe('px-4 py-4')
    expect(
      [...document.querySelectorAll('.endpaper-sec-title')].map((title) => [
        title.tagName,
        title.textContent,
        title.parentElement?.className,
      ]),
    ).toEqual([
      ['H3', 'Fill', 'mb-3 flex items-center justify-between'],
      ['H3', 'Apply', 'mb-3 flex items-center justify-between'],
    ])
    // Kit Row: label, "Pattern" chip, "coming later" as three row children.
    const style = screen.getByTestId('endpaper-style-row')
    expect(style.className).toBe('endpaper-row')
    expect([...style.children].map((child) => child.textContent)).toEqual([
      'Style',
      'Pattern',
      'coming later',
    ])
    const chip = screen.getByTestId('endpaper-style')
    expect(chip.className).toBe('rounded-sm px-2 py-1')
    expect(chip.style.background).toBe(FIELD)
    expect(chip.style.color).toBe(T)
    const note = screen.getByTestId('endp-fill-readonly')
    expect(note.className).toBe('ml-1.5 text-2xs')
    expect(note.style.color).toBe(SUB)
    expect(apply.querySelectorAll('.endpaper-row')).toHaveLength(1)
    expect(fill.querySelectorAll('.endpaper-row')).toHaveLength(2)
    for (const row of document.querySelectorAll('.endpaper-row')) {
      expect((row.firstElementChild as HTMLElement).style.color).toBe(SUB)
    }
  })
})

describe('Adjust / Caption / Frame style sections', () => {
  it('adjust writes sliders and resets', () => {
    seed()
    render(<AdjustSection target={target} />)
    const reset = screen.getByTestId<HTMLButtonElement>('adjust-reset')
    expect(reset.disabled).toBe(true)
    const slider = within(screen.getByTestId('adjust-brightness')).getByRole(
      'slider',
    )
    fireEvent.change(slider, { target: { value: '40' } })
    expect(frameNow()?.adjust?.brightness).toBe(40)
    expect(reset.disabled).toBe(false)
    fireEvent.click(reset)
    expect(frameNow()?.adjust).toBeUndefined()
  })

  it('adjust renders nothing for an empty frame', () => {
    seed(makeFrame({ id: 'f1' }))
    render(<AdjustSection target={target} />)
    expect(screen.queryByTestId('adjust')).toBeNull()
  })

  it('caption edits the frame and ignores key presses reaching shortcuts', () => {
    seed()
    render(<CaptionSection target={target} />)
    const input = screen.getByTestId<HTMLInputElement>('caption-input')
    fireEvent.change(input, { target: { value: 'Sea' } })
    expect(frameNow()?.caption).toBe('Sea')
    expect(input.value).toBe('Sea')
    const parent = vi.fn()
    document.addEventListener('keydown', parent)
    fireEvent.keyDown(input, { key: 'x' })
    document.removeEventListener('keydown', parent)
    expect(parent).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '' } })
    expect(frameNow()?.caption).toBeUndefined()
  })

  it('frame style applies presets, edits one, and starts a new style', () => {
    seed()
    render(<FrameStyleSection target={target} />)
    expect(screen.queryByTestId('style-mat')).toBeNull()
    expect(screen.getByTestId('style-none').getAttribute('aria-pressed')).toBe(
      'true',
    )
    fireEvent.click(screen.getByTestId('style-white-mat'))
    expect(frameNow()?.frameStyleId).toBe('white-mat')
    expect(screen.getByTestId('style-uses').textContent).toContain('1')
    const radius = within(screen.getByTestId('style-radius')).getByRole(
      'slider',
    )
    fireEvent.change(radius, { target: { value: '4' } })
    expect(getBookStoreSnapshot().book.frameStyles['white-mat']).toMatchObject({
      cornerRadiusMm: 4,
    })
    fireEvent.click(screen.getByTestId('style-new'))
    expect(frameNow()?.frameStyleId).toBe('style-2')
    expect(screen.getByTestId('style-style-2')).toBeTruthy()
    fireEvent.click(screen.getByTestId('style-none'))
    expect(frameNow()?.frameStyleId).toBeUndefined()
  })

  it('frame style hides on a missing frame', () => {
    seed()
    render(<FrameStyleSection target={{ spreadId: 's1', frameId: 'nope' }} />)
    expect(screen.queryByTestId('frame-style')).toBeNull()
  })
})

describe('coalesceKey for the new ops', () => {
  const key = (op: BookOp) => coalesceKey(op)
  it('merges repeated edits of the same control', () => {
    expect(key({ type: 'setCoverStyle', patch: { spineWidthMm: 9 } })).toBe(
      'coverStyle:spineWidthMm',
    )
    expect(key({ type: 'setTrim', widthMm: 1, heightMm: 2 })).toBe('setTrim')
    expect(
      key({
        type: 'setFrameCaption',
        spreadId: 's',
        frameId: 'f',
        caption: 'a',
      }),
    ).toBe('caption:s:f')
    expect(
      key({
        type: 'setFrameAdjust',
        spreadId: 's',
        frameId: 'f',
        patch: { contrast: 1 },
      }),
    ).toBe('adjust:s:f:contrast')
    expect(
      key({ type: 'setFrameAdjust', spreadId: 's', frameId: 'f', patch: null }),
    ).toBeUndefined()
    expect(
      key({ type: 'editFrameStyle', styleId: 'x', patch: { matMm: 1 } }),
    ).toBe('frameStyle:x:matMm')
  })
})
