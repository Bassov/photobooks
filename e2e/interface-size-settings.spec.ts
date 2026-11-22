import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'

// Designer interface-size §1 (item interface-size): Settings → Interface, the
// per-computer UI scale choice 100 / 125 / 150 % (IS1, IS2, IS4 hint).

const KEY = 'photobooks.ui.scale.v1'
const NORMAL = 'Bigger text and controls for 4K screens.'

async function storeChoice(page: Page, value: string): Promise<void> {
  await page.addInitScript(
    ([k, v]) => {
      localStorage.setItem(k, v)
    },
    [KEY, value] as const,
  )
}

async function openInterface(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(() => {
    window.__photobooksProject?.startSessionEditor()
  })
  await expect(page.getByTestId('go-library')).toBeEnabled({ timeout: 15_000 })
  await page.getByTestId('editor-settings-open').click()
  await page.getByTestId('settings-nav-interface').click()
  await expect(page.getByTestId('settings-section-title')).toHaveText(
    'Interface',
  )
}

const radio = (page: Page, pct: number): Locator =>
  page.getByTestId(`interface-size-${String(pct)}`).locator('input')

const rootZoom = (page: Page) =>
  page.evaluate(() => {
    const root = document.getElementById('root')
    if (!root) throw new Error('no #root')
    return getComputedStyle(root).zoom
  })

const stored = (page: Page) =>
  page.evaluate((k) => localStorage.getItem(k), KEY)

async function box(locator: Locator) {
  const b = await locator.boundingBox()
  if (b === null) throw new Error('not visible')
  return b
}

const sum = (p: number[]) => (p[0] ?? 0) + (p[1] ?? 0) + (p[2] ?? 0)

/** Darkest pixel of the hint text: its ink. */
async function hintInk(page: Page): Promise<number[]> {
  const hint = page.getByTestId('interface-size-hint')
  const b = await box(hint)
  const points = Array.from({ length: Math.floor(b.width) }, (_, x) =>
    Array.from({ length: Math.floor(b.height) }, (_, y) => ({ x, y })),
  ).flat()
  const px = await pixelsAt(hint, points)
  return px.reduce((a, p) => (sum(p) < sum(a) ? p : a)).slice(0, 3)
}

test.describe('1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('IS1: Interface is the 5th nav row and the section matches §1', async ({
    page,
  }, testInfo) => {
    await openInterface(page)
    const nav = page.locator('[data-testid^="settings-nav-"]')
    await expect(nav).toHaveCount(5)
    await expect(nav.nth(4)).toHaveAttribute(
      'data-testid',
      'settings-nav-interface',
    )
    await expect(nav.nth(4)).toHaveAttribute('aria-current', 'page')
    await expect(nav.nth(4).locator('svg.pb-icon')).toHaveCount(1)

    const row = await box(page.getByTestId('interface-size-row'))
    expect(row.height).toBeCloseTo(68.8, 0)
    const track = await box(page.getByTestId('interface-size'))
    expect(Math.abs(track.width - 224)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(track.height - 32)).toBeLessThanOrEqual(0.5)
    for (const pct of ['100', '125', '150']) {
      const seg = await box(page.getByTestId(`interface-size-${pct}`))
      expect(Math.abs(seg.height - 28), pct).toBeLessThanOrEqual(0.5)
      // Equal thirds of the track inside its 2 px padding and 2 px gaps.
      expect(Math.abs(seg.width - 72), pct).toBeLessThanOrEqual(0.5)
      await expect(page.getByTestId(`interface-size-${pct}`)).toHaveText(
        `${pct}%`,
      )
    }
    const hint = page.getByTestId('interface-size-hint')
    await expect(hint).toHaveText(NORMAL)
    await expect(hint).toHaveCSS('color', 'rgb(83, 81, 82)')
    const mutedInk = await hintInk(page)
    await expect(hint).toHaveCSS('font-size', '12px')
    await expect(hint).toHaveCSS('line-height', '16.8px')
    expect(Math.abs((await box(hint)).height - 16.8)).toBeLessThanOrEqual(0.5)
    await expect(page.getByTestId('interface-size')).toHaveAttribute(
      'aria-labelledby',
      'interface-size-label',
    )
    await expect(page.locator('#interface-size-label')).toHaveText(
      'Interface size',
    )
    await expect(radio(page, 100)).toBeChecked()

    // Paint: the selected pill is the raised #E3E1DD on the #D8D6D2 track (P10).
    const seg = page.getByTestId('interface-size-100')
    const [pill, rest] = await pixelsAt(page.getByTestId('interface-size'), [
      { x: 6, y: 16 },
      { x: 224 - 8, y: 16 },
    ])
    expect(pill?.slice(0, 3)).toEqual([227, 225, 221])
    expect(rest?.slice(0, 3)).toEqual([216, 214, 210])
    expect(await seg.evaluate((el) => getComputedStyle(el).color)).toBe(
      'rgb(57, 55, 56)',
    )
    await page
      .getByTestId('interface-settings')
      .screenshot({ path: testInfo.outputPath('interface-100.png') })

    // Clamped: 150 stays chosen, the hint switches to foreground ink.
    await radio(page, 150).click()
    await expect(hint).toHaveText('Window too small for 150%: showing 100%.')
    await expect(radio(page, 150)).toBeChecked()
    await expect(radio(page, 150)).toBeFocused()
    // Foreground #393738, painted darker than the muted #535152 hint (text
    // edges are antialiased, so compare the darkest pixels).
    await expect(hint).toHaveCSS('color', 'rgb(57, 55, 56)')
    const clampedInk = await hintInk(page)
    expect(sum(clampedInk)).toBeLessThan(sum(mutedInk) - 30)
    expect(await rootZoom(page)).toBe('1')
    await page
      .getByTestId('interface-settings')
      .screenshot({ path: testInfo.outputPath('interface-clamped.png') })
  })

  test('IS4: 125 clamps to 100; widening restores it without a write', async ({
    page,
  }) => {
    await openInterface(page)
    await radio(page, 125).click()
    const hint = page.getByTestId('interface-size-hint')
    await expect(hint).toHaveText('Window too small for 125%: showing 100%.')
    expect(await stored(page)).toBe('125')
    await page.evaluate((k) => {
      const w = window as unknown as { scaleWrites: number }
      w.scaleWrites = 0
      const set = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem')
        ?.value as (this: Storage, key: string, value: string) => void
      Storage.prototype.setItem = function (
        this: Storage,
        key: string,
        value: string,
      ) {
        if (key === k) w.scaleWrites += 1
        set.call(this, key, value)
      }
    }, KEY)

    await page.setViewportSize({ width: 1920, height: 1080 })
    await expect(hint).toHaveText(NORMAL)
    await expect(page.locator('html')).toHaveAttribute('data-ui-scale', '125')
    expect(await rootZoom(page)).toBe('1.25')
    await expect(radio(page, 125)).toBeChecked()
    expect(
      await page.evaluate(
        () => (window as unknown as { scaleWrites: number }).scaleWrites,
      ),
    ).toBe(0)
    expect(await stored(page)).toBe('125')
  })
})

test('narrow main (< 704): the label takes its own line', async ({ page }) => {
  // 900 wide: main = 900 − 220 nav − 64 padding = 616 px of content.
  await page.setViewportSize({ width: 900, height: 800 })
  await openInterface(page)
  const label = await box(page.locator('#interface-size-label'))
  const track = await box(page.getByTestId('interface-size'))
  const row = await box(page.getByTestId('interface-size-row'))
  expect(Math.abs(label.width - (row.width - 32))).toBeLessThanOrEqual(0.5)
  expect(track.y - (label.y + label.height)).toBeCloseTo(6, 0)
  expect(Math.abs(track.x - label.x)).toBeLessThanOrEqual(0.5)
})

test('IS4: 1920×970 with 150 shows 125 and says so', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 970 })
  await storeChoice(page, '150')
  await openInterface(page)
  await expect(radio(page, 150)).toBeChecked()
  await expect(page.getByTestId('interface-size-hint')).toHaveText(
    'Window too small for 150%: showing 125%.',
  )
  expect(await rootZoom(page)).toBe('1.25')
})

test.describe('1920×1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } })

  test('IS2: a press or arrow applies at once, keeps focus, persists and reloads', async ({
    page,
  }) => {
    await openInterface(page)
    const scroll = page.getByTestId('settings-scroll')
    const top = await scroll.evaluate((el) => el.scrollTop)
    await radio(page, 125).click()
    await expect(page.locator('html')).toHaveAttribute('data-ui-scale', '125')
    expect(await rootZoom(page)).toBe('1.25')
    expect(await stored(page)).toBe('125')
    await expect(radio(page, 125)).toBeFocused()
    await expect(page.getByTestId('interface-size-hint')).toHaveText(NORMAL)

    await page.keyboard.press('ArrowRight')
    await expect(radio(page, 150)).toBeChecked()
    await expect(radio(page, 150)).toBeFocused()
    await expect(page.locator('html')).toHaveAttribute('data-ui-scale', '150')
    expect(await stored(page)).toBe('150')
    expect(await scroll.evaluate((el) => el.scrollTop)).toBe(top)
    // No Save, no toast: the section has no button and nothing is announced.
    await expect(
      page.getByTestId('settings-scroll').getByRole('button'),
    ).toHaveCount(0)
    await expect(page.locator('[data-testid^="toast"]')).toHaveCount(0)
    // No page-level scroll: overflow stays inside settings-scroll.
    const doc = await page.evaluate(() => ({
      sh: document.documentElement.scrollHeight,
      sw: document.documentElement.scrollWidth,
      ih: window.innerHeight,
      iw: window.innerWidth,
    }))
    expect({ h: doc.sh, w: doc.sw }).toEqual({ h: doc.ih, w: doc.iw })

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-ui-scale', '150')
    await openInterface(page)
    await expect(radio(page, 150)).toBeChecked()
  })

  test('IS2: a second tab follows the choice', async ({ page, context }) => {
    await openInterface(page)
    const other = await context.newPage()
    await openInterface(other)
    await expect(radio(other, 100)).toBeChecked()

    await radio(page, 125).click()
    await expect(radio(other, 125)).toBeChecked()
    await expect(other.locator('html')).toHaveAttribute('data-ui-scale', '125')
    await other.close()
  })

  test('IS2: an invalid stored value reads as 100', async ({ page }) => {
    await storeChoice(page, '175')
    await openInterface(page)
    await expect(radio(page, 100)).toBeChecked()
    await expect(page.locator('html')).toHaveAttribute('data-ui-scale', '100')
    expect(await rootZoom(page)).toBe('1')
  })
})

// Round 34 Must M133 (item design-r34-is-prod): the segmented keyboard focus
// ring is the kit's 2 px #3A3839 (--ring) with a 2 px offset, at any scale.
for (const [w, h, pct] of [
  [1440, 900, '100'],
  [3840, 2160, '150'],
] as const) {
  test(`M133: segmented focus ring is 2 px rgb(58,56,57), offset 2, at ${pct} %`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: w, height: h })
    await storeChoice(page, pct)
    await openInterface(page)
    await expect(page.locator('html')).toHaveAttribute('data-ui-scale', pct)
    const input = radio(page, Number(pct))
    // Keyboard modality, then focus: :focus-visible as after a Tab.
    await page.keyboard.press('Shift')
    await input.focus()
    expect(await input.evaluate((el) => el.matches(':focus-visible'))).toBe(
      true,
    )
    const seg = page.getByTestId(`interface-size-${pct}`)
    const ring = await seg.evaluate((el) => {
      const cs = getComputedStyle(el)
      return [
        cs.outlineColor,
        cs.outlineWidth,
        cs.outlineOffset,
        cs.outlineStyle,
      ]
    })
    expect(ring).toEqual(['rgb(58, 56, 57)', '2px', '2px', 'solid'])

    // Paint: 3 app px above the segment (offset 2 + half the 2 px ring) the
    // row shows the ring ink.
    const s = Number(pct) / 100
    const rowBox = page.getByTestId('interface-size-row')
    const [r, b] = [await box(rowBox), await box(seg)]
    const [px] = await pixelsAt(rowBox, [
      { x: b.x - r.x + b.width / 2, y: b.y - r.y - 3 * s },
    ])
    for (const [i, want] of [58, 56, 57].entries()) {
      expect(
        Math.abs((px?.[i] ?? 0) - want),
        `ring rgb[${String(i)}]`,
      ).toBeLessThanOrEqual(3)
    }
  })
}
