import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
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
