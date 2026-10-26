import { describe, expect, it } from 'vitest'

import {
  resolveUnsupportedScreen,
  unsupportedIcon,
  unsupportedTitle,
} from './unsupportedScreenModel'

describe('unsupportedScreenModel', () => {
  it.each([
    ['no-api', 'Folder access is turned off in this browser', 'shieldOff'],
    ['mobile', 'Photobooks needs a desktop computer', 'monitorSmartphone'],
    ['other', 'This browser isn’t supported', 'appWindow'],
  ] as const)('maps %s to title and icon', (variant, title, icon) => {
    expect(unsupportedTitle(variant)).toBe(title)
    expect(unsupportedIcon(variant)).toBe(icon)
  })

  it('defaults missing variant to other with fallback browser name', () => {
    expect(
      resolveUnsupportedScreen({
        supported: false,
        reason: 'no-directory-picker',
      }),
    ).toMatchObject({
      variant: 'other',
      browserName: 'this browser',
      showBrowserList: true,
      showCopyInActions: true,
      showReload: false,
      chromeOutline: false,
      showMobileLayout: false,
    })
  })

  it('wires no-api flags for Chromium-off copy', () => {
    expect(
      resolveUnsupportedScreen({
        supported: false,
        reason: 'no-directory-picker',
        variant: 'no-api',
        browserName: 'Brave',
      }),
    ).toMatchObject({
      variant: 'no-api',
      browserName: 'Brave',
      showReload: true,
      chromeOutline: true,
      showBrowserList: false,
      showCopyInActions: false,
    })
  })

  it('wires mobile layout flags', () => {
    expect(
      resolveUnsupportedScreen({
        supported: false,
        reason: 'mobile',
        variant: 'mobile',
      }),
    ).toMatchObject({
      showMobileLayout: true,
      showBrowserList: false,
      showReload: false,
      title: 'Photobooks needs a desktop computer',
      icon: 'monitorSmartphone',
    })
  })

  it('treats empty browserName as the fallback label', () => {
    expect(
      resolveUnsupportedScreen({
        supported: false,
        reason: 'no-directory-picker',
        variant: 'other',
        browserName: '',
      }).browserName,
    ).toBe('this browser')
  })
})
