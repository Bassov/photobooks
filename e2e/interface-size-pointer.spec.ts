import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { settleCamera } from './fixtures/dispatchCtrlWheel'
import { dropAssetOnFrame } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { applyLayout } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'

// Designer interface-size §4 (item interface-size-pointer), Musts IS6, IS8,
// IS9: at 150 % on a 4K window (`#root { zoom: 1.5 }`) every pointer gesture
// moves what it drags by the pointer's screen movement (±1 px), editor
// bitmaps back at DPR × s, and the site preview room stays at visitor size.

const KEY = 'photobooks.ui.scale.v1'

test.use({ viewport: { width: 3840, height: 2160 } })

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

// The same audit at 150 % and at 100 % (IS10: nothing changes at 100 %).
for (const choice of ['150', '100'] as const) {
  test.describe(`interface size ${choice} %`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(
        ([k, v]) => {
          localStorage.setItem(k, v)
        },
        [KEY, choice] as const,
      )
    })
    auditTests()
  })
}

/** Effective interface scale s of the open page. */
const scaleOf = async (page: Page) =>
  Number(await page.locator('html').getAttribute('data-ui-scale')) / 100

interface Point {
  x: number
  y: number
}
type Box = Point & { width: number; height: number }

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox()
  if (b === null) throw new Error('not visible')
  return b
}

const centre = (b: Box): Point => ({
  x: b.x + b.width / 2,
  y: b.y + b.height / 2,
})

async function drag(page: Page, from: Point, to: Point): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
}

function expectWithin(actual: number, expected: number, tolerance = 1) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance)
}

/** Effective zoom of an element: screen px per own CSS px. */
const netZoom = (locator: Locator) =>
  locator.evaluate(
    (el) => el.getBoundingClientRect().width / (el as HTMLElement).offsetWidth,
  )

const ACTIVE_SPREAD = '[data-active="true"] [data-testid="spread-view"]'
const spread = (page: Page) => page.locator(ACTIVE_SPREAD)
const frames = (page: Page) => spread(page).getByTestId('spread-frame')

async function editor(page: Page): Promise<void> {
  await openSessionEditor(page)
  // 3840×2160 leaves room for every step, so s = the stored choice.
  const stored = await page.evaluate((k) => localStorage.getItem(k), KEY)
  await expect(page.locator('html')).toHaveAttribute(
    'data-ui-scale',
    stored ?? '',
  )
}

async function editorWithPhotos(page: Page): Promise<void> {
  await editor(page)
  await choosePhotoFolder(page, [
    photoFixturePaths.samplePng,
    photoFixturePaths.sampleOrient6,
  ])
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(2, {
    timeout: 30_000,
  })
  await expect(page.getByTestId('filmstrip-status')).toHaveCount(0, {
    timeout: 30_000,
  })
}

function auditTests(): void {
  test('panel splitter and filmstrip separator follow the pointer', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await editorWithPhotos(page)

    // 60 screen px = 40 app px: the panel's right edge moves 60 screen px.
    const panel = page.getByTestId('panel-l')
    const before = await box(panel)
    const grip = centre(await box(page.getByTestId('resize-left')))
    await drag(page, grip, { x: grip.x + 60, y: grip.y })
    await expect
      .poll(async () => (await box(panel)).width - before.width)
      .toBeCloseTo(60, 0)

    // The thumb height snaps to 4 app px, and `auto` may sit between steps:
    // a first drag puts it on the grid, then 24 screen px down (16 app px, four
    // whole steps) moves the separator exactly under the pointer.
    const sep = page.getByTestId('thumb-resizer')
    const first = centre(await box(sep))
    await drag(page, first, { x: first.x, y: first.y + 24 })
    await expect
      .poll(async () => centre(await box(sep)).y - first.y)
      .toBeGreaterThan(12)
    const s0 = await box(sep)
    const from = centre(s0)
    await drag(page, from, { x: from.x, y: from.y + 24 })
    await expect
      .poll(async () => Math.round((await box(sep)).y - s0.y))
      .toBe(24)
  })

  test('frame drag, resize handle and marquee track the pointer', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await editor(page)
    const frame = frames(page).first()
    await frame.click()
    await expect(frame).toHaveAttribute('aria-pressed', 'true')

    // Alt bypasses snapping, so the frame lands exactly where the pointer went;
    // it moves towards the spread centre, clear of the edge clamp.
    const f0 = await box(frame)
    const mid = centre(await box(spread(page)))
    const dx = Math.sign(mid.x - centre(f0).x) * 60
    const dy = Math.sign(mid.y - centre(f0).y) * 30
    await page.keyboard.down('Alt')
    await drag(page, centre(f0), { x: centre(f0).x + dx, y: centre(f0).y + dy })
    await page.keyboard.up('Alt')
    await expect
      .poll(async () => (await box(frame)).x - f0.x)
      .toBeCloseTo(dx, 0)
    const f1 = await box(frame)
    expectWithin(f1.y - f0.y, dy)

    // The nw handle dragged inward with Alt (no snap, resize about the centre):
    // the corner follows the pointer, the opposite one mirrors it.
    const handle = frame.locator('[data-testid="sel-handle"][data-handle="nw"]')
    const h = centre(await box(handle))
    await page.keyboard.down('Alt')
    await drag(page, h, { x: h.x + 45, y: h.y + 30 })
    await page.keyboard.up('Alt')
    await expect
      .poll(async () => (await box(frame)).x - f1.x)
      .toBeCloseTo(45, 0)
    const f2 = await box(frame)
    expectWithin(f2.y - f1.y, 30)
    expectWithin(f1.width - f2.width, 90)
    expectWithin(f1.height - f2.height, 60)

    // The marquee box spans press → pointer in screen px.
    const paper = await box(spread(page))
    const start = { x: paper.x - 20, y: paper.y + 40 }
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + 150, start.y + 120, { steps: 12 })
    const m = await box(page.getByTestId('marquee'))
    expectWithin(m.x, start.x)
    expectWithin(m.y, start.y)
    expectWithin(m.width, 150)
    expectWithin(m.height, 120)
    await page.mouse.up()
    await expect(page.getByTestId('marquee')).toHaveCount(0)
  })

  test('guide drag lands under the pointer; rulers back at DPR × s', async ({
    page,
  }) => {
    await editor(page)
    await page.keyboard.press('Shift+R')
    const ruler = page.getByTestId('ruler-x')
    await expect(ruler).toBeVisible()

    // IS8: canvas backing = CSS size × DPR (1) × s.
    const backing = await ruler.locator('canvas').evaluate((el) => ({
      width: (el as HTMLCanvasElement).width,
      css: (el as HTMLCanvasElement).clientWidth,
    }))
    expectWithin(backing.width, backing.css * (await scaleOf(page)))

    const paper = await box(spread(page))
    const x = paper.x + paper.width * 0.4
    const target = paper.y + 137
    await drag(page, { x, y: centre(await box(ruler)).y }, { x, y: target })
    const line = page.locator(
      '[data-testid="guide-line"][data-orientation="horizontal"]',
    )
    await expect(line).toHaveCount(1)
    expectWithin(centre(await box(line)).y, target)

    // An existing guide moves by the pointer movement.
    const at = centre(await box(line))
    await drag(page, at, { x: at.x, y: at.y + 75 })
    await expect
      .poll(async () => Math.round(centre(await box(line)).y - at.y))
      .toBe(75)
  })

  test('wheel zoom keeps the point under the pointer', async ({ page }) => {
    await editor(page)
    const b0 = await box(spread(page))
    const p = { x: b0.x + b0.width * 0.3, y: b0.y + b0.height * 0.25 }
    const fx = (p.x - b0.x) / b0.width
    const fy = (p.y - b0.y) / b0.height
    await page.getByTestId('pasteboard-scroll').evaluate(async (el, at) => {
      for (let i = 0; i < 3; i += 1) {
        el.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: -120,
            ctrlKey: true,
            clientX: at.x,
            clientY: at.y,
            bubbles: true,
            cancelable: true,
          }),
        )
      }
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          resolve()
        })
      })
    }, p)
    await settleCamera(page)
    const b1 = await box(spread(page))
    expect(b1.width).toBeGreaterThan(b0.width * 1.05)
    expectWithin(b1.x + fx * b1.width, p.x)
    expectWithin(b1.y + fy * b1.height, p.y)
  })

  test('spread-list reorder and filmstrip drop hit the pointer target', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await editorWithPhotos(page)

    // Drop on the last empty frame of the active spread: a point mapped in the
    // wrong space lands off it (the scrollport origin is far from the frame).
    const empty = spread(page).getByRole('button', {
      name: 'Place photo',
      exact: true,
    })
    expect(await empty.count()).toBeGreaterThan(0)
    const target = empty.last()
    const targetId = await target.getAttribute('data-frame-id')
    const assetId =
      (await page
        .getByTestId('filmstrip-item')
        .first()
        .getAttribute('data-asset-id')) ?? ''
    expect(assetId).not.toBe('')
    await dropAssetOnFrame(page, assetId, target, { keepSelection: true })
    await expect(
      spread(page).locator(`[data-frame-id="${targetId ?? ''}"]`),
    ).toHaveAttribute('data-filled', 'true', { timeout: 30_000 })
    await expect(
      spread(page).locator('[data-testid="spread-frame"][data-filled="true"]'),
    ).toHaveCount(1)

    // Reorder: dropping the last spread just below the first item's middle
    // puts it second.
    const order = () =>
      page
        .getByTestId('spreads-list')
        .locator('[data-item]')
        .evaluateAll((els) =>
          els.map((el) => el.getAttribute('data-item') ?? ''),
        )
    const before = await order()
    expect(before.length).toBeGreaterThan(2)
    const first = await box(
      page.getByTestId('spreads-list').locator('[data-item]').first(),
    )
    const lastId = before.at(-1) ?? ''
    await page.evaluate(
      ({ id, y }) => {
        const item = document.querySelector(`[data-item="${id}"]`)
        const list = document.querySelector('[data-testid="spreads-list"]')
        if (!(item instanceof HTMLElement) || !(list instanceof HTMLElement)) {
          throw new Error('missing spreads list')
        }
        const dataTransfer = new DataTransfer()
        item.dispatchEvent(
          new DragEvent('dragstart', { bubbles: true, dataTransfer }),
        )
        const init = {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientY: y,
        }
        list.dispatchEvent(new DragEvent('dragover', init))
        list.dispatchEvent(new DragEvent('drop', init))
        item.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
      },
      { id: lastId, y: first.y + first.height * 0.75 },
    )
    await expect
      .poll(order)
      .toEqual([before[0], lastId, ...before.slice(1, -1)])
  })

  test('crop pan moves the photo with the pointer', async ({ page }) => {
    test.setTimeout(120_000)
    await editor(page)
    await choosePhotoFolder(page, [photoFixturePaths.samplePng])
    await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
      timeout: 30_000,
    })
    await applyLayout(page, 'Full bleed', { restorePanel: true })
    const frame = frames(page).first()
    const assetId =
      (await page
        .getByTestId('filmstrip-item')
        .first()
        .getAttribute('data-asset-id')) ?? ''
    await dropAssetOnFrame(page, assetId, frame, { keepSelection: true })
    const image = frame.getByTestId('spread-frame-image')
    await expect(image).toHaveCount(1, { timeout: 30_000 })
    await expect(frame).toHaveAttribute('aria-pressed', 'true')
    const grabber = frame.getByTestId('crop-grabber')
    await expect(grabber).toBeVisible()
    const p0 = await box(image)
    const g = centre(await box(grabber))
    await drag(page, g, { x: g.x + 60, y: g.y })
    await expect
      .poll(async () => (await box(image)).x - p0.x)
      .toBeCloseTo(60, 0)
  })

  test('site preview: bar scales, room and GL at visitor size', async ({
    page,
  }) => {
    await editor(page)
    await page.getByTestId('present').click()
    const preview = page.getByTestId('site-preview')
    await expect(preview.getByTestId('site-label')).toHaveText('Cover')

    // IS9: the 48 px bar is app chrome (72 screen px)…
    expectWithin(
      (await box(preview.getByTestId('site-preview-bar'))).height,
      48 * (await scaleOf(page)),
    )
    // …the room is drawn 1:1, as a visitor sees it.
    const room = preview.getByTestId('site-preview-scroll')
    expectWithin(await netZoom(room), 1, 0.001)
    expectWithin((await box(room)).width, 3840)
    // Any GL canvas backs at DPR 1 over its screen box.
    const canvases = await room.locator('canvas').evaluateAll((els) =>
      els.map((el) => ({
        width: (el as HTMLCanvasElement).width,
        screen: el.getBoundingClientRect().width,
      })),
    )
    for (const c of canvases) {
      expectWithin(c.width, Math.round(c.screen), 2)
    }
    await page.keyboard.press('Escape')
    await expect(preview).toHaveCount(0)
  })
}
