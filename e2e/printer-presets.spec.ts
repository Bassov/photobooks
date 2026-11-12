import type { Locator, Page, TestInfo } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { dispatchCtrlWheel } from './fixtures/dispatchCtrlWheel'
import { pixelsAt, topAt } from './fixtures/paintProbe'
import {
  browserAssertNoLoaf,
  browserBeginLoafScenarioWindow,
  browserStartLoafScripts,
  browserTakeLoafScripts,
  clearPerfScenario,
  collectFrameStatsArtifact,
  enablePerfScenario,
} from './perf/perfFixture'
import { PERF_BUDGETS } from './perf/budgets'

// Designer printer-presets (prod UI). `&printProfiles=kit` adds the kit's
// "Photo book 300 ppi" custom; `&px=4000` gives every painter photo a
// 4000 × 3000 source: ≥ 200 ppi on a 30 cm page (Generic), < 300 ppi (the
// custom), so picking the custom flips the filmstrip Low-res marks.
const PAINTER = '/?fixture=painter&printProfiles=kit&px=4000'
const SAMPLE = 'custom-kit-sample'

// Kit #/full/site-settings "Print presets" and "Invalid values", 1440 × 900
// stage. The kit lists four print shops; prod's catalog has Generic only, so
// the Custom eyebrow sits the same 32.58 px under the shops card.
const KIT = {
  title: 72,
  navPrint: { x: 12, w: 195, h: 34.84 },
  defaultSelect: { x: 636, y: 179.44, w: 240, h: 32 },
  shopsEyebrow: 254.02,
  shops: { x: 252, y: 285.44, w: 640 },
  shopRow: 52,
  duplicate: { x: 794, y: 295.44, w: 82 },
  customUnderShops: 32.58,
  dialog: { w: 560, h: 720.86, sub: 50.25, form: 85.09 },
  save: { x: 474, y: 664.86, w: 62, h: 36 },
  // Kit #/full/inspector "Book settings" / "Lulu picked": offsets in PRINT.
  print: { select: 26.85, hint: 64.85, fields: 92.85, defaults: 195.69 },
  issueGap: 8,
  fieldsUnderIssue: 12,
}

async function box(locator: Locator) {
  const b = await locator.boundingBox()
  if (b === null) throw new Error('not visible')
  return b
}

function near(actual: number, kit: number, what: string) {
  expect(
    Math.abs(actual - kit),
    `${what} ${String(actual)} vs kit ${String(kit)}`,
  ).toBeLessThanOrEqual(0.5)
}

async function openEditor(page: Page, url = PAINTER): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(url)
  await expect(page.getByTestId('spread-view').first()).toBeVisible()
}

async function openPrintPresets(page: Page): Promise<void> {
  await page.getByTestId('editor-settings-open').click()
  await page.getByTestId('settings-nav-print').click()
  await expect(page.locator('h1')).toHaveText('Print presets')
}

async function openBookSettings(page: Page): Promise<Locator> {
  const printer = page.getByTestId('book-print-profile')
  await expect(async () => {
    await page.getByTestId('book-title').last().click()
    await expect(printer).toBeVisible({ timeout: 1_000 })
  }).toPass()
  return printer
}

const lowRes = (page: Page) => page.locator('.filmstrip-lowres-label')

test('Settings → Print presets matches the kit', async ({ page }) => {
  await openEditor(page)
  await openPrintPresets(page)

  const nav = await box(page.getByTestId('settings-nav-print'))
  near(nav.x, KIT.navPrint.x, 'nav x')
  near(nav.width, KIT.navPrint.w, 'nav w')
  near(nav.height, KIT.navPrint.h, 'nav h')
  await expect(page.getByTestId('settings-nav-print')).toHaveAttribute(
    'aria-current',
    'page',
  )
  near((await box(page.locator('h1'))).y, KIT.title, 'title')
  const select = await box(page.getByTestId('print-default'))
  near(select.x, KIT.defaultSelect.x, 'default x')
  near(select.y, KIT.defaultSelect.y, 'default y')
  near(select.width, KIT.defaultSelect.w, 'default w')
  near(select.height, KIT.defaultSelect.h, 'default h')
  const eyebrows = page.locator('h2', { hasText: /^(Print shops|Custom)$/ })
  near((await box(eyebrows.nth(0))).y, KIT.shopsEyebrow, 'shops eyebrow')
  const shops = await box(page.getByTestId('print-shops'))
  near(shops.x, KIT.shops.x, 'shops x')
  near(shops.y, KIT.shops.y, 'shops y')
  near(shops.width, KIT.shops.w, 'shops w')
  near(
    (await box(page.getByTestId('print-shop-generic'))).height,
    KIT.shopRow,
    'shop row',
  )
  const duplicate = await box(page.getByTestId('print-duplicate-generic'))
  near(duplicate.x, KIT.duplicate.x, 'duplicate x')
  near(duplicate.y, KIT.duplicate.y, 'duplicate y')
  near(duplicate.width, KIT.duplicate.w, 'duplicate w')
  near(
    (await box(eyebrows.nth(1))).y - (shops.y + shops.height),
    KIT.customUnderShops,
    'custom eyebrow',
  )
  await expect(
    page
      .getByTestId(`print-custom-${SAMPLE}`)
      .getByTestId('print-summary-line'),
  ).toHaveText(
    '15.2–30.5 cm · bleed 5 mm · safe 15 mm · 24–240 pages · photos ≥ 300 ppi',
  )
})

test('the profile editor matches the kit and paints its errors', async ({
  page,
}) => {
  await openEditor(page)
  await openPrintPresets(page)
  await page.getByTestId('print-new').click()
  const form = page.getByTestId('print-profile-dialog')
  // Kit "Invalid values": name "", sides 300 / 200, Most pages 121.
  await form.getByLabel('Name').fill('')
  await form.getByLabel('Smallest page side').fill('300')
  await form.getByLabel('Largest page side').fill('200')
  await form.getByLabel('Most pages').fill('121')

  const dialog = await box(page.getByRole('dialog'))
  near(dialog.width, KIT.dialog.w, 'dialog w')
  near(dialog.height, KIT.dialog.h, 'dialog h')
  near(
    (await box(page.getByTestId('pp-sub'))).y - dialog.y,
    KIT.dialog.sub,
    'sub',
  )
  near(
    (await box(page.getByTestId('pp-form'))).y - dialog.y,
    KIT.dialog.form,
    'form',
  )
  const save = await box(page.getByTestId('pp-save'))
  near(save.x - dialog.x, KIT.save.x, 'save x')
  near(save.y - dialog.y, KIT.save.y, 'save y')
  near(save.width, KIT.save.w, 'save w')
  near(save.height, KIT.save.h, 'save h')
  await expect(page.getByTestId('pp-save')).toBeDisabled()

  const errors = page.getByTestId('pp-error')
  await expect(errors).toHaveCount(3)
  for (const error of await errors.all()) {
    const [top] = await topAt(error)
    expect(top).toContain('pp-error')
    await expect(error).toHaveCSS('color', 'rgb(168, 64, 58)')
  }
})

const grey = (px: number[] | undefined) => px?.[0] ?? -1

// Designer printer-presets round 21 (M99–M101), kit #/demo Settings → Print
// presets: action hover #CFCFCF, the destructive AlertDialog, a ringless badge.
test('row actions, the Default badge and the delete confirm paint like the kit', async ({
  page,
}) => {
  await openEditor(page)
  await openPrintPresets(page)

  // M101: the kit badge has no inset ring, so its edge is the tint (211).
  const badge = page.getByTestId('print-shops').getByText('Default')
  const b = await box(badge)
  const [edge, inner] = await pixelsAt(badge, [
    { x: 0, y: b.height / 2 },
    { x: 3, y: b.height / 2 },
  ])
  expect(Math.abs(grey(edge) - 211), `edge ${String(edge)}`).toBeLessThan(4)
  expect(Math.abs(grey(edge) - grey(inner))).toBeLessThanOrEqual(1)

  // M99: Duplicate / New profile / Edit… go from --field 215 to #CFCFCF.
  for (const id of [
    'print-duplicate-generic',
    'print-new',
    `print-edit-${SAMPLE}`,
  ]) {
    const button = page.getByTestId(id)
    const h = (await box(button)).height
    expect(grey((await pixelsAt(button, [{ x: 4, y: h / 2 }]))[0])).toBe(215)
    await button.hover()
    await expect(async () => {
      const [px] = await pixelsAt(button, [{ x: 4, y: h / 2 }])
      expect(grey(px), id).toBe(207)
    }).toPass()
  }
  await page.mouse.move(0, 0)

  // M100: the kit destructive AlertDialog — trash tile, Lora 21, md buttons.
  await page.getByTestId(`print-more-${SAMPLE}`).click()
  await page.getByRole('menuitem', { name: 'Delete…' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm.locator('svg[data-icon="delete"]')).toHaveCount(1)
  const tile = confirm.locator('.pb-alert-dialog-head > span')
  near((await box(tile)).width, 40, 'tile')
  const [tileBg, dialogBg] = await pixelsAt(confirm, [
    { x: 24 + 4, y: 24 + 20 },
    { x: 12, y: 12 },
  ])
  expect(grey(tileBg), 'tile paints over the dialog').toBeLessThan(
    grey(dialogBg) - 4,
  )
  await expect(confirm.getByRole('heading')).toHaveCSS('font-size', '21px')
  for (const name of ['Cancel', 'Delete']) {
    const button = confirm.getByRole('button', { name })
    near((await box(button)).height, 36, `${name} h`)
    await expect(button).toHaveCSS('padding', '0px 16px')
  }
  near((await box(confirm)).width, 420, 'confirm w')

  // Round 23: kit destructive = shadow-xs at rest and hover, none pressed;
  // the ghost Cancel stays unboxed.
  const del = confirm.getByRole('button', { name: 'Delete' })
  const cancel = confirm.getByRole('button', { name: 'Cancel' })
  const XS = 'rgba(20, 20, 19, 0.06) 0px 1px 2px 0px'
  await expect(del).toHaveCSS('box-shadow', XS)
  await expect(cancel).toHaveCSS('box-shadow', 'none')
  const [d, c] = [await box(del), await box(confirm)]
  const [under, below] = await pixelsAt(confirm, [
    { x: d.x - c.x + d.width / 2, y: d.y - c.y + d.height + 1 },
    { x: d.x - c.x + d.width / 2, y: d.y - c.y + d.height + 6 },
  ])
  expect(grey(under), 'shadow row under Delete').toBeLessThan(grey(below))
  await del.hover()
  await expect(del).toHaveCSS('box-shadow', XS)
  await page.mouse.down()
  await expect(del).toHaveAttribute('data-pressed', 'true')
  await expect(del).toHaveCSS('box-shadow', 'none')
  await page.mouse.up()
})

test('a custom profile drives Book settings; picking it is one undo step', async ({
  page,
}) => {
  await openEditor(page)
  await openPrintPresets(page)
  await page.getByTestId('print-duplicate-generic').click()
  const form = page.getByTestId('print-profile-dialog')
  await form.getByLabel('Fewest pages').fill('100')
  await form.getByLabel('Most pages').fill('120')
  await page.getByTestId('pp-save').click()
  await expect(page.getByTestId('print-profile-dialog')).toHaveCount(0)
  await expect(page.getByTestId('print-custom')).toContainText('Generic (copy)')
  await page.getByTestId('editor-settings-back').click()

  const printer = await openBookSettings(page)
  await expect(printer).toHaveValue('generic')
  const hint = page.getByTestId('book-print-hint')
  await expect(hint).toHaveText('5–50 cm · 20–120 pages · photos ≥ 200 ppi')
  const id = await printer
    .locator('option', { hasText: 'Generic (copy)' })
    .getAttribute('value')
  await printer.selectOption(id ?? '')
  await expect(hint).toHaveText('5–50 cm · 100–120 pages · photos ≥ 200 ppi')

  const issue = page.getByTestId('book-print-issue')
  await expect(issue).toHaveCount(1)
  await expect(issue).toHaveText(
    /^Generic \(copy\) prints at least 100 pages; this book’s \d+ print as 100\.$/,
  )
  await issue.scrollIntoViewIfNeeded()
  const [top] = await topAt(issue)
  expect(top).toContain('book-print-issue')
  await expect(issue).toHaveCSS('color', 'rgb(138, 90, 18)')

  // Kit "Lulu picked": the warnings sit 8 px apart under the hint, B / S 12.
  const print = await box(page.locator('h3', { hasText: /^Print$/ }))
  near((await box(printer)).y - print.y, KIT.print.select, 'printer')
  near((await box(hint)).y - print.y, KIT.print.hint, 'hint')
  const hintBox = await box(hint)
  const issueBox = await box(issue)
  near(issueBox.y - (hintBox.y + hintBox.height), KIT.issueGap, 'issue gap')
  near(
    (await box(page.getByTestId('book-bleed'))).y -
      (issueBox.y + issueBox.height),
    KIT.fieldsUnderIssue,
    'fields under issue',
  )

  const undo = page.getByTestId('undo')
  await expect(undo).toHaveAttribute('aria-label', 'Undo “Printer” (Ctrl+Z)')
  await undo.click()
  await expect(printer).toHaveValue('generic')
  await expect(issue).toHaveCount(0)
  await expect(page.getByTestId('redo')).toHaveAttribute(
    'aria-label',
    'Redo “Printer” (Shift+Ctrl+Z)',
  )
  near(
    (await box(page.getByTestId('book-bleed'))).y - print.y,
    KIT.print.fields,
    'fields',
  )
  near(
    (await box(page.locator('h3', { hasText: /^Defaults$/ }))).y - print.y,
    KIT.print.defaults,
    'defaults',
  )
})

test('picking a 300 ppi printer marks low-res photos; undo clears them', async ({
  page,
}) => {
  await openEditor(page)
  const printer = await openBookSettings(page)
  await expect(lowRes(page)).toHaveCount(0)
  await printer.selectOption(SAMPLE)
  await expect(page.getByTestId('book-print-hint')).toHaveText(
    '15.2–30.5 cm · 24–240 pages · photos ≥ 300 ppi',
  )
  await expect(lowRes(page).first()).toBeVisible()
  await page.getByTestId('undo').click()
  await expect(printer).toHaveValue('generic')
  await expect(lowRes(page)).toHaveCount(0)
})

test.describe('frame-budget gates', () => {
  test('print-profile-switch: picking a printer over 40 spreads stays within budget', async ({
    page,
  }, testInfo) => {
    await printProfileSwitchGate(page, testInfo)
  })
})

/** Two settled frames after the edit's own work. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve()
          })
        })
      }),
  )
}

/** Run `edit` in a fresh LoAF window; assert zero LoAF and the INP budget. */
async function gateWindow(
  page: Page,
  label: string,
  edit: () => Promise<void>,
): Promise<void> {
  await clearPerfScenario(page)
  await page.evaluate(browserStartLoafScripts)
  await page.evaluate(browserBeginLoafScenarioWindow)
  await edit()
  await settle(page)
  const rows = await page.evaluate(browserTakeLoafScripts)
  const longest = Math.max(0, ...rows.map((row) => row.blocking))
  const inpMs = await page.evaluate(() => {
    const perf = window.__photobooksPerf
    perf?.flushEventTimingEntries()
    return perf?.getInpMs() ?? null
  })
  console.log(
    `print-profile-switch ${label}: ${String(rows.length)} LoAF, longest blocking ${String(longest)} ms, INP ${String(inpMs)} ms ${JSON.stringify(rows)}`,
  )
  await page.evaluate(browserAssertNoLoaf, PERF_BUDGETS.loafEntriesMax)
  await page.evaluate((budgetMs) => {
    window.__photobooksPerf?.assertInpWithinBudget(budgetMs)
  }, PERF_BUDGETS.inpMs * PERF_BUDGETS.cpuThrottleRate)
}

/**
 * All 40 spreads mounted, Book settings open: pick the 300 ppi custom (every
 * spread re-resolves its low-res gates, the filmstrip re-marks), then Generic
 * back, each in its own window.
 */
async function printProfileSwitchGate(
  page: Page,
  testInfo: TestInfo,
): Promise<void> {
  test.setTimeout(120_000)
  await enablePerfScenario(page, `${PAINTER}&perf=1`)
  await expect(page.getByTestId('spread-view').first()).toBeVisible()
  await dispatchCtrlWheel(page, 500, 24)
  await expect(page.getByTestId('pasteboard-slot')).toHaveCount(40)
  await expect
    .poll(async () =>
      page.getByTestId('pasteboard-world').getAttribute('data-gesture'),
    )
    .toBeNull()
  const printer = await openBookSettings(page)

  // A key on the closed select picks the next option: a real input for INP.
  await printer.focus()
  await gateWindow(page, 'pick 300 ppi', async () => {
    await page.keyboard.press('ArrowDown')
    await expect(printer).toHaveValue(SAMPLE)
    await expect(lowRes(page).first()).toBeVisible()
  })
  await gateWindow(page, 'pick Generic', async () => {
    await page.keyboard.press('ArrowUp')
    await expect(printer).toHaveValue('generic')
    await expect(lowRes(page)).toHaveCount(0)
  })
  await collectFrameStatsArtifact(page, testInfo)
}
