import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// live-captions-kit (Designer live-captions Spec 2026-11-05): the kit `#/demo`
// TextSection Live block. Chips turn Live on and anchor the caption to the
// nearest photo frame; the canvas paints the photo's values; switching Live
// off freezes the painted text; deleting the anchor frame does the same in
// the delete step.

const demo = (page: Page) => page.getByTestId('demo')
const current = (page: Page) =>
  demo(page).locator(
    '[data-testid="canvas"] [data-testid="spread"][data-current]',
  )
const frames = (page: Page) => current(page).locator('[data-testid="frame"]')
const inspector = (page: Page) => demo(page).getByTestId('ctx-inspector')
const block = (page: Page) => inspector(page).getByTestId('live-caption')
const liveSwitch = (page: Page) =>
  page.getByRole('switch', { name: 'Live from photo metadata' })
const anchorSelect = (page: Page) =>
  block(page).locator('button[aria-haspopup="listbox"]')
const chip = (page: Page, t: string) =>
  block(page).getByTestId(`live-token-${t}`)
const textArea = (page: Page) =>
  inspector(page).getByRole('textbox', { name: 'Text' })
const caption = (page: Page) => frames(page).filter({ hasText: 'Morning' })

async function openBook(page: Page) {
  await page.goto('/uikit/#/demo')
  await expect(demo(page)).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: { reset: () => void } }).__demo.reset()
  })
  await demo(page).getByTestId('create-library').click()
  await page.getByTestId('picker-select').click()
  await demo(page).getByTestId('new-book').click()
  await page.locator('[role=dialog] input').first().fill('Lake trip')
  await page.getByTestId('create-book').click()
}

/** Text tool drag on the current spread, type, Esc: the new text frame stays selected. */
async function drawText(page: Page, text: string) {
  await demo(page).locator('[aria-label="Text (T)"]').click()
  const b = await current(page).boundingBox()
  if (b === null) throw new Error('current spread has no box')
  const x = Math.round(b.x + b.width * 0.56)
  const y = Math.round(b.y + b.height * 0.62)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 200, y + 40, { steps: 6 })
  await page.mouse.up()
  await page.keyboard.type(text)
  await page.keyboard.press('Escape')
  await expect(textArea(page)).toHaveValue(text)
}

/** Keys go to the window, not to the control the test clicked last. */
async function blur(page: Page) {
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  )
}

/** Top and bottom of `el` relative to the inspector root (the Spec's y). */
async function topRel(page: Page, el: Locator): Promise<[number, number]> {
  const [a, b] = await Promise.all([
    inspector(page).boundingBox(),
    el.boundingBox(),
  ])
  if (a === null || b === null) throw new Error('no box')
  return [b.y - a.y, b.y + b.height - a.y]
}

test.describe('kit live captions', () => {
  test.beforeEach(async ({ page }) => {
    await openBook(page)
    await demo(page).getByTestId('demo-add-folder').click()
    await page
      .locator('[role=dialog]')
      .getByRole('button', { name: /Choose|Select|Use|Add/i })
      .last()
      .click()
    await demo(page).locator('[data-item="p1"]').click()
    await page
      .locator('[data-testid="filmstrip"] [role="row"]')
      .nth(5)
      .dragTo(frames(page).first())
    await expect(frames(page).first().locator('img')).toHaveCount(1)
    await drawText(page, 'Morning')
  })

  test('chips anchor the caption and paint the photo values on one row', async ({
    page,
  }) => {
    await expect(liveSwitch(page)).not.toBeChecked()
    await expect(anchorSelect(page)).toHaveCount(0)
    await expect(
      block(page).locator('[data-testid^="live-token-"]'),
    ).toHaveText(['date', 'title', 'caption', 'camera'])
    const date = (await chip(page, 'date').getAttribute('title')) ?? ''
    const camera = (await chip(page, 'camera').getAttribute('title')) ?? ''
    expect(date).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}$/)
    expect(camera).not.toBe('')

    await chip(page, 'date').click()
    await chip(page, 'camera').click()

    await expect(liveSwitch(page)).toBeChecked()
    await expect(textArea(page)).toHaveValue('Morning · {date} · {camera}')
    await expect(anchorSelect(page)).toContainText(/^Frame 1 · \S+/)
    await expect(caption(page)).toHaveText(`Morning · ${date} · ${camera}`)
    // one row: every chip at the same top y
    const tops = await block(page)
      .locator('[data-testid^="live-token-"]')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top))
    expect(new Set(tops).size).toBe(1)
    // Spec layout, y relative to the inspector (±1 px)
    const near = (got: [number, number], want: [number, number]) => {
      expect(Math.abs(got[0] - want[0])).toBeLessThanOrEqual(1)
      expect(Math.abs(got[1] - want[1])).toBeLessThanOrEqual(1)
    }
    near(
      await topRel(page, inspector(page).getByTestId('live-caption-switch')),
      [246, 266],
    )
    near(await topRel(page, anchorSelect(page)), [296.8, 328.8])
    near(await topRel(page, chip(page, 'date')), [336.8, 360.8])
  })

  test('switch off freezes the painted text, undo restores the template', async ({
    page,
  }) => {
    await chip(page, 'date').click()
    const painted = await caption(page).innerText()
    expect(painted).not.toContain('{')

    await inspector(page).getByTestId('live-caption-switch').click()

    await expect(liveSwitch(page)).not.toBeChecked()
    await expect(anchorSelect(page)).toHaveCount(0)
    await expect(textArea(page)).toHaveValue(painted)
    await expect(caption(page)).toHaveText(painted)

    await blur(page)
    await page.keyboard.press('Control+z')
    await expect(liveSwitch(page)).toBeChecked()
    await expect(textArea(page)).toHaveValue('Morning · {date}')
    await expect(caption(page)).toHaveText(painted)
  })

  test('deleting the anchor frame makes the caption static with its text', async ({
    page,
  }) => {
    await chip(page, 'camera').click()
    const painted = await caption(page).innerText()
    const count = await frames(page).count()

    await frames(page).first().click({ force: true })
    await blur(page)
    await page.keyboard.press('Delete')
    await expect(frames(page)).toHaveCount(count - 1)

    await caption(page).click({ force: true })
    await expect(liveSwitch(page)).not.toBeChecked()
    await expect(textArea(page)).toHaveValue(painted)
    await expect(caption(page)).toHaveText(painted)
  })

  test('a chip inserts at the caret the Text field had, then after the token', async ({
    page,
  }) => {
    await textArea(page).click()
    await page.keyboard.press('Home')
    await chip(page, 'title').click()
    await chip(page, 'camera').click()

    await expect(textArea(page)).toHaveValue('{title}{camera}Morning')
    await expect(liveSwitch(page)).toBeChecked()
  })

  test('no image frame on the spread: disabled switch and hint, no chips', async ({
    page,
  }) => {
    // delete every frame on the spread except the caption, one by one
    const image = frames(page).filter({ hasNotText: 'Morning' })
    for (let n = await image.count(); n > 0; n--) {
      await image.first().click({ force: true })
      await blur(page)
      await page.keyboard.press('Delete')
    }
    await caption(page).click({ force: true })

    await expect(liveSwitch(page)).toBeDisabled()
    await expect(inspector(page).getByTestId('live-caption-switch')).toHaveCSS(
      'opacity',
      '0.5',
    )
    // the row is .5 overall: the track inside it is not dimmed again
    await expect(
      inspector(page).getByTestId('live-caption-switch').locator('.sw-track'),
    ).toHaveCSS('opacity', '1')
    await expect(block(page).getByTestId('live-caption-hint')).toHaveText(
      'Add a photo frame to this spread to use its metadata.',
    )
    await expect(
      block(page).locator('[data-testid^="live-token-"]'),
    ).toHaveCount(0)
    await expect(anchorSelect(page)).toHaveCount(0)
  })
})
