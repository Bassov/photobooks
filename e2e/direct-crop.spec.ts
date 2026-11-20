import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { dragPlaceFirstFilmstripItem } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { expandDisclosure } from './fixtures/expandDisclosure'
import { applyLayout } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { pixelsAt } from './fixtures/paintProbe'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'

/**
 * Designer walkthrough-ux-review §A, direct crop (kit `#/demo` steps
 * editor-frame-selected, editor-photo-layer-hover, editor-photo-scaled,
 * editor-frame-cropped-by-edge; uikit/src/sandbox/canvas.tsx FrameChrome).
 *
 * Page 1 is a right page: the spread clips its top and outer (right) edge at
 * the page (`.spread-view` clip-path), so the gestures below use the spine
 * (left) side and the bottom, where the chrome is painted.
 */

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

interface Point {
  x: number
  y: number
}

type Box = Point & { width: number; height: number }

/** A full-bleed page-1 frame holding the 3:2 teal sample, selected. */
async function selectedPhotoFrame(page: Page): Promise<Locator> {
  await openSessionEditor(page)
  await page.bringToFront()
  await choosePhotoFolder(page, [photoFixturePaths.samplePng])
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
    timeout: 30_000,
  })
  await applyLayout(page, 'Full bleed', { restorePanel: true })
  await dragPlaceFirstFilmstripItem(page, 0)
  const frame = page.locator('[data-testid="spread-frame"][data-filled="true"]')
  await expect(frame.getByTestId('spread-frame-image')).toHaveCount(1, {
    timeout: 30_000,
  })
  if ((await frame.getAttribute('aria-pressed')) !== 'true') {
    await frame.click()
  }
  await expect(frame).toHaveAttribute('aria-pressed', 'true')
  await expect(frame.getByTestId('crop-grabber')).toBeVisible()
  // The click landed on the grabber (the frame centre): leave the photo.
  const f = await box(frame)
  await page.mouse.move(f.x + f.width / 2, f.y + f.height + 120, { steps: 4 })
  await expect(frame.getByTestId('photo-layer')).not.toHaveAttribute(
    'data-shown',
    'true',
  )
  return frame
}

async function openRightPanel(page: Page): Promise<void> {
  const open = await page.getByTestId('panel-r').getAttribute('data-open')
  if (open !== 'true') {
    await page.getByTestId('toggle-r').click()
  }
}

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox()
  if (b === null) {
    throw new Error('not visible')
  }
  return b
}

const centre = (b: Box): Point => ({
  x: b.x + b.width / 2,
  y: b.y + b.height / 2,
})

/** A point `d` px from the centre of `b`, towards the inside of `frame`. */
const inward = (b: Box, frame: Box, d = 3): Point => {
  const c = centre(b)
  const f = centre(frame)
  return {
    x: c.x + Math.sign(f.x - c.x) * d,
    y: c.y + Math.sign(f.y - c.y) * d,
  }
}

/** The photo's page box: the (unclipped) image element. */
const photo = (frame: Locator) => box(frame.getByTestId('spread-frame-image'))

function expectNear(actual: Box, expected: Box, tolerance = 0.5) {
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(actual[key] - expected[key])).toBeLessThanOrEqual(tolerance)
  }
}

/** Closest test id of the topmost hit-testable element at a page point. */
function hitAt(page: Page, at: Point): Promise<string | null> {
  return page.evaluate(
    ({ x, y }) =>
      document
        .elementFromPoint(x, y)
        ?.closest('[data-testid]')
        ?.getAttribute('data-testid') ?? null,
    at,
  )
}

async function drag(
  page: Page,
  from: Point,
  to: Point,
  during?: () => Promise<void>,
) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, {
    steps: 4,
  })
  await page.mouse.move(to.x, to.y, { steps: 4 })
  await during?.()
  await page.mouse.up()
}

const undo = (page: Page) =>
  page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')

/** Shows the photo layer by hovering the grabber. */
async function showLayer(page: Page, frame: Locator) {
  const at = centre(await box(frame.getByTestId('crop-grabber')))
  await page.mouse.move(at.x, at.y)
  await expect(frame.getByTestId('photo-layer')).toHaveAttribute(
    'data-shown',
    'true',
  )
}

test('selected photo frame: kit grabber look, photo layer painted on hover, hit order', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const frame = await selectedPhotoFrame(page)
  const grabber = frame.getByTestId('crop-grabber')
  const f = await box(frame)
  const p = await photo(frame)
  // The 3:2 photo covers the square frame and hangs out on both sides.
  expect(p.x).toBeLessThan(f.x - 40)

  // Grabber at the visible photo centre, kit §A look.
  const [gc, fc] = [centre(await box(grabber)), centre(f)]
  expect(Math.abs(gc.x - fc.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(gc.y - fc.y)).toBeLessThanOrEqual(1)
  const look = await grabber.evaluate((el) => {
    const s = getComputedStyle(el)
    const dot = getComputedStyle(el, '::after')
    return {
      size: [s.width, s.height, s.borderTopLeftRadius],
      background: s.backgroundColor,
      shadow: s.boxShadow,
      cursor: s.cursor,
      dot: [dot.width, dot.height, dot.backgroundColor],
    }
  })
  // Kit: size-7 rounded-full, bg rgb(255 255 255 / .72), ring 1.5px
  // --select (#232223), 0 1px 3px rgb(0 0 0 / .25), 6 px --select dot.
  expect(look).toEqual({
    size: ['28px', '28px', '50%'],
    background: 'color(srgb 1 1 1 / 0.72)',
    shadow:
      'rgb(35, 34, 35) 0px 0px 0px 1.5px, rgba(0, 0, 0, 0.25) 0px 1px 3px 0px',
    cursor: 'move',
    dot: ['6px', '6px', 'rgb(35, 34, 35)'],
  })

  // Hidden layer: no paint, no hits beside the frame.
  const besidePage = { x: f.x - 40, y: f.y + f.height / 2 }
  // Probed in the image's (unclipped) box, which spans the overhang.
  const image = frame.getByTestId('spread-frame-image')
  const beside = { x: besidePage.x - p.x, y: besidePage.y - p.y }
  const [before] = await pixelsAt(image, [beside])
  await expect(frame.getByTestId('photo-handle').first()).toBeHidden()
  expect(await hitAt(page, besidePage)).not.toBe('photo-extent')

  await showLayer(page, frame)
  await expect(frame.getByTestId('photo-handle')).toHaveCount(4)
  for (const handle of await frame.getByTestId('photo-handle').all()) {
    await expect(handle).toBeVisible()
  }
  // The ghost paints the photo (teal at .3) beside the frame.
  await expect
    .poll(async () => {
      const [after] = await pixelsAt(image, [beside])
      return after?.some((v, k) => Math.abs(v - (before?.[k] ?? 0)) > 8)
    })
    .toBe(true)
  const layerLook = await frame.evaluate((el) => {
    const css = (testId: string) =>
      getComputedStyle(el.querySelector(`[data-testid="${testId}"]`) ?? el)
    const handle = css('photo-handle')
    return {
      ghostOpacity: css('photo-ghost').opacity,
      extentShadow: css('photo-extent').boxShadow,
      extentCursor: css('photo-extent').cursor,
      handle: [handle.width, handle.height, handle.borderTopLeftRadius],
      handleBackground: handle.backgroundColor,
      handleShadow: handle.boxShadow,
      cursors: [...el.querySelectorAll('[data-testid="photo-handle"]')].map(
        (h) => getComputedStyle(h).cursor,
      ),
    }
  })
  // Kit: ghost .3; extent 0 0 0 1px rgb(255 255 255 / .9), 0 0 0 2px
  // rgb(0 0 0 / .28); 12 px round --paper handles, 1.5px --crop ring +
  // 0 1px 2px rgb(0 0 0 / .25); corner resize cursors.
  expect(layerLook).toEqual({
    ghostOpacity: '0.3',
    extentShadow:
      'color(srgb 1 1 1 / 0.9) 0px 0px 0px 1px, rgba(0, 0, 0, 0.28) 0px 0px 0px 2px',
    extentCursor: 'move',
    handle: ['12px', '12px', '50%'],
    handleBackground: 'rgb(255, 255, 255)',
    handleShadow:
      'rgb(107, 105, 106) 0px 0px 0px 1.5px, rgba(0, 0, 0, 0.25) 0px 1px 2px 0px',
    cursors: ['nwse-resize', 'nesw-resize', 'nesw-resize', 'nwse-resize'],
  })

  // Hit order: photo handle → frame handle → grabber → ghost → frame body.
  expect(await hitAt(page, centre(await box(grabber)))).toBe('crop-grabber')
  // The w frame handle sits over the ghost (the photo hangs out there).
  const w = await box(frame.locator('[data-handle="w"]'))
  expect(await hitAt(page, centre(w))).toBe('sel-handle')
  // The sw photo corner sits on the frame's bottom edge, over its s side.
  const sw = await box(frame.locator('[data-photo-handle="sw"]'))
  expect(await hitAt(page, inward(sw, f))).toBe('photo-handle')
  expect(await hitAt(page, besidePage)).toBe('photo-extent')

  // Away from the photo: the layer hides again (400 ms).
  await page.mouse.move(f.x + f.width / 2, p.y + p.height + 60)
  await expect(frame.getByTestId('photo-layer')).not.toHaveAttribute(
    'data-shown',
    'true',
  )
  expect(await hitAt(page, besidePage)).not.toBe('photo-extent')
  await assertDocumentFitsViewport(page)
})

test('an edge drag crops: the photo keeps its page rect; one undo', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const frame = await selectedPhotoFrame(page)
  const f0 = await box(frame)
  const p0 = await photo(frame)
  const w = centre(await box(frame.locator('[data-handle="w"]')))
  await drag(page, w, { x: w.x + 120, y: w.y })
  const f1 = await box(frame)
  expect(f1.width).toBeLessThan(f0.width - 100)
  expectNear(await photo(frame), p0)
  const s = centre(await box(frame.locator('[data-handle="s"]')))
  await drag(page, s, { x: s.x, y: s.y - 80 })
  expect((await box(frame)).height).toBeLessThan(f0.height - 60)
  expectNear(await photo(frame), p0)
  await undo(page)
  expectNear(await box(frame), f1)
  expectNear(await photo(frame), p0)
  await undo(page)
  expectNear(await box(frame), f0)
  expectNear(await photo(frame), p0)
})

test('the grabber pans the photo; the tag shows and frame handles hide meanwhile; one undo', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const frame = await selectedPhotoFrame(page)
  const p0 = await photo(frame)
  const g = centre(await box(frame.getByTestId('crop-grabber')))
  await drag(page, g, { x: g.x + 40, y: g.y }, async () => {
    await expect(frame).toHaveAttribute('data-photo-gesture', 'pan')
    const tag = frame.getByTestId('photo-crop-tag')
    await expect(tag).toHaveText('Crop · 100%')
    await expect(tag).toBeVisible()
    await expect(frame.getByTestId('spread-frame-handles')).toBeHidden()
    await expect(frame.getByTestId('photo-ghost')).toBeVisible()
  })
  await expect(frame).not.toHaveAttribute('data-photo-gesture')
  await expect(frame.getByTestId('photo-crop-tag')).toBeHidden()
  const p1 = await photo(frame)
  expect(Math.abs(p1.x - (p0.x + 40))).toBeLessThanOrEqual(1)
  expect(Math.abs(p1.y - p0.y)).toBeLessThanOrEqual(0.5)
  // Dragging on the shown ghost (beside the frame, clear of the w handle)
  // pans too.
  await showLayer(page, frame)
  const f = await box(frame)
  const from = { x: f.x - 30, y: f.y + f.height / 2 }
  await page.mouse.move(from.x, from.y, { steps: 4 })
  await drag(page, from, { x: from.x - 20, y: from.y })
  expect(Math.abs((await photo(frame)).x - (p1.x - 20))).toBeLessThanOrEqual(1)
  await undo(page)
  expectNear(await photo(frame), p1, 1)
  await undo(page)
  expectNear(await photo(frame), p0, 1)
})

test('a photo corner scales aspect-locked about the opposite corner', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const frame = await selectedPhotoFrame(page)
  const f = await box(frame)
  const p0 = await photo(frame)
  await showLayer(page, frame)
  const handle = frame.locator('[data-photo-handle="sw"]')
  const sw = inward(await box(handle), f)
  await page.mouse.move(sw.x, sw.y, { steps: 4 })
  await drag(page, sw, { x: sw.x - 60, y: sw.y + 40 }, async () => {
    await expect(handle).toHaveAttribute('data-active', 'true')
    await expect(frame.getByTestId('photo-crop-tag')).toHaveText(
      /Crop · 1\d\d%/,
    )
  })
  const p1 = await photo(frame)
  expect(p1.width).toBeGreaterThan(p0.width + 40)
  expect(p1.width / p1.height).toBeCloseTo(p0.width / p0.height, 2)
  // The ne photo corner stayed on the page.
  expect(Math.abs(p1.x + p1.width - (p0.x + p0.width))).toBeLessThanOrEqual(0.5)
  expect(Math.abs(p1.y - p0.y)).toBeLessThanOrEqual(0.5)
  await undo(page)
  expectNear(await photo(frame), p0)
})

test('a Fit photo grown past cover switches to Fill in the inspector; one undo', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const frame = await selectedPhotoFrame(page)
  await openRightPanel(page)
  await expandDisclosure(page, 'Fit & crop')
  const fit = page.getByRole('radiogroup', { name: 'Photo fit' })
  await fit.locator('label', { hasText: 'Fit' }).click()
  await expect(fit.getByRole('radio', { name: 'Fit' })).toBeChecked()
  const f = await box(frame)
  // Fit letterboxes the 3:2 photo in the square frame.
  const contained = await photo(frame)
  expect(contained.height).toBeLessThan(f.height - 40)
  await showLayer(page, frame)
  const corner = async () =>
    inward(await box(frame.locator('[data-photo-handle="sw"]')), f)
  // A small grow stays Fit.
  const sw = await corner()
  await page.mouse.move(sw.x, sw.y, { steps: 4 })
  await drag(page, sw, { x: sw.x - 30, y: sw.y + 20 })
  await expect(fit.getByRole('radio', { name: 'Fit' })).toBeChecked()
  expect((await photo(frame)).width).toBeGreaterThan(contained.width + 10)
  // Past cover: Fill, in one undo step.
  await showLayer(page, frame)
  const sw2 = await corner()
  await page.mouse.move(sw2.x, sw2.y, { steps: 4 })
  await drag(page, sw2, { x: sw2.x - 300, y: sw2.y + 200 })
  await expect(fit.getByRole('radio', { name: 'Fill' })).toBeChecked()
  expect((await photo(frame)).height).toBeGreaterThan(f.height)
  await undo(page)
  await expect(fit.getByRole('radio', { name: 'Fit' })).toBeChecked()
})

test('an empty selected frame has no grabber or photo layer', async ({
  page,
}) => {
  await openSessionEditor(page)
  const empty = page
    .locator('[data-testid="spread-frame"][data-filled="false"]')
    .first()
  await empty.click()
  await expect(empty).toHaveAttribute('aria-pressed', 'true')
  await expect(empty.getByTestId('sel-handle')).toHaveCount(8)
  await expect(empty.getByTestId('crop-grabber')).toHaveCount(0)
  await expect(empty.getByTestId('photo-layer')).toHaveCount(0)
})
