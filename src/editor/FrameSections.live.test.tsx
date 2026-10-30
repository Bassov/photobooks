import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { resetBookStore } from './bookStore'
import { GeometrySection } from './FrameSections'
import { clearLiveGeometry, publishLiveGeometry } from './liveGeometry'

const target = { spreadId: 's1', frameId: 'f1' }

function seed() {
  resetBookStore({
    book: makeBook({
      spreads: [
        makeSpread({
          id: 's1',
          frames: [
            makeFrame({
              id: 'f1',
              z: 1,
              rect: { x: 10, y: 20, width: 50, height: 40 },
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

const value = (name: string) =>
  screen.getByRole<HTMLInputElement>('textbox', { name }).value

describe('GeometrySection live values', () => {
  afterEach(() => {
    cleanup()
    act(() => {
      clearLiveGeometry()
    })
    vi.unstubAllGlobals()
  })

  it('shows the gesture values for its frame and reverts on clear', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    seed()
    render(<GeometrySection target={target} />)
    expect(value('Width')).toBe('50')
    act(() => {
      publishLiveGeometry({
        spreadId: 's1',
        frameId: 'f1',
        rect: { x: 11, y: 22, width: 33, height: 44 },
        rotationDeg: 0,
      })
    })
    expect(value('X')).toBe('11')
    expect(value('Y')).toBe('22')
    expect(value('Width')).toBe('33')
    expect(value('Height')).toBe('44')
    act(() => {
      clearLiveGeometry()
    })
    expect(value('Width')).toBe('50')
  })

  it('ignores the live values of another frame', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    seed()
    render(<GeometrySection target={target} />)
    act(() => {
      publishLiveGeometry({
        spreadId: 's1',
        frameId: 'other',
        rect: { x: 1, y: 1, width: 9, height: 9 },
        rotationDeg: 0,
      })
    })
    expect(value('Width')).toBe('50')
  })
})
