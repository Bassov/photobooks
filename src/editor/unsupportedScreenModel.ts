import type {
  BrowserSupportSnapshot,
  UnsupportedVariant,
} from './browserSupport'

export type UnsupportedIconName =
  'shieldOff' | 'monitorSmartphone' | 'appWindow'

export interface UnsupportedScreenModel {
  variant: UnsupportedVariant
  browserName: string
  title: string
  icon: UnsupportedIconName
  chromeOutline: boolean
  showReload: boolean
  showBrowserList: boolean
  showCopyInActions: boolean
  showMobileLayout: boolean
}

export function unsupportedIcon(
  variant: UnsupportedVariant,
): UnsupportedIconName {
  if (variant === 'no-api') {
    return 'shieldOff'
  }
  if (variant === 'mobile') {
    return 'monitorSmartphone'
  }
  return 'appWindow'
}

export function unsupportedTitle(variant: UnsupportedVariant): string {
  if (variant === 'no-api') {
    return 'Folder access is turned off in this browser'
  }
  if (variant === 'mobile') {
    return 'Photobooks needs a desktop computer'
  }
  return 'This browser isn’t supported'
}

export function resolveUnsupportedScreen(
  support: BrowserSupportSnapshot,
): UnsupportedScreenModel {
  const variant: UnsupportedVariant = support.variant ?? 'other'
  const browserName =
    support.browserName !== undefined && support.browserName.length > 0
      ? support.browserName
      : 'this browser'
  return {
    variant,
    browserName,
    title: unsupportedTitle(variant),
    icon: unsupportedIcon(variant),
    chromeOutline: variant === 'no-api',
    showReload: variant === 'no-api',
    showBrowserList: variant === 'other',
    showCopyInActions: variant === 'other',
    showMobileLayout: variant === 'mobile',
  }
}
