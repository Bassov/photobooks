import { readFileSync } from 'node:fs'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { reloadUnsupportedPage } from './reloadUnsupportedPage'
import { UnsupportedBrowserScreen } from './UnsupportedBrowserScreen'

vi.mock('./reloadUnsupportedPage', () => ({
  reloadUnsupportedPage: vi.fn(),
}))

describe('UnsupportedBrowserScreen', () => {
  const originalPicker = Reflect.get(globalThis, 'showDirectoryPicker')
  const originalSecure = Reflect.get(globalThis, 'isSecureContext')

  afterEach(() => {
    cleanup()
    vi.mocked(reloadUnsupportedPage).mockClear()
    vi.restoreAllMocks()
    vi.useRealTimers()

    if (originalPicker === undefined) {
      Reflect.deleteProperty(globalThis, 'showDirectoryPicker')
    } else {
      Object.defineProperty(globalThis, 'showDirectoryPicker', {
        configurable: true,
        value: originalPicker,
      })
    }
    Object.defineProperty(globalThis, 'isSecureContext', {
      configurable: true,
      value: originalSecure,
    })
    Object.defineProperty(globalThis.navigator, 'userAgentData', {
      configurable: true,
      value: undefined,
    })
  })

  it('shows kit other-browser CTAs when the directory picker is missing', () => {
    Object.defineProperty(globalThis, 'isSecureContext', {
      configurable: true,
      value: true,
    })
    Reflect.deleteProperty(globalThis, 'showDirectoryPicker')
    Object.defineProperty(globalThis.navigator, 'userAgentData', {
      configurable: true,
      value: { brands: [{ brand: 'Firefox', version: '130' }] },
    })

    render(<UnsupportedBrowserScreen />)

    expect(screen.getByTestId('unsupported-browser')).toBeTruthy()
    expect(screen.getByTestId('unsupported-scroll')).toBeTruthy()
    expect(screen.getByTestId('unsupported').getAttribute('data-variant')).toBe(
      'other',
    )
    expect(screen.getByTestId('unsupported-title').textContent).toBe(
      'This browser isn’t supported',
    )
    expect(screen.getByTestId('browser-name').textContent).toBe('Firefox')
    expect(screen.getByTestId('get-chrome').getAttribute('href')).toMatch(
      /chrome/,
    )
    expect(screen.getByTestId('get-chrome').getAttribute('rel')).toBe(
      'noopener noreferrer',
    )
    expect(screen.getByTestId('get-chrome').className).toBe(
      'ub-btn ub-btn--primary',
    )
    expect(
      screen.getByTestId('unsupported-browser').hasAttribute('data-narrow'),
    ).toBe(false)
    expect(screen.getByTestId('browser-list')).toBeTruthy()
    expect(
      [...screen.getByTestId('browser-list').querySelectorAll('a')].map(
        (a) => a.className,
      ),
    ).toEqual(Array.from({ length: 5 }, () => 'ub-pill'))
    expect(screen.getByTestId('browser-link-Microsoft Edge')).toBeTruthy()
    expect(screen.getByTestId('browser-link-Brave')).toBeTruthy()
    const notes = screen
      .getByTestId('unsupported')
      .querySelectorAll('p.ub-note')
    expect([...notes].map((n) => n.textContent)).toEqual([
      'Brave: turn on brave://flags/#file-system-access-api, then relaunch.',
    ])
    expect(screen.getByTestId('copy-link')).toBeTruthy()

    expect(
      screen
        .getByTestId('unsupported')
        .querySelector('[data-icon="appWindow"]'),
    ).toBeTruthy()
    expect(screen.queryByText(/continue anyway/i)).toBeNull()
  })

  it('shows no-api tips and reload when Chromium lacks the picker', () => {
    Object.defineProperty(globalThis, 'isSecureContext', {
      configurable: true,
      value: true,
    })
    Reflect.deleteProperty(globalThis, 'showDirectoryPicker')
    Object.defineProperty(globalThis.navigator, 'userAgentData', {
      configurable: true,
      value: {
        brands: [
          { brand: 'Chromium', version: '130' },
          { brand: 'Brave', version: '130' },
        ],
      },
    })
    render(<UnsupportedBrowserScreen />)

    expect(screen.getByTestId('unsupported').getAttribute('data-variant')).toBe(
      'no-api',
    )
    expect(screen.getByTestId('unsupported-title').textContent).toMatch(
      /Folder access is turned off/i,
    )
    expect(screen.getByTestId('get-chrome').className).toBe(
      'ub-btn ub-btn--secondary',
    )
    expect(screen.getByTestId('reload-after-enable').className).toBe(
      'ub-btn ub-btn--primary',
    )
    expect(
      screen.getByTestId('unsupported').querySelectorAll('ol.ub-tips > li'),
    ).toHaveLength(3)
    expect(
      screen
        .getByTestId('unsupported')
        .querySelector('[data-icon="shieldOff"]'),
    ).toBeTruthy()
    expect(screen.queryByTestId('browser-list')).toBeNull()
    expect(
      screen.getByText(/This is a Chromium browser, but direct folder access/i),
    ).toBeTruthy()
    screen.getByTestId('reload-after-enable').click()
    expect(vi.mocked(reloadUnsupportedPage)).toHaveBeenCalledTimes(1)
  })

  it('shows mobile copy and Copy link when UA is mobile', () => {
    Object.defineProperty(globalThis, 'isSecureContext', {
      configurable: true,
      value: true,
    })
    Object.defineProperty(globalThis, 'showDirectoryPicker', {
      configurable: true,
      value: () => {
        throw new Error('unused')
      },
    })
    Object.defineProperty(globalThis.navigator, 'userAgentData', {
      configurable: true,
      value: { mobile: true },
    })

    render(<UnsupportedBrowserScreen />)

    expect(screen.getByTestId('unsupported').getAttribute('data-variant')).toBe(
      'mobile',
    )
    expect(screen.getByTestId('unsupported-title').textContent).toMatch(
      /desktop computer/i,
    )
    expect(
      screen
        .getByTestId('unsupported')
        .querySelector('[data-icon="monitorSmartphone"]'),
    ).toBeTruthy()
    expect(screen.getByTestId('copy-link')).toBeTruthy()
    expect(screen.getByTestId('copy-link').className).toBe(
      'ub-btn ub-btn--secondary',
    )
    expect(
      screen.getByTestId('unsupported-browser').hasAttribute('data-narrow'),
    ).toBe(true)
    expect(screen.queryByTestId('get-chrome')).toBeNull()
    expect(screen.queryByTestId('browser-list')).toBeNull()
  })

  it('keeps the kit copy of the screen CSS byte-identical', () => {
    expect(readFileSync('uikit/src/features/unsupported.css', 'utf8')).toBe(
      readFileSync('src/editor/UnsupportedBrowserScreen.css', 'utf8'),
    )
  })

  it('copies the share URL when Copy link is pressed', async () => {
    Object.defineProperty(globalThis, 'isSecureContext', {
      configurable: true,
      value: true,
    })
    Reflect.deleteProperty(globalThis, 'showDirectoryPicker')
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(<UnsupportedBrowserScreen />)
    screen.getByTestId('copy-link').click()

    expect(writeText).toHaveBeenCalledWith('https://photobooks.app/')
    expect(await screen.findByText('Link copied')).toBeTruthy()
  })

  it('still shows Link copied when clipboard write rejects', async () => {
    Object.defineProperty(globalThis, 'isSecureContext', {
      configurable: true,
      value: true,
    })
    Reflect.deleteProperty(globalThis, 'showDirectoryPicker')
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('denied')),
      },
    })

    render(<UnsupportedBrowserScreen />)
    screen.getByTestId('copy-link').click()
    expect(await screen.findByText('Link copied')).toBeTruthy()
  })

  it('restores Copy link label after the feedback timeout', async () => {
    vi.useFakeTimers()
    Object.defineProperty(globalThis, 'isSecureContext', {
      configurable: true,
      value: true,
    })
    Reflect.deleteProperty(globalThis, 'showDirectoryPicker')
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })

    render(<UnsupportedBrowserScreen />)
    expect(screen.getByText('Copy link')).toBeTruthy()
    expect(screen.queryByText('Link copied')).toBeNull()
    act(() => {
      screen.getByTestId('copy-link').click()
    })
    expect(screen.getByText('Link copied')).toBeTruthy()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1800)
    })
    expect(screen.getByText('Copy link')).toBeTruthy()
  })
})
