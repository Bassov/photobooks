import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COPIED_MS, ShareButton } from './ShareButton'

const roomCss = readFileSync(
  resolve(process.cwd(), 'src/site/book/room.css'),
  'utf8',
)

const URL = 'https://alex.example/books/abc/'

const button = () => screen.getByTestId('site-share')
const copied = () => button().hasAttribute('data-copied')

async function press() {
  await act(async () => {
    fireEvent.click(button())
    await Promise.resolve()
  })
}

/** A navigator with only these members, on a fine or a coarse pointer. */
function stubDevice(value: Partial<Navigator>, coarse = false) {
  vi.stubGlobal('navigator', value)
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: coarse && query === '(pointer: coarse)',
  }))
}

/** The next animation frame: the one that paints "Copied". */
function paint() {
  act(() => {
    vi.advanceTimersToNextFrame()
  })
}

/** A clipboard whose write settles when the test says so. */
function lateClipboard() {
  const writes: (() => void)[] = []
  stubDevice({
    clipboard: {
      writeText: () =>
        new Promise<void>((resolve) => {
          writes.push(resolve)
        }),
    } as unknown as Clipboard,
  })
  return async (i: number) => {
    await act(async () => {
      writes[i]?.()
      await Promise.resolve()
    })
  }
}

/** The labels the room's CSS leaves visible (both sit in one grid cell). */
const visible = () =>
  [...button().children]
    .filter((s) => getComputedStyle(s).visibility !== 'hidden')
    .map((s) => s.textContent)

const show = () =>
  render(<ShareButton className="t16" title="Alps" url={() => URL} />)

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('ShareButton', () => {
  it('is a text button holding both labels, Copied the polite live region', () => {
    stubDevice({})
    show()

    expect(button().className).toBe('t16 g ss-tx sb-share')
    expect([...button().children].map((s) => s.textContent)).toStrictEqual([
      'Share',
      'Copied',
    ])
    expect(screen.getByText('Copied').getAttribute('aria-live')).toBe('polite')
    expect(copied()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('copies the link and reads "Copied" for 2 s, then Share again', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    stubDevice({ clipboard: { writeText } as unknown as Clipboard })
    show()

    await press()

    expect(writeText).toHaveBeenCalledWith(URL)
    expect(copied()).toBe(true)
    paint()
    act(() => {
      vi.advanceTimersByTime(COPIED_MS - 1)
    })
    expect(copied()).toBe(true)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(copied()).toBe(false)
  })

  it('restarts the 2 s on a second press', async () => {
    stubDevice({
      clipboard: { writeText: () => Promise.resolve() } as unknown as Clipboard,
    })
    show()

    await press()
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    await press()
    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(copied()).toBe(true)
  })

  it.each([
    [
      'the clipboard refuses',
      {
        clipboard: {
          writeText: () => Promise.reject(new Error('denied')),
        } as unknown as Clipboard,
      },
    ],
    ['there is no clipboard', {}],
    ['a fine pointer has a share sheet', { share: () => Promise.resolve() }],
  ])('still reads "Copied" when %s', async (_name, members) => {
    stubDevice(members)
    show()

    await press()

    expect(copied()).toBe(true)
  })

  it('opens the share sheet on a coarse pointer, without "Copied"', async () => {
    const share = vi.fn(() =>
      Promise.reject(new DOMException('dismissed', 'AbortError')),
    )
    const writeText = vi.fn(() => Promise.resolve())
    stubDevice(
      { share, clipboard: { writeText } as unknown as Clipboard },
      true,
    )
    show()

    await press()

    expect(share).toHaveBeenCalledWith({ title: 'Alps', url: URL })
    expect(writeText).not.toHaveBeenCalled()
    expect(copied()).toBe(false)
  })

  it('copies on a coarse pointer without a share sheet', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    stubDevice({ clipboard: { writeText } as unknown as Clipboard }, true)
    show()

    await press()

    expect(writeText).toHaveBeenCalledWith(URL)
    expect(copied()).toBe(true)
  })

  describe('with the room CSS', () => {
    beforeEach(() => {
      const style = document.createElement('style')
      style.textContent = roomCss
      document.head.append(style)
      return () => {
        style.remove()
      }
    })

    it('shows Share until a late clipboard write settles, then Copied for 2 s from its frame', async () => {
      const settle = lateClipboard()
      show()

      await press()
      act(() => {
        vi.advanceTimersByTime(5000)
      })
      expect(visible()).toStrictEqual(['Share'])

      // a long task holds the frame that paints Copied for 1.5 s
      const frames: FrameRequestCallback[] = []
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        frames.push(cb)
        return frames.length
      })
      await settle(0)
      expect(visible()).toStrictEqual(['Copied'])
      act(() => {
        vi.advanceTimersByTime(1500)
      })
      expect(visible()).toStrictEqual(['Copied'])

      act(() => {
        frames.forEach((cb) => {
          cb(performance.now())
        })
      })
      act(() => {
        vi.advanceTimersByTime(COPIED_MS - 1)
      })
      expect(visible()).toStrictEqual(['Copied'])
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(visible()).toStrictEqual(['Share'])
    })

    it('restarts the 2 s on a second click during Copied, whichever write settles last', async () => {
      const settle = lateClipboard()
      show()

      await press()
      await press()
      await settle(1)
      paint()
      act(() => {
        vi.advanceTimersByTime(1500)
      })
      expect(visible()).toStrictEqual(['Copied'])

      // the first click's write settles late: the window restarts, never ends early
      await settle(0)
      paint()
      act(() => {
        vi.advanceTimersByTime(COPIED_MS - 1)
      })
      expect(visible()).toStrictEqual(['Copied'])
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(visible()).toStrictEqual(['Share'])
      act(() => {
        vi.advanceTimersByTime(COPIED_MS)
      })
      expect(visible()).toStrictEqual(['Share'])
    })
  })

  it('drops the frame that would start the window on unmount', async () => {
    stubDevice({})
    const { unmount } = show()
    await press()
    expect(copied()).toBe(true)

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('arms no timer when the write settles after unmount', async () => {
    const settle = lateClipboard()
    const { unmount } = show()
    await press()
    unmount()

    await settle(0)

    expect(vi.getTimerCount()).toBe(0)
  })

  it('drops the pending label reset on unmount', async () => {
    stubDevice({})
    const clear = vi.spyOn(window, 'clearTimeout')
    const { unmount } = show()
    await press()
    clear.mockClear()

    unmount()

    expect(clear).toHaveBeenCalledTimes(1)
  })
})
