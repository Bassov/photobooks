import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COPIED_MS, ShareButton } from './ShareButton'

const URL = 'https://alex.example/books/abc/'

function labels() {
  return [
    ...screen.getByTestId('site-share').querySelectorAll('.site-share-label'),
  ].map(
    (label) =>
      `${label.textContent}${label.hasAttribute('data-hidden') ? ' (hidden)' : ''}`,
  )
}

async function press() {
  await act(async () => {
    fireEvent.click(screen.getByTestId('site-share'))
    await Promise.resolve()
  })
}

/** A navigator with only these members (no share sheet unless given). */
function stubNavigator(value: Partial<Navigator>) {
  vi.stubGlobal('navigator', value)
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('ShareButton', () => {
  it('copies the link, reads "Link copied" for 2 s in the same cell, then Share again', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    stubNavigator({ clipboard: { writeText } as unknown as Clipboard })
    render(<ShareButton title="Alps" url={() => URL} />)

    expect(labels()).toStrictEqual(['Share', 'Link copied (hidden)'])
    await press()

    expect(writeText).toHaveBeenCalledWith(URL)
    expect(labels()).toStrictEqual(['Share (hidden)', 'Link copied'])
    expect(screen.getByRole('status').textContent).toBe(`Link copied: ${URL}`)
    act(() => {
      vi.advanceTimersByTime(COPIED_MS - 1)
    })
    expect(labels()[1]).toBe('Link copied')
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(labels()).toStrictEqual(['Share', 'Link copied (hidden)'])
  })

  it('restarts the 2 s on a second press', async () => {
    stubNavigator({
      clipboard: { writeText: () => Promise.resolve() } as unknown as Clipboard,
    })
    render(<ShareButton title="Alps" url={() => URL} />)

    await press()
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    await press()
    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(labels()[1]).toBe('Link copied')
  })

  it('still reads "Link copied" when the clipboard refuses', async () => {
    stubNavigator({
      clipboard: {
        writeText: () => Promise.reject(new Error('denied')),
      } as unknown as Clipboard,
    })
    render(<ShareButton title="Alps" url={() => URL} />)

    await press()

    expect(labels()[1]).toBe('Link copied')
    expect(screen.getByRole('status').textContent).toBe(`Link copied: ${URL}`)
  })

  it('opens the native share sheet when there is one, without a label change', async () => {
    const share = vi.fn(() =>
      Promise.reject(new DOMException('dismissed', 'AbortError')),
    )
    const writeText = vi.fn(() => Promise.resolve())
    stubNavigator({
      share,
      canShare: () => true,
      clipboard: { writeText } as unknown as Clipboard,
    })
    render(<ShareButton title="Alps" url={() => URL} />)

    await press()

    expect(share).toHaveBeenCalledWith({ title: 'Alps', url: URL })
    expect(writeText).not.toHaveBeenCalled()
    expect(labels()[0]).toBe('Share')
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('copies when the share sheet cannot take the link', async () => {
    const share = vi.fn(() => Promise.resolve())
    const writeText = vi.fn(() => Promise.resolve())
    stubNavigator({
      share,
      canShare: () => false,
      clipboard: { writeText } as unknown as Clipboard,
    })
    render(<ShareButton title="Alps" url={() => URL} />)

    await press()

    expect(share).not.toHaveBeenCalled()
    expect(writeText).toHaveBeenCalledWith(URL)
  })

  it('asks the share sheet about the link itself', async () => {
    const canShare = vi.fn((data?: ShareData) => data?.url === URL)
    const share = vi.fn(() => Promise.resolve())
    stubNavigator({ share, canShare })
    render(<ShareButton title="Alps" url={() => URL} />)

    await press()

    expect(canShare).toHaveBeenCalledWith({ url: URL })
    expect(share).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a share sheet without canShare', { share: () => Promise.resolve() }],
    ['canShare without a share sheet', { canShare: () => true }],
    ['no clipboard either', {}],
  ])('reads "Link copied" with %s', async (_name, members) => {
    stubNavigator(members)
    render(<ShareButton title="Alps" url={() => URL} />)

    await press()

    expect(labels()[1]).toBe('Link copied')
  })

  it('drops the pending label reset on unmount', async () => {
    stubNavigator({})
    const clear = vi.spyOn(window, 'clearTimeout')
    const { unmount } = render(<ShareButton title="Alps" url={() => URL} />)
    await press()
    clear.mockClear()

    unmount()

    expect(clear).toHaveBeenCalledTimes(1)
  })
})
