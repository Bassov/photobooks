import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Profiler } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Frame } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { loadFonts } from '../fonts/loadBookFonts'
import { textStyleFonts } from '../render/textStyles'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { resetCameraStore } from './cameraStore'
import { ConnectedSpreadView } from './ConnectedSpreadView'
import { resetFrameSelection } from './frameSelection'
import {
  isTextOverflowing,
  resetTextEditForTests,
  startTextEdit,
} from './textEditStore'

// text-blocks Perf: fonts load before the first measure, and typing
// re-renders only the edited text frame.

/** Held book font load: the overlay caches one load for the whole module. */
const fonts = vi.hoisted(() => {
  let release = (): void => undefined
  const ready = new Promise<void>((resolve) => {
    release = resolve
  })
  return {
    ready,
    release: () => {
      release()
    },
  }
})

vi.mock('../fonts/loadBookFonts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../fonts/loadBookFonts')>()),
  loadFonts: vi.fn(() => fonts.ready),
}))

function label(id: string, text: string): Frame {
  return {
    id,
    rect: { x: 10, y: 10, width: 60, height: 14 },
    z: 2,
    kind: 'text',
    content: { type: 'static', text },
  }
}

function load() {
  resetBookStore({
    book: makeBook({
      spreads: [
        makeSpread({
          id: 's0',
          frames: [makeFrame({ id: 'a' }), label('t0', 'Morning')],
        }),
        makeSpread({
          id: 's1',
          frames: [makeFrame({ id: 'b' }), label('t1', 'Evening')],
        }),
      ],
    }),
    sessionMeta: new Map(),
    previewUrls: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

/** Both spreads, each under a Profiler counting its commits. */
function mountSpreads(): Record<'s0' | 's1', number> {
  const commits = { s0: 0, s1: 0 }
  render(
    <>
      {(['s0', 's1'] as const).map((id) => (
        <Profiler
          key={id}
          id={id}
          onRender={() => {
            commits[id] += 1
          }}
        >
          <ConnectedSpreadView spreadId={id} />
        </Profiler>
      ))}
    </>,
  )
  return commits
}

/** Pretend layout: every painted text node is taller than its box. */
function mockOverflowingText() {
  const original = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'scrollHeight',
  )
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.matches('.spread-frame-text') ? 400 : 0
    },
  })
  return () => {
    if (original === undefined) {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight')
    } else {
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', original)
    }
  }
}

const flush = () =>
  act(async () => {
    await Promise.resolve()
  })

describe('text frame fonts and renders', () => {
  let restore: (() => void) | null = null

  afterEach(() => {
    restore?.()
    restore = null
    cleanup()
    resetTextEditForTests()
    resetFrameSelection()
    resetBookStore()
    resetCameraStore()
  })

  // First in the file: the font load is still held here.
  it('measures overflow only after the text style fonts loaded, once for every spread', async () => {
    load()
    restore = mockOverflowingText()
    mountSpreads()
    await flush()

    expect(vi.mocked(loadFonts)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(loadFonts)).toHaveBeenCalledWith(textStyleFonts())
    expect(screen.queryByTestId('text-overflow-chip')).toBeNull()
    expect(isTextOverflowing('s0', 't0')).toBe(false)

    await act(async () => {
      fonts.release()
      await fonts.ready
    })

    expect(await screen.findAllByTestId('text-overflow-chip')).toHaveLength(2)
    expect(isTextOverflowing('s0', 't0')).toBe(true)
    expect(isTextOverflowing('s1', 't1')).toBe(true)
    expect(vi.mocked(loadFonts)).toHaveBeenCalledTimes(1)
  })

  it('typing renders no spread and leaves the book; the commit re-renders the edited spread only', async () => {
    load()
    const commits = mountSpreads()
    act(() => {
      startTextEdit({ spreadId: 's0', frameId: 't0' })
    })
    await flush()
    const box = screen.getByTestId<HTMLTextAreaElement>('text-edit')
    const book = getBookStoreSnapshot().book
    const before = { ...commits }

    for (const value of ['Morning o', 'Morning on', 'Morning on the lake']) {
      fireEvent.input(box, { target: { value } })
    }

    expect(commits).toEqual(before)
    expect(getBookStoreSnapshot().book).toBe(book)

    fireEvent.keyDown(box, { key: 'Escape' })

    const [s0, s1] = getBookStoreSnapshot().book.spreads
    expect(s0?.frames.find((frame) => frame.id === 't0')?.content).toEqual({
      type: 'static',
      text: 'Morning on the lake',
    })
    expect(s1).toBe(book.spreads[1])
    expect(commits.s0).toBeGreaterThan(before.s0)
    expect(commits.s1).toBe(before.s1)
  })
})
