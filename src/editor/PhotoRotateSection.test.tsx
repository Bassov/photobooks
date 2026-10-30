import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore, undoBook } from './bookStore'
import { exitCropMode } from './cropMode'
import { resetFrameSelection, setFrameSource } from './frameSelection'
import { Inspector } from './Inspector'
import { installEditorRotateKeys } from './installEditorRotateKeys'
import { setActiveSpreadId } from './photoRootSession'
import { PhotoRotateSection } from './PhotoRotateSection'

const TARGET = { spreadId: 'spread-1', frameId: 'f1' }

function seed(withPhoto = true) {
  resetBookStore({
    book: makeBook({
      assets: { a: {} },
      gallery: ['a'],
      spreads: [
        makeSpread({
          id: 'spread-1',
          frames: [
            makeFrame({
              id: 'f1',
              ...(withPhoto ? { assetId: 'a' } : {}),
              rect: { x: 0, y: 0, width: 100, height: 60 },
            }),
          ],
        }),
      ],
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

const crop = () => getBookStoreSnapshot().book.spreads[0]?.frames[0]?.crop

afterEach(() => {
  vi.unstubAllGlobals()
  cleanup()
  exitCropMode()
  resetFrameSelection()
  setActiveSpreadId(null)
  resetBookStore()
})

describe('PhotoRotateSection', () => {
  it('renders nothing for an empty frame', () => {
    seed(false)
    render(<PhotoRotateSection target={TARGET} />)
    expect(screen.queryByTestId('inspector-rotate')).toBeNull()
  })

  it('90° buttons turn the photo; undo restores it', () => {
    seed()
    render(<PhotoRotateSection target={TARGET} />)
    fireEvent.click(screen.getByTestId('rot-right'))
    expect(crop()?.quarterTurns).toBe(1)
    expect(screen.getByTestId('rotate-summary').textContent).toContain('90°')
    fireEvent.click(screen.getByTestId('rot-left'))
    fireEvent.click(screen.getByTestId('rot-left'))
    expect(crop()?.quarterTurns).toBe(3)
    act(() => {
      undoBook()
    })
    expect(crop()?.quarterTurns).toBeUndefined()
  })

  it('is titled Rotate & flip (kit inspector.tsx:151)', () => {
    seed()
    render(<PhotoRotateSection target={TARGET} />)
    expect(screen.getByRole('heading').textContent).toBe('Rotate & flip')
  })

  it('Flip H / Flip V toggle the mirror, show it pressed, and undo', () => {
    seed()
    render(<PhotoRotateSection target={TARGET} />)
    const h = screen.getByTestId('flip-h')
    const v = screen.getByTestId('flip-v')
    expect(h.getAttribute('aria-pressed')).toBe('false')
    expect(v.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(h)
    expect(crop()?.flipH).toBe(true)
    expect(crop()?.flipV).toBeUndefined()
    expect(h.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(v)
    expect(crop()?.flipV).toBe(true)
    expect(crop()?.flipH).toBe(true)
    expect(v.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(h)
    expect(crop()?.flipH).toBeUndefined()
    expect(h.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(v)
    expect(crop()?.flipV).toBeUndefined()
    fireEvent.click(h)
    act(() => {
      undoBook()
    })
    expect(crop()?.flipH).toBeUndefined()
  })

  it('a quarter turn keeps the flip', () => {
    seed()
    render(<PhotoRotateSection target={TARGET} />)
    fireEvent.click(screen.getByTestId('flip-h'))
    fireEvent.click(screen.getByTestId('rot-right'))
    expect(crop()?.flipH).toBe(true)
    expect(crop()?.quarterTurns).toBe(1)
  })

  it('keyboard on the straighten slider commits the angle', () => {
    seed()
    render(<PhotoRotateSection target={TARGET} />)
    const thumb = screen.getByRole('slider')
    fireEvent.keyDown(thumb, { key: 'ArrowRight' })
    fireEvent.keyUp(thumb, { key: 'ArrowRight' })
    expect(crop()?.straightenDeg).toBe(0.5)
  })

  it('is mounted in the Frame tab after Fit & crop', () => {
    seed()
    render(<Inspector />)
    act(() => {
      setFrameSource(TARGET)
    })
    const fit = screen.getByTestId('inspector-fit-crop')
    const rotate = screen.getByTestId('inspector-rotate')
    expect(
      fit.compareDocumentPosition(rotate) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

describe('Photo inspector meta rows', () => {
  it('keeps Spread / Size / Used rows in a collapsed Details section', () => {
    seed()
    render(<Inspector />)
    act(() => {
      setFrameSource(TARGET)
    })
    const details = screen.getByTestId('inspector-details-disclosure')
    expect(details).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: 'Details' })
        .getAttribute('aria-expanded'),
    ).toBe('false')
    // Hidden until expanded.
    expect(screen.getByText('Used').closest('[hidden]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(screen.getByText('Used').closest('[hidden]')).toBeNull()
    expect(screen.getByText('Spread')).toBeTruthy()
  })

  it('has no Used row for an empty frame', () => {
    seed(false)
    render(<Inspector />)
    act(() => {
      setFrameSource(TARGET)
    })
    expect(screen.getByTestId('inspector-details-disclosure')).toBeTruthy()
    expect(screen.queryByText('Used')).toBeNull()
  })
})

describe('PhotoRotateSection straighten preview', () => {
  function mountWithFrameElement() {
    seed()
    const frameEl = document.createElement('div')
    frameEl.setAttribute('data-testid', 'spread-frame')
    frameEl.dataset.frameId = 'f1'
    Object.defineProperty(frameEl, 'offsetWidth', { value: 200 })
    Object.defineProperty(frameEl, 'offsetHeight', { value: 120 })
    const img = document.createElement('img')
    frameEl.append(img)
    document.body.append(frameEl)
    const queue = new Map<number, FrameRequestCallback>()
    let id = 0
    const cancel = vi.fn((handle: number) => {
      queue.delete(handle)
    })
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      id += 1
      queue.set(id, cb)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', cancel)
    const flush = () => {
      for (const [handle, cb] of [...queue]) {
        queue.delete(handle)
        cb(0)
      }
    }
    const view = render(<PhotoRotateSection target={TARGET} />)
    const thumb = screen.getByRole<HTMLInputElement>('slider')
    const track = thumb.closest<HTMLElement>('.fit-crop-track')
    if (track === null) {
      throw new Error('slider track missing')
    }
    track.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 100,
      height: 10,
      right: 100,
      bottom: 10,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    // Pointer down at x% of the track starts a gesture at (x - 50) * 0.9°.
    const press = (percent: number) => {
      fireEvent.pointerDown(track, {
        clientX: percent,
        clientY: 5,
        button: 0,
        pointerId: 1,
        pointerType: 'mouse',
      })
    }
    const release = () => {
      fireEvent.pointerUp(window, {
        clientX: 0,
        clientY: 5,
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
      })
    }
    return { img, queue, cancel, flush, view, thumb, track, press, release }
  }

  it('previews as a transform in rAF and commits once at gesture end', () => {
    const { img, flush, queue, thumb, press, release } = mountWithFrameElement()
    press(75)
    expect(queue.size).toBe(1)
    expect(crop()).toBeUndefined()
    flush()
    expect(img.style.transform).toContain('rotate(22.5deg)')
    expect(img.style.transformOrigin).not.toBe('')
    expect(thumb.value).toBe('22.5')
    release()
    expect(crop()?.straightenDeg).toBe(22.5)
  })

  it('coalesces previews: a newer one cancels the pending frame', () => {
    const { cancel, queue, press, thumb } = mountWithFrameElement()
    press(75)
    expect(cancel).not.toHaveBeenCalled()
    // A key step mid-gesture previews again (cancelling the pending frame),
    // then ends the gesture (cancelling that one).
    fireEvent.keyDown(thumb, { key: 'ArrowRight' })
    expect(cancel).toHaveBeenCalledTimes(2)
    expect(queue.size).toBe(0)
  })

  it('cancels a pending preview at gesture end and on unmount', () => {
    const { cancel, queue, view, press, release } = mountWithFrameElement()
    press(75)
    release()
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(queue.size).toBe(0)
    press(60)
    expect(queue.size).toBe(1)
    view.unmount()
    expect(cancel).toHaveBeenCalledTimes(2)
    expect(queue.size).toBe(0)
  })

  it('double-click clears a pending preview and keeps the stored angle', () => {
    const { img, flush, track, press } = mountWithFrameElement()
    press(75)
    flush()
    expect(img.style.transform).not.toBe('')
    fireEvent.doubleClick(track)
    expect(img.style.transform).toBe('')
    expect(img.style.transformOrigin).toBe('')
    expect(crop()?.straightenDeg ?? 0).toBe(0)
  })

  it('double-click on the track resets a committed angle', () => {
    const { img, flush, track, press, release } = mountWithFrameElement()
    press(75)
    release()
    expect(crop()?.straightenDeg).toBe(22.5)
    flush()
    fireEvent.doubleClick(track)
    expect(crop()?.straightenDeg ?? 0).toBe(0)
    expect(img.style.transform).not.toContain('rotate(22.5deg)')
  })

  it('shows the angle and a proportional fill', () => {
    const { press, release } = mountWithFrameElement()
    press(75)
    release()
    const fill = document.querySelector<HTMLElement>('.fit-crop-fill')
    expect(fill?.style.width).toBe('75%')
    expect(screen.getByTestId('photo-straighten').textContent).toContain(
      '22.5°',
    )
  })

  it('renders nothing when the spread id does not match', () => {
    seed()
    render(<PhotoRotateSection target={{ spreadId: 'nope', frameId: 'f1' }} />)
    expect(screen.queryByTestId('inspector-rotate')).toBeNull()
  })
})

describe('installEditorRotateKeys', () => {
  function press(key: string, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    })
    window.dispatchEvent(event)
    return event
  }

  it('. and , turn the selected frame; modifiers and no selection do nothing', () => {
    seed()
    const off = installEditorRotateKeys()
    expect(press('.').defaultPrevented).toBe(false)
    act(() => {
      setFrameSource(TARGET)
    })
    expect(press('.', { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(press('x').defaultPrevented).toBe(false)
    expect(crop()).toBeUndefined()
    expect(press('.').defaultPrevented).toBe(true)
    expect(crop()?.quarterTurns).toBe(1)
    press(',')
    press(',')
    expect(crop()?.quarterTurns).toBe(3)
    off()
    press('.')
    expect(crop()?.quarterTurns).toBe(3)
  })

  it('ignores keys typed into inputs', () => {
    seed()
    act(() => {
      setFrameSource(TARGET)
    })
    const off = installEditorRotateKeys()
    const input = document.createElement('input')
    document.body.append(input)
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: '.', bubbles: true }),
    )
    expect(crop()).toBeUndefined()
    input.remove()
    off()
  })
})
