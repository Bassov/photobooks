/**
 * Product gate: Photobooks requires Chromium desktop File System Access.
 * Tests install FSA stubs so this stays false under Playwright/Vitest doubles.
 */

export type UnsupportedVariant = 'other' | 'no-api' | 'mobile'

export interface BrowserSupportSnapshot {
  supported: boolean
  reason:
    | 'ok'
    | 'no-directory-picker'
    | 'insecure-context'
    | 'mobile'
    | 'nested-frame'
  /** Present when `supported` is false — drives kit unsupported copy/CTAs. */
  variant?: UnsupportedVariant
  /** Best-effort brand label for “other” copy (UA brands only). */
  browserName?: string
}

type NavigatorWithUAData = Navigator & {
  userAgentData?: {
    mobile?: boolean
    brands?: readonly { brand: string; version: string }[]
  }
}

type HostGlobal = typeof globalThis & {
  isSecureContext?: boolean
  showDirectoryPicker?: unknown
  navigator?: NavigatorWithUAData
}

/** Skip grease / engine labels; keep product names for unsupported copy. */
export function pickBrowserName(
  brands: readonly { brand: string; version: string }[],
): { isChromium: boolean; browserName: string | undefined } {
  const names = brands.map((b) => b.brand)
  let isChromium = false
  let browserName: string | undefined
  for (const name of names) {
    if (name.length === 0) {
      continue
    }
    const lower = name.toLowerCase()
    if (lower.includes('chromium')) {
      isChromium = true
      continue
    }
    if (lower.startsWith('not') && lower.includes('brand')) {
      continue
    }
    browserName ??= name
  }
  if (browserName === undefined && isChromium) {
    browserName = 'Chromium'
  }
  return { isChromium, browserName }
}

function readBrandMeta(nav: NavigatorWithUAData | undefined): {
  mobile: boolean
  isChromium: boolean
  browserName: string | undefined
} {
  const brands = nav?.userAgentData?.brands ?? []
  const { isChromium, browserName } = pickBrowserName(brands)
  return {
    mobile: nav?.userAgentData?.mobile === true,
    isChromium,
    browserName,
  }
}

function unsupportedVariant(
  reason: Exclude<BrowserSupportSnapshot['reason'], 'ok'>,
  isChromium: boolean,
): UnsupportedVariant {
  if (reason === 'mobile') {
    return 'mobile'
  }
  if (
    reason === 'insecure-context' ||
    reason === 'nested-frame' ||
    isChromium
  ) {
    return 'no-api'
  }
  return 'other'
}

function fail(
  reason: Exclude<BrowserSupportSnapshot['reason'], 'ok'>,
  isChromium: boolean,
  browserName: string | undefined,
): BrowserSupportSnapshot {
  const variant = unsupportedVariant(reason, isChromium)
  const snap: BrowserSupportSnapshot = {
    supported: false,
    reason,
    variant,
  }
  if (variant === 'other') {
    // Stryker disable next-line ConditionalExpression,EqualityOperator: empty vs undefined both map to the same fallback label
    snap.browserName =
      browserName !== undefined && browserName.length > 0
        ? browserName
        : 'this browser'
  } else if (browserName !== undefined && browserName.length > 0) {
    // Stryker disable next-line ConditionalExpression,EqualityOperator: no-api omits empty labels; equivalent under public snapshots
    snap.browserName = browserName
  }
  return snap
}

export function getBrowserSupport(
  globalObject: typeof globalThis = globalThis,
): BrowserSupportSnapshot {
  const win = globalObject as HostGlobal
  const nav = win.navigator as NavigatorWithUAData | undefined
  const { mobile, isChromium, browserName } = readBrandMeta(nav)

  // Treat explicit insecure; undefined (SSR/tests) is allowed through.
  if (typeof win.isSecureContext === 'boolean' && !win.isSecureContext) {
    return fail('insecure-context', isChromium, browserName)
  }

  // Nested browsing contexts cannot grant durable FSA folder access.
  const host = globalObject as typeof globalThis & {
    self?: unknown
    top?: unknown
  }
  if (
    Object.hasOwn(host, 'self') &&
    Object.hasOwn(host, 'top') &&
    host.self !== host.top
  ) {
    return fail('nested-frame', isChromium, browserName)
  }

  if (nav !== undefined && mobile) {
    return fail('mobile', isChromium, browserName)
  }

  if (typeof win.showDirectoryPicker !== 'function') {
    return fail('no-directory-picker', isChromium, browserName)
  }

  return { supported: true, reason: 'ok' }
}

/** Share URL used by Copy link on the unsupported screen. */
export const UNSUPPORTED_SHARE_URL = 'https://photobooks.app/'

export const CHROME_DOWNLOAD_URL = 'https://www.google.com/chrome/'

export const CHROMIUM_BROWSERS: {
  name: string
  url: string
  note?: string
}[] = [
  { name: 'Microsoft Edge', url: 'https://www.microsoft.com/edge' },
  {
    name: 'Brave',
    url: 'https://brave.com/download/',
    note: 'turn on brave://flags/#file-system-access-api',
  },
  { name: 'Arc', url: 'https://arc.net/' },
  { name: 'Opera', url: 'https://www.opera.com/' },
  { name: 'Vivaldi', url: 'https://vivaldi.com/' },
]
