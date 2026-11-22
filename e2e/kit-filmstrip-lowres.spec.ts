import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'

// P11 "Filmstrip status without noise" (Designer walkthrough-polish-review,
// Owner Q-21) in the kit #/demo editor step: the Low-res chip is always the
// icon-only 18 × 16.84 variant at left + 4 / top + 4 (no "Low-res" text
// painted at any thumb size), and the Photos header ends " · N low-res" in
// the warning ink when N > 0 and says nothing about low-res when N = 0.
// Prod twin: e2e/design-r16-prod.spec.ts "M85 low-res chip".

test.use({
  viewport: { width: 1440, height: 900 },
  launchOptions: {
    ignoreDefaultArgs: ['--hide-scrollbars'],
    args: ['--font-render-hinting=none'],
  },
})

const DEMO = '[data-testid="demo"]'
const D = (page: Page, s: string) => page.locator(`${DEMO} ${s}`)
const WARNING_INK = 'rgb(132, 85, 16)'
const FIELD_RGB = [216, 214, 210]
const TOL = 0.5

function watchErrors(page: Page) {
  const errs: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning')
      errs.push(`${m.type()}: ${m.text().slice(0, 240)}`)
  })
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`))
  page.on('requestfailed', (r) => errs.push(`requestfailed: ${r.url()}`))
  return errs
}

const frames2 = () =>
  new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

async function settled(page: Page) {
  await page.evaluate(frames2)
  await expect
    .poll(() =>
      page.evaluate(() =>
        document
          .getAnimations()
          .every(
            (a) =>
              a.playState !== 'running' ||
              a.effect?.getComputedTiming().iterations === Infinity,
          ),
      ),
    )
    .toBe(true)
}

/** kit10 walk: fresh #/demo, a library, a new book, the demo photo folder. */
async function demoEditorWithPhotos(page: Page) {
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: { reset: () => void } }).__demo.reset()
  })
  await settled(page)
  const c = async (sel: string) => {
    await page.locator(sel).first().click() // dialogs portal outside the demo root
    await settled(page)
  }
  await c('[data-testid="create-library"]')
  await c('[data-testid="picker-select"]')
  await c(`${DEMO} [data-testid="new-book"]`)
  await c('[data-testid="create-book"]')
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await c('[data-testid="demo-add-folder"]')
  await page
    .locator('[role=dialog]')
    .getByRole('button', { name: /Choose|Select|Use|Add/i })
    .last()
    .click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await settled(page)
}

function near(actual: number, expected: number, what: string): void {
  expect(
    Math.abs(actual - expected),
    `${what}: ${String(actual)} vs ${String(expected)}`,
  ).toBeLessThanOrEqual(TOL)
}

async function rect(locator: Locator) {
  const b = await locator.boundingBox()
  if (b === null) throw new Error('expected a bounding box')
  return b
}

/** 18 × 16.84 at +4/+4 inside its thumb, 10 px icon, no text painted. */
async function expectIconOnlyChip(page: Page, chip: Locator, size: string) {
  const thumb = await rect(chip.locator('xpath=..'))
  // The old kit chip showed its "Low-res" text on thumbs ≥ 73.33 wide.
  expect(thumb.width, `${size} thumb width`).toBeGreaterThan(73.33)
  const c = await rect(chip)
  near(c.x, thumb.x + 4, `${size} chip x`)
  near(c.y, thumb.y + 4, `${size} chip y`)
  near(c.width, 18, `${size} chip width`)
  near(c.height, 16.84, `${size} chip height`)
  const icon = await rect(chip.locator('svg'))
  near(icon.width, 10, `${size} icon width`)
  near(icon.height, 10, `${size} icon height`)
  near(icon.x, c.x + 4, `${size} icon x`)
  near(icon.y + icon.height / 2, c.y + c.height / 2, `${size} icon centre y`)
  const pad = await pixelsAt(chip, [
    { x: 15.5, y: 3 },
    { x: 15.5, y: 8 },
    { x: 15.5, y: 13 },
  ])
  expect(
    pad.map((px) => px.slice(0, 3)),
    `${size} right padding`,
  ).toEqual([FIELD_RGB, FIELD_RGB, FIELD_RGB])
  const painted = await D(page, '[data-testid="filmstrip"]').evaluate(
    (root) => {
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let hits = 0
      for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) {
        if (!/low-res/i.test(n.textContent ?? '')) continue
        const range = document.createRange()
        range.selectNodeContents(n)
        const rects = [...range.getClientRects()]
        if (rects.some((r) => r.width > 0 && r.height > 0)) hits += 1
      }
      return hits
    },
  )
  expect(painted, `${size} painted Low-res text runs`).toBe(0)
}

test('P11 #/demo: icon-only Low-res chip at default and max size; the Photos header counts it', async ({
  page,
}) => {
  const errs = watchErrors(page)
  await demoEditorWithPhotos(page)
  const chips = D(page, '[data-testid="filmstrip"]').getByRole('img', {
    name: 'Low-res',
    exact: true,
  })
  await expect(chips).toHaveCount(1)
  const chip = chips.first()
  await expect(chip).toHaveAttribute('title', 'Low-res')
  await expect(chip).toHaveText('')
  expect(await chip.evaluate((el) => getComputedStyle(el).color)).toBe(
    WARNING_INK,
  )

  const head = D(page, '[data-testid="film-head"]')
  await expect(head).toHaveText(/ · \d+ used · 1 low-res$/)
  const count = head.getByTestId('lowres-count')
  await expect(count).toHaveText(' · 1 low-res')
  expect(await count.evaluate((el) => getComputedStyle(el).color)).toBe(
    WARNING_INK,
  )

  await expectIconOnlyChip(page, chip, 'default')
  const sep = D(page, '[data-testid="thumb-resizer"]')
  await sep.focus()
  await page.keyboard.press('End')
  await expect(sep).toHaveAttribute(
    'aria-valuenow',
    (await sep.getAttribute('aria-valuemax')) ?? '',
  )
  await settled(page)
  await expectIconOnlyChip(page, chip, 'max')
  expect(errs).toEqual([])
})

test('P11 #/demo: with no low-res photo in the shown strip the header says nothing about low-res', async ({
  page,
}) => {
  const errs = watchErrors(page)
  await demoEditorWithPhotos(page)
  await page.locator('[data-item="p1"]').first().click()
  await settled(page)
  const head = D(page, '[data-testid="film-head"]')
  await expect(head).toHaveText(/ · 1 low-res$/)
  // Unplaced only, then place p02 (the 800 px low-res photo): it leaves the
  // shown strip, so the filtered header has no low-res part.
  await D(page, '[data-testid="film-unplaced-only"]').click()
  await expect(head).toHaveText(/ of \d+ · \d+ used · 1 low-res$/)
  await D(page, '[data-testid="filmstrip"] [role="row"]')
    .nth(1)
    .dragTo(
      D(
        page,
        '[data-testid="canvas"] [data-current] [data-testid="frame"]',
      ).first(),
    )
  await settled(page)
  await expect(head).toHaveText(/ of \d+ · \d+ used$/)
  await expect(head).not.toContainText('low-res')
  await expect(D(page, '[data-testid="lowres-chip"]')).toHaveCount(0)
  expect(errs).toEqual([])
})
