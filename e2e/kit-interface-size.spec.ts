import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { topAt } from './fixtures/paintProbe'

// interface-size-kit: kit Settings → Interface (Designer spec interface-size
// §1, D4 clamp, D8 one row). IS1 kit side (values at 1440×900), IS4 kit side
// (clamp against the stage, 1280×720 minimum app), IS10 (100 % = no zoom).

const KIT = '/uikit/#/full/site-settings'

const near = (a: number, b: number, d = 0.5) => {
  expect(Math.abs(a - b), `${String(a)} ≈ ${String(b)}`).toBeLessThanOrEqual(d)
}

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

const css = (l: Locator, prop: string) =>
  l.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop)

async function scenario(page: Page, name: string) {
  await page.goto(KIT)
  await page
    .getByTestId('scenarios')
    .getByRole('tab', { name, exact: true })
    .click()
  await expect(page.getByTestId('interface-settings')).toBeVisible()
}

const group = (page: Page) =>
  page.getByRole('radiogroup', { name: 'Interface size' })
const seg = (page: Page, v: number) =>
  group(page).getByRole('radio', { name: `${String(v)}%`, exact: true })
const hint = (page: Page) => page.getByTestId('interface-size-hint')

test.describe('1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('IS1: Interface is the 5th nav row; one row with §1 values, old stub rows gone', async ({
    page,
  }) => {
    await scenario(page, 'Interface')
    const nav = page.locator('[data-testid^="settings-nav-"]')
    await expect(nav).toHaveCount(5)
    await expect(nav.nth(4)).toHaveAttribute(
      'data-testid',
      'settings-nav-interface',
    )
    await expect(nav.nth(4)).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('[data-scenario] h1')).toHaveText('Interface')
    await expect(page.locator('[data-scenario]')).toContainText(
      'How big Photobooks looks on this screen. Saved for this computer.',
    )
    for (const old of ['Units', 'Millimetres', 'Thumbnail size', 'Density'])
      await expect(page.locator('[data-scenario]')).not.toContainText(old)

    near((await box(page.getByTestId('interface-size-row'))).height, 68.8)
    await expect(page.locator('#interface-size-label')).toHaveText(
      'Interface size',
    )
    near((await box(page.locator('#interface-size-label'))).width, 160)
    const track = await box(group(page))
    near(track.width, 224)
    near(track.height, 32)
    const labels = await group(page).getByRole('radio').allInnerTexts()
    expect(labels).toEqual(['100%', '125%', '150%'])
    for (const v of [100, 125, 150]) {
      const b = await box(seg(page, v))
      near(b.height, 28)
      near(b.width, (224 - 4 - 4) / 3)
    }
    await expect(seg(page, 100)).toHaveAttribute('aria-checked', 'true')

    await expect(hint(page)).toHaveText(
      'Bigger text and controls for 4K screens.',
    )
    expect(await css(hint(page), 'font-size')).toBe('12px')
    expect(await css(hint(page), 'line-height')).toBe('16.8px')
    await expect(hint(page)).toHaveAttribute('aria-live', 'polite')

    // IS10: at 100 % the stage has no zoom
    expect(await css(page.getByTestId('demo-root'), 'zoom')).toBe('1')
  })

  test('IS4: 150 % on the 1440×900 stage clamps to 100 %: hint shown, zoom stays 1, focus kept', async ({
    page,
  }) => {
    await scenario(page, 'Interface')
    await seg(page, 150).click()
    await expect(seg(page, 150)).toHaveAttribute('aria-checked', 'true')
    await expect(seg(page, 150)).toBeFocused()
    await expect(hint(page)).toHaveText(
      'Window too small for 150%: showing 100%.',
    )
    // the hint is painted on top (nothing covers it) in the foreground ink
    expect((await topAt(hint(page)))[0]).toContain('interface-size-hint')
    expect(await css(hint(page), 'color')).toBe(
      await css(page.locator('[data-scenario] h1'), 'color'),
    )
    expect(await css(page.getByTestId('demo-root'), 'zoom')).toBe('1')
    near((await box(page.getByTestId('interface-size-row'))).height, 68.8)

    await seg(page, 125).click()
    await expect(hint(page)).toHaveText(
      'Window too small for 125%: showing 100%.',
    )
    await seg(page, 100).click()
    await expect(hint(page)).toHaveText(
      'Bigger text and controls for 4K screens.',
    )
  })

  test('scenarios: Window too small seeds 150 %, Size focused shows the focus ring on 125 %', async ({
    page,
  }) => {
    await scenario(page, 'Window too small')
    await expect(seg(page, 150)).toHaveAttribute('aria-checked', 'true')
    await expect(hint(page)).toHaveText(
      'Window too small for 150%: showing 100%.',
    )
    expect(await css(page.getByTestId('demo-root'), 'zoom')).toBe('1')

    await scenario(page, 'Size focused')
    await expect(seg(page, 125)).toBeFocused()
    await expect(seg(page, 125)).toHaveAttribute('data-focus-visible', 'true')
    await expect(seg(page, 100)).toHaveAttribute('aria-checked', 'true')
  })

  test('#/demo: Settings → Interface shows the one row; no zoom at 100 %', async ({
    page,
  }) => {
    await page.goto('/uikit/#/demo')
    await page.evaluate(() => {
      ;(window as unknown as { __demo: { go: (s: string) => void } }).__demo.go(
        'settings',
      )
    })
    await page.getByTestId('settings-nav-interface').click()
    await expect(page.getByTestId('interface-size-row')).toHaveCount(1)
    await expect(seg(page, 100)).toHaveAttribute('aria-checked', 'true')
    expect(await css(page.getByTestId('demo'), 'zoom')).toBe('1')
  })
})

test.describe('1920×1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } })

  test('IS4: 125 % on a wider stage zooms demo-root 1.25 and the stage still fits', async ({
    page,
  }) => {
    await scenario(page, 'Interface')
    const root = page.getByTestId('demo-root')
    const stage = await box(root.locator('..'))
    await seg(page, 125).click()
    await expect.poll(() => css(root, 'zoom')).toBe('1.25')
    await expect(seg(page, 125)).toBeFocused()
    await expect(hint(page)).toHaveText(
      'Bigger text and controls for 4K screens.',
    )
    const r = await box(root)
    near(r.width, stage.width)
    near(r.height, stage.height)
    // the row is the 100 % row × 1.25 on screen
    near((await box(page.getByTestId('interface-size-row'))).height, 86)

    // 150 % would leave a 900 px tall stage under 720: clamps to 125 %
    await seg(page, 150).click()
    await expect(hint(page)).toHaveText(
      'Window too small for 150%: showing 125%.',
    )
    expect(await css(root, 'zoom')).toBe('1.25')
  })

  test('#/demo: 125 % zooms the window-sized demo without page scroll', async ({
    page,
  }) => {
    await page.goto('/uikit/#/demo')
    await page.evaluate(() => {
      ;(window as unknown as { __demo: { go: (s: string) => void } }).__demo.go(
        'settings',
      )
    })
    await page.getByTestId('settings-nav-interface').click()
    await seg(page, 125).click()
    const demo = page.getByTestId('demo')
    await expect.poll(() => css(demo, 'zoom')).toBe('1.25')
    const b = await box(demo)
    near(b.width, 1920)
    near(b.height, 1080)
    const scroll = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight,
    ])
    expect(scroll).toEqual([1920, 1080])
    // leave #/demo at 100 % (the session survives in memory)
    await seg(page, 100).click()
  })
})
