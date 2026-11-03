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
  /** Best-effort label for “other” copy (UA brands, else the UA string). */
  browserName?: string
}

type NavigatorWithUAData = Partial<Navigator> & {
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

/** Name from the UA string when there are no UA brands (Firefox, Safari). */
export function uaBrowserName(ua: string): string | undefined {
  if (ua.includes('Firefox/')) {
    return 'Firefox'
  }
  if (
    /Version\/[\d.]+.*Safari\//.test(ua) &&
    !/Chrome|Chromium|CriOS|Edg/.test(ua)
  ) {
    return 'Safari'
  }
  return undefined
}

/** Phones and tablets, incl. iPadOS, which sends a desktop Macintosh UA. */
function isMobileDevice(nav: NavigatorWithUAData): boolean {
  const ua = nav.userAgent ?? ''
  return (
    nav.userAgentData?.mobile === true ||
    /iPhone|iPad|iPod|Android/i.test(ua) ||
    (ua.includes('Macintosh') && (nav.maxTouchPoints ?? 0) > 1)
  )
}

function readBrandMeta(nav: NavigatorWithUAData | undefined): {
  mobile: boolean
  isChromium: boolean
  browserName: string | undefined
} {
  const brands = nav?.userAgentData?.brands ?? []
  const { isChromium, browserName } = pickBrowserName(brands)
  return {
    mobile: nav !== undefined && isMobileDevice(nav),
    isChromium,
    browserName: browserName ?? uaBrowserName(nav?.userAgent ?? ''),
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
  const label =
    browserName !== undefined && browserName !== '' ? browserName : undefined
  if (variant === 'other') {
    snap.browserName = label ?? 'this browser'
  } else if (label !== undefined) {
    snap.browserName = label
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

  if (mobile) {
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
  /** Flag that turns File System Access on (shown as a note under the list). */
  flag?: string
}[] = [
  { name: 'Microsoft Edge', url: 'https://www.microsoft.com/edge' },
  {
    name: 'Brave',
    url: 'https://brave.com/download/',
    flag: 'brave://flags/#file-system-access-api',
  },
  { name: 'Arc', url: 'https://arc.net/' },
  { name: 'Opera', url: 'https://www.opera.com/' },
  { name: 'Vivaldi', url: 'https://vivaldi.com/' },
]
