/**
 * Product gate: Photobooks requires Chromium desktop File System Access.
 * Tests install FSA stubs so this stays false under Playwright/Vitest doubles.
 */

export interface BrowserSupportSnapshot {
  supported: boolean
  reason: 'ok' | 'no-directory-picker' | 'insecure-context' | 'mobile'
}

type NavigatorWithUAData = Navigator & {
  userAgentData?: { mobile?: boolean }
}

export function getBrowserSupport(
  globalObject: typeof globalThis = globalThis,
): BrowserSupportSnapshot {
  const win = globalObject as typeof globalThis & {
    isSecureContext?: boolean
    showDirectoryPicker?: unknown
    navigator?: NavigatorWithUAData
  }

  // Treat explicit insecure; undefined (SSR/tests) is allowed through.
  if (typeof win.isSecureContext === 'boolean' && !win.isSecureContext) {
    return { supported: false, reason: 'insecure-context' }
  }

  const nav = win.navigator as NavigatorWithUAData | undefined
  if (nav !== undefined && nav.userAgentData?.mobile === true) {
    return { supported: false, reason: 'mobile' }
  }

  if (typeof win.showDirectoryPicker !== 'function') {
    return { supported: false, reason: 'no-directory-picker' }
  }

  return { supported: true, reason: 'ok' }
}

export const UNSUPPORTED_BROWSER_MESSAGE =
  'Photobooks works in desktop Chrome, Edge or other Chromium browsers'
