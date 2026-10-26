import { afterEach, describe, expect, it } from 'vitest'

import {
  CHROME_DOWNLOAD_URL,
  CHROMIUM_BROWSERS,
  getBrowserSupport,
  pickBrowserName,
  UNSUPPORTED_SHARE_URL,
} from './browserSupport'

describe('pickBrowserName', () => {
  it('skips empty, Not-A-Brand grease, and Chromium engine labels', () => {
    expect(
      pickBrowserName([
        { brand: '', version: '1' },
        { brand: 'Not A Brand', version: '99' },
        { brand: 'Not_A Brand', version: '8' },
        { brand: 'Chromium', version: '130' },
        { brand: 'Google Chrome', version: '130' },
      ]),
    ).toEqual({ isChromium: true, browserName: 'Google Chrome' })
  })

  it('returns Chromium when only the engine brand is present', () => {
    expect(pickBrowserName([{ brand: 'Chromium', version: '130' }])).toEqual({
      isChromium: true,
      browserName: 'Chromium',
    })
  })

  it('keeps Firefox without marking Chromium', () => {
    expect(pickBrowserName([{ brand: 'Firefox', version: '130' }])).toEqual({
      isChromium: false,
      browserName: 'Firefox',
    })
  })

  it('does not treat a product name that merely contains brand as grease', () => {
    expect(pickBrowserName([{ brand: 'Brand', version: '1' }])).toEqual({
      isChromium: false,
      browserName: 'Brand',
    })
  })
})

describe('getBrowserSupport', () => {
  const originalPicker = Reflect.get(globalThis, 'showDirectoryPicker')
  const originalSecure = Reflect.get(globalThis, 'isSecureContext')

  afterEach(() => {
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

  it('is supported when directory picker exists in a secure context', () => {
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

    expect(getBrowserSupport()).toEqual({ supported: true, reason: 'ok' })
  })

  it('treats missing isSecureContext as allowed (tests/SSR)', () => {
    Object.defineProperty(globalThis, 'isSecureContext', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(globalThis, 'showDirectoryPicker', {
      configurable: true,
      value: () => {
        throw new Error('unused')
      },
    })
    Object.defineProperty(globalThis.navigator, 'userAgentData', {
      configurable: true,
      value: { mobile: false },
    })

    expect(getBrowserSupport()).toEqual({ supported: true, reason: 'ok' })
  })

  it('rejects missing directory picker as other when not Chromium', () => {
    Object.defineProperty(globalThis, 'isSecureContext', {
      configurable: true,
      value: true,
    })
    Reflect.deleteProperty(globalThis, 'showDirectoryPicker')
    Object.defineProperty(globalThis.navigator, 'userAgentData', {
      configurable: true,
      value: { brands: [{ brand: 'Firefox', version: '130' }] },
    })

    expect(getBrowserSupport()).toEqual({
      supported: false,
      reason: 'no-directory-picker',
      variant: 'other',
      browserName: 'Firefox',
    })
  })

  it('uses this browser when no product brand is available', () => {
    Object.defineProperty(globalThis, 'isSecureContext', {
      configurable: true,
      value: true,
    })
    Reflect.deleteProperty(globalThis, 'showDirectoryPicker')
    Object.defineProperty(globalThis.navigator, 'userAgentData', {
      configurable: true,
      value: { brands: [{ brand: '', version: '1' }] },
    })

    expect(getBrowserSupport()).toEqual({
      supported: false,
      reason: 'no-directory-picker',
      variant: 'other',
      browserName: 'this browser',
    })
  })

  it('rejects missing directory picker as no-api when Chromium brands present', () => {
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
          { brand: 'Google Chrome', version: '130' },
        ],
      },
    })

    expect(getBrowserSupport()).toEqual({
      supported: false,
      reason: 'no-directory-picker',
      variant: 'no-api',
      browserName: 'Google Chrome',
    })
  })

  it('rejects insecure context as no-api without a browserName key', () => {
    Object.defineProperty(globalThis, 'isSecureContext', {
      configurable: true,
      value: false,
    })
    Object.defineProperty(globalThis, 'showDirectoryPicker', {
      configurable: true,
      value: () => {
        throw new Error('unused')
      },
    })

    const snap = getBrowserSupport()
    expect(snap).toMatchObject({
      supported: false,
      reason: 'insecure-context',
      variant: 'no-api',
    })
    expect(Object.hasOwn(snap, 'browserName')).toBe(false)
  })

  it('rejects nested frames as no-api', () => {
    expect(
      getBrowserSupport({
        isSecureContext: true,
        showDirectoryPicker: () => {
          throw new Error('unused')
        },
        self: {},
        top: {},
      } as unknown as typeof globalThis),
    ).toMatchObject({
      supported: false,
      reason: 'nested-frame',
      variant: 'no-api',
    })
  })

  it('keeps top-level windows supported when self equals top', () => {
    const frame = {}
    expect(
      getBrowserSupport({
        isSecureContext: true,
        showDirectoryPicker: () => {
          throw new Error('unused')
        },
        self: frame,
        top: frame,
      } as unknown as typeof globalThis),
    ).toEqual({ supported: true, reason: 'ok' })
  })

  it('does not treat a host with only self as a nested frame', () => {
    expect(
      getBrowserSupport({
        isSecureContext: true,
        showDirectoryPicker: () => {
          throw new Error('unused')
        },
        self: {},
      } as unknown as typeof globalThis),
    ).toEqual({ supported: true, reason: 'ok' })
  })

  it('rejects mobile UA when userAgentData.mobile is true', () => {
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

    expect(getBrowserSupport()).toEqual({
      supported: false,
      reason: 'mobile',
      variant: 'mobile',
    })
  })

  it('allows a host object without navigator when the picker exists', () => {
    expect(
      getBrowserSupport({
        isSecureContext: true,
        showDirectoryPicker: () => {
          throw new Error('unused')
        },
      } as unknown as typeof globalThis),
    ).toEqual({ supported: true, reason: 'ok' })
  })

  it('exports kit Chromium CTA targets', () => {
    expect(CHROME_DOWNLOAD_URL).toMatch(/chrome/)
    expect(UNSUPPORTED_SHARE_URL).toMatch(/photobooks\.app/)
    expect(CHROMIUM_BROWSERS).toHaveLength(5)
    expect(CHROMIUM_BROWSERS[0]).toEqual({
      name: 'Microsoft Edge',
      url: 'https://www.microsoft.com/edge',
    })
    expect(CHROMIUM_BROWSERS[1]?.note).toMatch(/brave:\/\/flags/)
  })
})
