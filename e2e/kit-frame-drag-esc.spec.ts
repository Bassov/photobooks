import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// design-r47 M157 (kit `#/demo`, prod twin: src/editor/frameGesture.ts Esc and
// e2e/design-r2-canvas-toolbar.spec.ts): Esc during a frame move puts the
// frame back where it started; the release then does nothing, no undo step,
// the layout name stays, the selection is kept.

test.use({ viewport: { width: 1440, height: 900 } })

const DEMO = '[data-testid="demo"]'
const D = (page: Page, s: string) => page.locator(`${DEMO} ${s}`)
const paper = (page: Page) =>
  D(page, '[data-testid="spread"][data-current]').first()
const frames = (page: Page) => paper(page).locator('[data-testid="frame"]')
const handles = (page: Page) => paper(page).getByTestId('sel-handle')
const undo = (page: Page) => D(page, '[data-testid="undo"]')
const name = (page: Page) =>
  D(page, '[data-testid="layout-cycle"] [data-testid="layout-cycle-name"]')

interface DemoApi {
  reset: () => void
  state: () => {
    path: string
    books: { id: string; title: string; book: Record<string, unknown> }[]
    open: string
  }
  go: (view: string) => void
}

async function settled(page: Page) {
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  )
}

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

/** #/demo, one A5 book with a folder of photos, spread 2–3 current with "Hero + two" */
async function heroTwo(page: Page) {
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(() => {
    const d = (window as unknown as { __demo: DemoApi }).__demo
    d.reset()
    const s = d.state()
    s.path = '~/Pictures/Photobooks'
    s.books = [
      {
        id: 's1',
        title: 'Esc',
        book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: 'A5' },
      },
    ]
    s.open = 's1'
    d.go('editor')
  })
  await expect(D(page, '[data-testid="dock"]')).toBeVisible()
  await page.locator('[data-testid="demo-add-folder"]').first().click()
  await page
    .locator('[role=dialog]')
    .getByRole('button', { name: /Select/i })
    .last()
    .click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await D(page, '[data-item="p1"]').click()
  await page.locator('[aria-label="Apply layout Hero + two"]').first().click()
  await expect(name(page)).toHaveText('Hero + two')
  await expect(frames(page)).toHaveCount(3)
  await page.mouse.move(1439, 899)
  await settled(page)
}

/** `selected`: click the frame first, so the drag starts on a selected frame */
async function preselect(
  page: Page,
  pre: 'unselected' | 'selected',
  x: number,
  y: number,
) {
  if (pre === 'unselected') {
    await expect(handles(page)).toHaveCount(0)
    return
  }
  await page.mouse.click(x, y)
  await expect(handles(page).first()).toBeVisible()
}

for (const pre of ['unselected', 'selected'] as const) {
  test(`design-r47 M157 (#/demo): Esc mid frame drag puts the frame back, release adds no step (${pre})`, async ({
    page,
  }) => {
    await heroTwo(page)
    const f = frames(page).nth(1)
    const start = await box(f)
    const cx = start.x + start.width / 2
    const cy = start.y + start.height / 2
    await preselect(page, pre, cx, cy)
    const undo0 = await undo(page).getAttribute('aria-label')

    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx + 40, cy + 30, { steps: 8 })
    await expect
      .poll(async () => (await box(f)).x - start.x)
      .toBeGreaterThan(20)
    await page.keyboard.press('Escape')
    await expect
      .poll(async () => Math.abs((await box(f)).x - start.x))
      .toBeLessThanOrEqual(0.5)
    // the pointer goes on after Esc: the gesture is over, nothing follows it
    await page.mouse.move(cx + 60, cy + 40, { steps: 3 })
    await page.mouse.up()
    await settled(page)

    const end = await box(f)
    expect(Math.abs(end.x - start.x)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(end.y - start.y)).toBeLessThanOrEqual(0.5)
    await expect(undo(page)).toHaveAttribute('aria-label', undo0 ?? '')
    await expect(name(page)).toHaveText('Hero + two')
    // the press selected the frame; Esc ended the drag, not the selection
    await expect(handles(page).first()).toBeVisible()
    const hb = await box(handles(page).first())
    expect(hb.x).toBeGreaterThanOrEqual(end.x - 12)
    expect(hb.x).toBeLessThanOrEqual(end.x + end.width + 12)
  })
}

// design-r48 M159 (prod twin: src/editor/frameHandleGesture.ts Esc): Esc
// during a resize-handle drag puts the frame back at its start size.

/** select the middle frame, press its se handle and drag it +30/+20 px */
async function resizeSe(page: Page) {
  await heroTwo(page)
  const f = frames(page).nth(1)
  const start = await box(f)
  await preselect(
    page,
    'selected',
    start.x + start.width / 2,
    start.y + start.height / 2,
  )
  const undo0 = await undo(page).getAttribute('aria-label')
  const se = await box(paper(page).locator('[data-handle="se"]'))
  const hx = se.x + se.width / 2
  const hy = se.y + se.height / 2
  await page.mouse.move(hx, hy)
  await page.mouse.down()
  await page.mouse.move(hx + 30, hy + 20, { steps: 8 })
  await expect
    .poll(async () => (await box(f)).width - start.width)
    .toBeGreaterThan(10)
  return { f, start, undo0, hx, hy }
}

test('design-r48 M159 (#/demo): Esc mid resize puts the frame back at its start size, release adds no step', async ({
  page,
}) => {
  const { f, start, undo0, hx, hy } = await resizeSe(page)
  await page.keyboard.press('Escape')
  await expect
    .poll(async () => Math.abs((await box(f)).width - start.width))
    .toBeLessThanOrEqual(0.5)
  // the pointer goes on after Esc: the gesture is over, nothing follows it
  await page.mouse.move(hx + 50, hy + 40, { steps: 3 })
  await page.mouse.up()
  await settled(page)

  const end = await box(f)
  expect(Math.abs(end.x - start.x)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(end.y - start.y)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(end.width - start.width)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(end.height - start.height)).toBeLessThanOrEqual(0.5)
  await expect(undo(page)).toHaveAttribute('aria-label', undo0 ?? '')
  await expect(name(page)).toHaveText('Hero + two')
  // Esc ended the resize, not the selection
  await expect(handles(page).first()).toBeVisible()
  await expect(D(page, '[data-testid="snap-line"]')).toHaveCount(0)
})

test('design-r48 M159 (#/demo): a resize without Esc still commits "Resize frame"', async ({
  page,
}) => {
  const { f, start } = await resizeSe(page)
  await page.mouse.up()
  await settled(page)

  expect((await box(f)).width - start.width).toBeGreaterThan(10)
  await expect(undo(page)).toHaveAttribute('aria-label', /Resize frame/)
  await expect(D(page, '[data-testid="snap-line"]')).toHaveCount(0)
})
