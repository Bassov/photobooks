import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { topAt } from './fixtures/paintProbe'

// interface-size-kit: kit Settings → Interface (Designer spec interface-size
// §1, D4 clamp, D8 one row). IS1 kit side (values at 1440×900), IS4 kit side
// (clamp against the stage, 1280×720 minimum app), IS10 (100 % = no zoom).

// Unhinted text: a text-sized overlay (tooltip) at 15 px is its 12 px width
// × 1.25 (hinting rounds glyph advances per size). Geometry above is fixed px.
test.use({ launchOptions: { args: ['--font-render-hinting=none'] } })

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

// IS5 kit side (spec §4 portal rule): overlays portal outside the zoomed demo
// and carry the scale themselves.
test.describe('1920×1080 overlays', () => {
  test.use({ viewport: { width: 1920, height: 1080 } })

  test('IS5 kit: overlays at 125 % = the 100 % overlays × 1.25, anchored as at 100 %', async ({
    page,
  }) => {
    const at100 = await overlayWalk(page, 100)
    const at125 = await overlayWalk(page, 125)
    const k = 1.25
    // Create book dialog (modal overlay root zoomed): size × s, still centred
    near(at125.dialog.w, at100.dialog.w * k)
    near(at125.dialog.h, at100.dialog.h * k)
    near(at125.dialog.cx, 960)
    near(at100.dialog.cx, 960)
    // Page size Select: as wide as its trigger, gap 4 · s, option rows × s
    for (const m of [at100, at125]) {
      near(m.select.w, m.select.triggerW)
      near(m.select.left, 0)
    }
    near(at125.select.gap, at100.select.gap * k)
    near(at125.select.row, at100.select.row * k)
    // editor tooltip: size × s, gap × s, centred on its trigger
    near(at125.tip.w, at100.tip.w * k)
    near(at125.tip.h, at100.tip.h * k)
    near(at125.tip.gap, at100.tip.gap * k)
    near(at125.tip.cx, 0)
    // editor toast (region zoomed): w-[320px] × s, its inset from the corner × s
    near(at100.toast.w, 320)
    for (const key of ['w', 'h', 'right', 'bottom'] as const)
      near(at125.toast[key], at100.toast[key] * k)
    // library book menu (bottom end): w-44 × s, gap × s, right edge on the trigger's as at 100 %
    near(at100.menu.w, 176)
    near(at125.menu.w, 176 * k)
    near(at125.menu.h, at100.menu.h * k)
    near(at125.menu.gap, at100.menu.gap * k)
    near(at125.menu.right, at100.menu.right)
    near(at125.menu.row, at100.menu.row * k)
  })
})

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Waits out the enter animation (it slides / scales the box), then measures. */
async function settled(l: Locator) {
  await expect(l).toBeVisible()
  await expect(l).not.toHaveAttribute('data-entering', /.*/)
  return box(l)
}

const below = (o: Rect, t: Rect) => ({
  w: o.width,
  h: o.height,
  gap: o.y - (t.y + t.height),
})

/** #/demo at `scale`: Create book dialog + its Page size Select, an editor tooltip, the library book menu. */
async function overlayWalk(page: Page, scale: 100 | 125) {
  await page.goto('/uikit/#/demo')
  await page.evaluate(() => {
    const d = (
      window as unknown as {
        __demo: { reset: () => void; go: (s: string) => void }
      }
    ).__demo
    d.reset()
    d.go('settings')
  })
  await page.getByTestId('settings-nav-interface').click()
  await seg(page, scale).click()
  await expect
    .poll(() => css(page.getByTestId('demo'), 'zoom'))
    .toBe(String(scale / 100))
  await page.evaluate(() => {
    ;(window as unknown as { __demo: { go: (s: string) => void } }).__demo.go(
      'welcome',
    )
  })
  const c = (sel: string) => page.locator(sel).first().click()
  await c('[data-testid="create-library"]')
  await c('[data-testid="picker-select"]')
  await c('[data-testid="demo"] [data-testid="new-book"]')

  const dialog = page.locator('[role=dialog]')
  // the Modal (the dialog's box: width, radius, shadow)
  const d = await settled(dialog.locator('..'))
  const trigger = dialog.getByRole('button', { name: /Page size/ })
  await trigger.click()
  const t = await box(trigger)
  const list = await settled(page.locator('[data-trigger="Select"]'))
  const select = {
    ...below(list, t),
    triggerW: t.width,
    left: list.x - t.x,
    row: (await box(page.getByRole('option').first())).height,
  }
  await page.keyboard.press('Escape')
  await expect(page.getByRole('option')).toHaveCount(0)
  await dialog.locator('input').first().fill('Lake trip')
  await c('[data-testid="create-book"]')
  await expect(dialog).toHaveCount(0)

  const tipTrigger = page.getByRole('button', { name: 'Snap', exact: true })
  const tt = await box(tipTrigger)
  await page.mouse.move(tt.x + tt.width / 2, tt.y + tt.height / 2)
  const tipBox = await settled(page.locator('[role=tooltip]'))
  const tip = {
    ...below(tipBox, tt),
    cx: tipBox.x + tipBox.width / 2 - (tt.x + tt.width / 2),
  }
  await page.mouse.move(0, 0)

  // Delete spread → toast (the region is zoomed as a whole)
  await c('[data-testid="spread-menu"]')
  await page.getByRole('menuitem', { name: /Delete/ }).click()
  const toastBox = await settled(page.getByRole('alertdialog'))
  const toast = {
    w: toastBox.width,
    h: toastBox.height,
    right: 1920 - (toastBox.x + toastBox.width),
    bottom: 1080 - (toastBox.y + toastBox.height),
  }
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Close' })
    .click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)

  await c('[data-testid="editor-library"]')
  const menuTrigger = page
    .locator('[data-testid="demo"] [data-testid="book-menu"]')
    .first()
  await menuTrigger.click()
  const mt = await box(menuTrigger)
  const pop = await settled(page.locator('[data-trigger="MenuTrigger"]'))
  const menu = {
    ...below(pop, mt),
    right: pop.x + pop.width - (mt.x + mt.width),
    row: (await box(page.getByRole('menuitem').first())).height,
  }
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menuitem')).toHaveCount(0)
  return {
    dialog: { w: d.width, h: d.height, cx: d.x + d.width / 2 },
    select,
    tip,
    toast,
    menu,
  }
}
