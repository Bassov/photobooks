import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COPIED_MS, ShareButton } from './ShareButton'

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
  })

  it('copies the link and reads "Copied" for 2 s, then Share again', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    stubDevice({ clipboard: { writeText } as unknown as Clipboard })
    show()

    await press()

    expect(writeText).toHaveBeenCalledWith(URL)
    expect(copied()).toBe(true)
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
