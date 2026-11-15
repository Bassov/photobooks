import type { Locator, Page } from '@playwright/test'
import { routeCloudflare, TOKEN } from './fixtures/cloudflareRelay'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'

// Designer parity connect-own-hosting (M114, M115, M117, M120) at 1440×900:
// the setup card top, the manual help position, the xs ghost Change / CORS
// Copy buttons and two icon boxes match the kit (#/feature/site-settings
// hosting scenarios).

// The Designer's parity browser flags: hinted text snaps glyph advances to
// whole px, which would move the label widths off the kit numbers.
test.use({
  launchOptions: {
    args: [
      '--font-render-hinting=none',
      '--disable-lcd-text',
      '--force-color-profile=srgb',
    ],
  },
})

const CARD_TOP = 121.44
const INK = [57, 55, 56]
const MUTED = [83, 81, 82]
/** Ghost hover fill (kit and prod), unchanged by the hover ink. */
const HOVER_FILL = 'rgb(207, 207, 207)'

async function openHosting(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(() => {
    window.__photobooksProject?.startSessionEditor()
  })
  await expect(page.getByTestId('go-library')).toBeEnabled({ timeout: 15_000 })
  await page.getByTestId('editor-settings-open').click()
  await page.getByTestId('settings-nav-hosting').click()
  await expect(page.getByTestId('hosting-setup')).toBeVisible()
}

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (b === null) throw new Error('not visible')
  return b
}

const near = (a: number, b: number, what: string) => {
  expect(
    Math.abs(a - b),
    `${what}: ${String(a)} ≈ ${String(b)}`,
  ).toBeLessThanOrEqual(0.5)
}

/** Card top relative to the Settings content `main`. */
async function cardTop(page: Page, testId: string) {
  const main = await box(page.getByTestId('settings').locator('main'))
  return (await box(page.getByTestId(testId))).y - main.y
}

const sum = (p: number[]) => (p[0] ?? 0) + (p[1] ?? 0) + (p[2] ?? 0)

/** Painted pixels of a `w`×`h` area at `x`, `y` of the locator box. */
function area(x: number, y: number, w: number, h: number) {
  return Array.from({ length: w * h }, (_, i) => ({
    x: x + (i % w),
    y: y + Math.floor(i / w),
  }))
}

/** Darkest painted pixel of the box. */
async function darkest(l: Locator) {
  const b = await box(l)
  const px = await pixelsAt(
    l,
    area(0, 0, Math.floor(b.width), Math.floor(b.height)),
  )
  return px.reduce((a, p) => (sum(p) < sum(a) ? p : a))
}

/** Kit ghost xs: 28 high, padding 0 8, 12px/500 in `ink`. */
async function expectXsGhost(button: Locator, width: number, ink = INK) {
  const b = await box(button)
  near(b.width, width, 'width')
  near(b.height, 28, 'height')
  const style = await button.evaluate((el) => {
    const s = getComputedStyle(el)
    return [s.paddingLeft, s.paddingRight, s.fontSize, s.fontWeight, s.color]
  })
  expect(style).toEqual(['8px', '8px', '12px', '500', `rgb(${ink.join(', ')})`])
  // The label paints that ink: Change the foreground, Copy the ghost grey.
  const painted = await darkest(button)
  for (const [i, c] of ink.entries()) {
    expect(
      Math.abs((painted[i] ?? 0) - c),
      `ink ${painted.join()}`,
    ).toBeLessThanOrEqual(2)
  }
}

test('M114 / M115 / M117: setup steps 1–3, Change and Checking… match the kit', async ({
  page,
}) => {
  const cf = await routeCloudflare(page)
  await openHosting(page)
  near(await cardTop(page, 'hosting-setup'), CARD_TOP, 'step 1')

  // M117: the Checking… spinner is 14×14 and paints over the button fill.
  await page.getByTestId('hosting-setup-token').fill(TOKEN)
  cf.hold = true
  const go = page.getByTestId('hosting-setup-continue')
  await go.click()
  await expect(go).toHaveAccessibleName('Checking…')
  // The box of a turning svg grows; the layout box is the untransformed one.
  const at = await go.locator('svg[data-icon="loader"]').evaluate((el) => {
    const svg = el as SVGSVGElement
    const button = svg.closest('button')?.getBoundingClientRect()
    const s = getComputedStyle(svg)
    const r = svg.getBoundingClientRect()
    return {
      size: [s.width, s.height],
      x: r.x + r.width / 2 - (button?.x ?? 0),
      y: r.y + r.height / 2 - (button?.y ?? 0),
    }
  })
  expect(at.size).toEqual(['14px', '14px'])
  const sums = (
    await pixelsAt(go, area(Math.floor(at.x) - 7, Math.floor(at.y) - 7, 14, 14))
  ).map(sum)
  expect(Math.max(...sums) - Math.min(...sums)).toBeGreaterThan(150)
  cf.release()

  await expect(page.getByTestId('hosting-step-2')).toHaveAttribute(
    'aria-current',
    'step',
  )
  near(await cardTop(page, 'hosting-setup'), CARD_TOP, 'step 2')
  await expectXsGhost(page.getByTestId('hosting-step-1-change'), 60.55)

  // Step 3 stays on screen after a failed row 3.
  cf.dnsTaken = true
  await page.getByTestId('hosting-setup-run').click()
  await expect(page.getByTestId('hosting-setup-retry')).toBeVisible()
  near(await cardTop(page, 'hosting-setup'), CARD_TOP, 'step 3')
  await expectXsGhost(page.getByTestId('hosting-step-2-change'), 60.55)

  cf.dnsTaken = false
  await page.getByTestId('hosting-setup-retry').click()
  await expect(page.getByTestId('hosting-connected')).toBeVisible()
  near(await cardTop(page, 'hosting-connected'), CARD_TOP, 'connected')
})

test('M114 / M115 / M120: manual form and help position, the muted CORS Copy button', async ({
  page,
}) => {
  await routeCloudflare(page)
  await openHosting(page)
  await page.getByTestId('hosting-manual').click()
  await expect(page.getByTestId('hosting-form')).toBeVisible()
  near(await cardTop(page, 'hosting-form'), CARD_TOP, 'manual form')
  // M114: the pane's 19.5 px line height (the guided link's line box) puts
  // the help where the kit has it (y rel. the Settings `main`, like the
  // Designer); the form card keeps its height.
  const main = await box(page.getByTestId('settings').locator('main'))
  const h2 = await box(
    page.getByRole('heading', { name: 'How to get a token' }),
  )
  const help = await box(
    page.getByTestId('hosting-help').filter({ visible: true }),
  )
  for (const [what, y, kit] of [
    ['h2', h2.y - main.y, 550.91],
    ['help', help.y - main.y, 582.33],
    ['help height', help.height, 386.25],
    [
      'form height',
      (await box(page.getByTestId('hosting-form'))).height,
      367.39,
    ],
  ] as const) {
    expect(Math.abs(y - kit), `${what} ${String(y)}`).toBeLessThanOrEqual(0.3)
  }
  // M120: Copy keeps the kit ghost grey, not the Change foreground.
  const copy = page.getByTestId('hosting-cors-copy')
  await expectXsGhost(copy, 56.97, MUTED)
  // M120 (hover): the kit ghost turns the ink to the foreground on its
  // unchanged grey hover fill.
  await copy.hover()
  await expect(copy).toHaveAttribute('data-hovered', 'true')
  await expect(copy).toHaveCSS('background-color', HOVER_FILL)
  await expectXsGhost(copy, 56.97, INK)
  const [corner] = await pixelsAt(copy, [{ x: 2, y: 14 }])
  expect(`rgb(${(corner ?? []).slice(0, 3).join(', ')})`).toBe(HOVER_FILL)
})

test('M117: the Settings nav head icon is 12×12', async ({ page }) => {
  await openHosting(page)
  const icon = page
    .getByTestId('settings')
    .locator('nav svg[data-icon="bookOpen"]')
  const b = await box(icon)
  expect([b.width, b.height]).toEqual([12, 12])
  expect(sum(await darkest(icon))).toBeLessThan(3 * 160)
})
