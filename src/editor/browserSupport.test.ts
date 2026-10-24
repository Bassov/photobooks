import { afterEach, describe, expect, it } from 'vitest'

import {
  getBrowserSupport,
  UNSUPPORTED_BROWSER_MESSAGE,
} from './browserSupport'

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

  it('rejects missing directory picker', () => {
    Object.defineProperty(globalThis, 'isSecureContext', {
      configurable: true,
      value: true,
    })
    Reflect.deleteProperty(globalThis, 'showDirectoryPicker')

    expect(getBrowserSupport()).toEqual({
      supported: false,
      reason: 'no-directory-picker',
    })
  })

  it('rejects insecure context', () => {
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

    expect(getBrowserSupport()).toEqual({
      supported: false,
      reason: 'insecure-context',
    })
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
    })
  })

  it('exports Chromium-required copy', () => {
    expect(UNSUPPORTED_BROWSER_MESSAGE).toMatch(/Chrome, Edge/)
  })
})
