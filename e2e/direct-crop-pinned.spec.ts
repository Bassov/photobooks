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
 * Designer walkthrough-ux-review §A, direct crop part 2 (kit `#/demo` step
 * editor-crop-mode; uikit/src/sandbox/canvas.tsx FrameChrome): the rotate
 * chip, the pinned crop (double-click) and small-frame chrome.
 *
 * The Full bleed frame touches the page top, where the spread clips the
 * rotate knob, so each test first sizes the frame into the page middle with
 * the inspector's Position & size fields.
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

const mmOf = (text: string) => Number.parseFloat(text.replace(',', '.'))

async function setMm(page: Page, name: string, mm: number): Promise<void> {
  const field = page.getByRole('textbox', { name, exact: true })
  await field.fill(mm.toFixed(1))
  await field.press('Enter')
  await expect
    .poll(async () => Math.abs(mmOf(await field.inputValue()) - mm))
    .toBeLessThan(0.11)
}

/**
 * The 3:2 teal sample in a selected page-1 frame, resized to `size(frame px
 * per mm, full-bleed mm)` mm and centred on the full-bleed frame.
 */
async function sizedPhotoFrame(
  page: Page,
  size: (
    pxPerMm: number,
    full: { width: number; height: number },
  ) => { width: number; height: number } = (_, full) => ({
    width: full.width / 2,
    height: full.height / 2,
  }),
): Promise<{ frame: Locator; pxPerMm: number }> {
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
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
  await expandDisclosure(page, 'Position & size')
  const read = async (name: string) =>
    mmOf(await page.getByRole('textbox', { name, exact: true }).inputValue())
  const full = { width: await read('Width'), height: await read('Height') }
  const x = await read('X')
  const y = await read('Y')
  const pxPerMm = (await box(frame)).width / full.width
  const next = size(pxPerMm, full)
  await setMm(page, 'Width', next.width)
  await setMm(page, 'Height', next.height)
  await setMm(page, 'X', x + (full.width - next.width) / 2)
  await setMm(page, 'Y', y + (full.height - next.height) / 2)
  await expect(frame).toHaveAttribute('aria-pressed', 'true')
  // Leave the photo: the layer is hover-only until pinned.
  const f = await box(frame)
  await page.mouse.move(f.x - 80, f.y + f.height + 80, { steps: 3 })
  // The layer hides 400 ms after the pointer leaves; until then its photo
  // handles take the hits over the frame handles.
  await expect(
    frame.locator('[data-testid="photo-layer"][data-shown="true"]'),
  ).toHaveCount(0)
  return { frame, pxPerMm }
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

/**
 * Waits until the canvas camera is still: the frame rect and the
 * pasteboard-scroll offsets read the same on two polls in a row.
 */
async function cameraSettled(page: Page, frame: Locator): Promise<void> {
  const scroll = page.getByTestId('pasteboard-scroll')
  const read = async () => {
    const f = await box(frame)
    const s = await scroll.evaluate((el) => [el.scrollLeft, el.scrollTop])
    return [f.x, f.y, f.width, f.height, ...s].map(Math.round).join(',')
  }
  let last = ''
  await expect
    .poll(
      async () => {
        const now = await read()
        const still = now === last
        last = now
        return still
      },
      { intervals: [100] },
    )
    .toBe(true)
}

/** A CSS colour (e.g. `var(--crop)`) resolved to `rgb(…)` in the page. */
function resolvedColour(page: Page, css: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.body.appendChild(document.createElement('span'))
    probe.style.color = value
    const rgb = getComputedStyle(probe).color
    probe.remove()
    return rgb
  }, css)
}

const rgbOf = (css: string): number[] =>
  (css.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number)

/** Frame rotation (deg) from its committed inline transform. */
async function rotationOf(frame: Locator): Promise<number> {
  const transform = await frame.evaluate((el) => el.style.transform)
  const match = /rotate\((-?[\d.]+)deg\)/.exec(transform)
  return match === null ? 0 : Number(match[1])
}

/**
 * Press the knob, sweep the pointer to `deg` clockwise from straight up about
 * the frame centre, run `during`, then release.
 */
async function rotateTo(
  page: Page,
  frame: Locator,
  deg: number,
  options: { shift?: boolean; during?: () => Promise<void> },
): Promise<void> {
  const knob = centre(await box(frame.getByTestId('rotate-knob')))
  const c = centre(await box(frame))
  const r = Math.hypot(knob.x - c.x, knob.y - c.y) + 20
  const at = (a: number): Point => ({
    x: c.x + r * Math.sin((a * Math.PI) / 180),
    y: c.y - r * Math.cos((a * Math.PI) / 180),
  })
  await page.mouse.move(knob.x, knob.y)
  await page.mouse.down()
  if (options.shift === true) {
    await page.keyboard.down('Shift')
  }
  for (const step of [0.25, 0.5, 0.75, 1]) {
    const p = at(deg * step)
    await page.mouse.move(p.x, p.y)
  }
  await options.during?.()
  await page.mouse.up()
  if (options.shift === true) {
    await page.keyboard.up('Shift')
  }
}

const undo = (page: Page) =>
  page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')

test('rotate chip: angle in a crop-tag chip 10 px right of the knob, screen px at two zooms', async ({
  page,
}) => {
  const { frame } = await sizedPhotoFrame(page)
  const knob = frame.getByTestId('rotate-knob')
  const chip = frame.getByTestId('rotate-chip')
  // Kit look: 12 px round knob above the frame, hit-testable; no chip at rest.
  const k = await box(knob)
  expect(k.width).toBeCloseTo(12, 0)
  expect(await hitAt(page, centre(k))).toBe('rotate-knob')
  await expect(chip).toBeHidden()
  await expectChipBesideKnob(page, frame)
  await page.getByTestId('zoom-in').click()
  await expect(page.getByTestId('zoom-label')).not.toHaveText('Fit')
  await expect(frame).toHaveAttribute('aria-pressed', 'true')
  await expectChipBesideKnob(page, frame)
})

/**
 * Drags the knob straight up (0°: no turn, boxes stay axis-aligned) and
 * checks the chip while it is held, then releases (no turn committed).
 */
async function expectChipBesideKnob(page: Page, frame: Locator) {
  const knob = frame.getByTestId('rotate-knob')
  const chip = frame.getByTestId('rotate-chip')
  const field = rgbOf(await resolvedColour(page, 'var(--field)'))
  // The crop tag's radius token (kit rounded-md).
  const radius = await page.evaluate(() => {
    const probe = document.body.appendChild(document.createElement('span'))
    probe.style.borderRadius = 'var(--radius-md)'
    const value = getComputedStyle(probe).borderTopLeftRadius
    probe.remove()
    return value
  })
  await rotateTo(page, frame, 0, {
    during: async () => {
      await expect(chip).toBeVisible()
      await expect(chip).toHaveText('0°')
      const knobBox = await box(knob)
      const chipBox = await box(chip)
      expect(knobBox.width).toBeCloseTo(12, 0)
      expect(
        Math.abs(chipBox.x - (knobBox.x + knobBox.width) - 10),
      ).toBeLessThanOrEqual(1)
      expect(Math.abs(chipBox.height - 16)).toBeLessThanOrEqual(0.5)
      // Vertically centred on the knob.
      expect(
        Math.abs(centre(chipBox).y - centre(knobBox).y),
      ).toBeLessThanOrEqual(1)
      const style = await chip.evaluate((el) => {
        const s = getComputedStyle(el)
        return {
          size: s.fontSize,
          weight: s.fontWeight,
          line: s.lineHeight,
          radius: s.borderTopLeftRadius,
        }
      })
      expect(style).toEqual({
        size: '11px',
        weight: '600',
        line: '16px',
        radius,
      })
      // Paint: the chip's left padding is the field fill.
      const [px] = await pixelsAt(chip, [{ x: 2, y: 8 }])
      for (const [i, v] of field.entries()) {
        expect(Math.abs((px?.[i] ?? -99) - v)).toBeLessThanOrEqual(3)
      }
    },
  })
  await expect(chip).toBeHidden()
  expect(await rotationOf(frame)).toBe(0)
}

test('rotate: Shift lands on 15° steps, 88° snaps to 90°, one undo each', async ({
  page,
}) => {
  const { frame } = await sizedPhotoFrame(page)
  const chip = frame.getByTestId('rotate-chip')
  await rotateTo(page, frame, 37, {
    shift: true,
    during: async () => {
      await expect(chip).toHaveText(/^-?\d+°$/)
    },
  })
  await expect.poll(() => rotationOf(frame)).not.toBe(0)
  const stepped = await rotationOf(frame)
  expect(stepped % 15).toBe(0)
  expect([30, 45]).toContain(stepped)
  await undo(page)
  await expect.poll(() => rotationOf(frame)).toBe(0)
  await rotateTo(page, frame, 88, {
    during: async () => {
      await expect(chip).toHaveText('90°')
    },
  })
  await expect.poll(() => rotationOf(frame)).toBe(90)
  await expect(chip).toBeHidden()
  await undo(page)
  await expect.poll(() => rotationOf(frame)).toBe(0)
})

test('pinned crop: 2 px --crop outline, photo handles over hidden frame handles, Tab order, arrow nudges, wheel zoom', async ({
  page,
}) => {
  const { frame } = await sizedPhotoFrame(page)
  const image = frame.getByTestId('spread-frame-image')
  const tag = frame.getByTestId('crop-overlay-tag')
  // Unpinned: the wheel over the frame drives the canvas camera; the photo
  // keeps its size in the frame (no crop zoom).
  const cropRatio = async () =>
    (await box(image)).width / (await box(frame)).width
  const ratio0 = await cropRatio()
  const before = await box(image)
  await page.mouse.move(centre(before).x, centre(before).y)
  // A small zoom step keeps the frame clear of the inspector edge.
  await page.mouse.wheel(0, -100)
  await expect(page.getByTestId('zoom-label')).not.toHaveText('Fit')
  await cameraSettled(page, frame)
  await expect(frame).not.toHaveAttribute('data-crop-active', 'true')
  await expect(tag).toHaveCount(0)
  await expect
    .poll(async () => Math.abs((await cropRatio()) - ratio0))
    .toBeLessThan(0.005)

  const f = await box(frame)
  const nw: Point = { x: f.x, y: f.y }
  expect(await hitAt(page, nw)).toBe('sel-handle')
  await frame.dblclick({ position: { x: 12, y: f.height - 12 } })
  await expect(frame).toHaveAttribute('data-crop-active', 'true')
  await expect(tag).toHaveText('Crop · 100%')
  // 2 px --crop outline on the frame ring.
  const crop = await resolvedColour(page, 'var(--crop)')
  const ring = await frame.evaluate((el) => {
    const s = getComputedStyle(el, '::after')
    return {
      width: s.outlineWidth,
      style: s.outlineStyle,
      color: s.outlineColor,
    }
  })
  expect(ring).toEqual({ width: '2px', style: 'solid', color: crop })
  // Frame handles gone, the photo layer stays: handles, grabber on top.
  await expect(frame.getByTestId('spread-frame-handles')).toHaveCount(0)
  expect(await hitAt(page, nw)).not.toBe('sel-handle')
  await expect(frame.getByTestId('photo-layer')).toHaveAttribute(
    'data-shown',
    'true',
  )
  const handles = frame.getByTestId('photo-handle')
  await expect(handles).toHaveCount(4)
  await cameraSettled(page, frame)
  const port = await box(page.getByTestId('pasteboard-scroll'))
  for (const handle of await handles.all()) {
    const c = centre(await box(handle))
    // The camera keeps every handle in the visible canvas, not under a panel.
    expect(c.x).toBeGreaterThan(port.x)
    expect(c.x).toBeLessThan(port.x + port.width)
    expect(c.y).toBeGreaterThan(port.y)
    expect(c.y).toBeLessThan(port.y + port.height)
    expect(await hitAt(page, c)).toBe('photo-handle')
  }
  const grabber = frame.getByTestId('crop-grabber')
  expect(await hitAt(page, centre(await box(grabber)))).toBe('crop-grabber')

  // Tab cycles the 4 photo handles with the kit focus ring.
  // The setup typed in the inspector, where Tab stays with the fields.
  await frame.focus()
  const order: (string | null)[] = []
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press('Tab')
    order.push(
      await page.evaluate(
        () => document.activeElement?.getAttribute('data-photo-handle') ?? null,
      ),
    )
  }
  expect(order).toEqual(['nw', 'ne', 'sw', 'se', 'nw'])
  const focusRing = await page.evaluate(() => {
    const el = document.activeElement
    if (el === null) return null
    const s = getComputedStyle(el)
    return {
      width: s.outlineWidth,
      style: s.outlineStyle,
      color: s.outlineColor,
      offset: s.outlineOffset,
    }
  })
  expect(focusRing).toEqual({
    width: '2px',
    style: 'solid',
    color: 'rgb(58, 56, 57)',
    offset: '2px',
  })
  await expect(frame).toHaveAttribute('data-crop-active', 'true')

  // Arrows nudge the photo 1 screen px (Shift 10), one undo step each.
  const p0 = await box(image)
  await page.keyboard.press('ArrowRight')
  await expect
    .poll(async () => (await box(image)).x - p0.x)
    .toBeGreaterThan(0.5)
  expect(Math.abs((await box(image)).x - p0.x - 1)).toBeLessThanOrEqual(0.5)
  const p1 = await box(image)
  await page.keyboard.press('Shift+ArrowRight')
  await expect.poll(async () => (await box(image)).x - p1.x).toBeGreaterThan(5)
  expect(Math.abs((await box(image)).x - p1.x - 10)).toBeLessThanOrEqual(0.5)
  await undo(page)
  await expect
    .poll(async () => Math.abs((await box(image)).x - p1.x))
    .toBeLessThanOrEqual(0.5)
  await expect(frame).toHaveAttribute('data-crop-active', 'true')

  // Pinned: the wheel over the frame zooms the photo.
  const g = centre(await box(grabber))
  await page.mouse.move(g.x, g.y)
  await page.mouse.wheel(0, -200)
  await expect
    .poll(async () =>
      Number(/(\d+)%/.exec((await tag.textContent()) ?? '')?.[1]),
    )
    .toBeGreaterThan(100)
  await page.keyboard.press('Escape')
  await expect(frame).not.toHaveAttribute('data-crop-active', 'true')
})

/** Hovers the grabber until the photo layer shows. */
async function showLayer(page: Page, frame: Locator): Promise<void> {
  const g = centre(await box(frame.getByTestId('crop-grabber')))
  await page.mouse.move(g.x, g.y)
  await expect(frame.getByTestId('photo-layer')).toHaveAttribute(
    'data-shown',
    'true',
  )
}

/**
 * Two portraits on page 1, the 3:2 sample in the left frame (selected), the
 * empty right frame beside it.
 */
async function photoBesideNeighbour(
  page: Page,
): Promise<{ frame: Locator; neighbour: Locator }> {
  await openSessionEditor(page)
  await page.bringToFront()
  await choosePhotoFolder(page, [photoFixturePaths.samplePng])
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
    timeout: 30_000,
  })
  await applyLayout(page, 'Two portraits', { restorePanel: true })
  await dragPlaceFirstFilmstripItem(page, 0)
  const frame = page.locator('[data-testid="spread-frame"][data-filled="true"]')
  await expect(frame.getByTestId('spread-frame-image')).toHaveCount(1, {
    timeout: 30_000,
  })
  const neighbour = page
    .getByTestId('spread-view')
    .filter({ has: frame })
    .locator('[data-testid="spread-frame"]:not([data-filled="true"])')
  await expect(neighbour).toHaveCount(1)
  if ((await frame.getAttribute('aria-pressed')) !== 'true') {
    await frame.click()
  }
  await expect(frame).toHaveAttribute('aria-pressed', 'true')
  const f = await box(frame)
  await page.mouse.move(f.x + f.width / 2, f.y + f.height + 120, { steps: 4 })
  await expect(frame.getByTestId('photo-layer')).not.toHaveAttribute(
    'data-shown',
    'true',
  )
  return { frame, neighbour }
}

test('hover photo layer sits over the neighbouring frame: 4 handles hit first, ghost painted (M123)', async ({
  page,
}) => {
  const { frame, neighbour } = await photoBesideNeighbour(page)
  const n = await box(neighbour)
  const f0 = await box(frame)
  expect(n.x).toBeGreaterThan(f0.x + f0.width)
  // Probe inside the neighbour, 10 px in from the side facing the photo.
  const probe = { x: 10, y: n.height / 2 }
  const [hidden] = await pixelsAt(neighbour, [probe])

  await showLayer(page, frame)
  // The 3:2 photo overhangs the portrait frame well into the neighbour.
  const ghost = await box(frame.getByTestId('photo-ghost'))
  expect(ghost.x + ghost.width).toBeGreaterThan(n.x + 20)
  const handles = frame.getByTestId('photo-handle')
  await expect(handles).toHaveCount(4)
  const centres = await Promise.all(
    (await handles.all()).map(async (handle) => centre(await box(handle))),
  )
  // ne and se sit over the neighbour.
  expect(centres.filter((c) => c.x > n.x && c.x < n.x + n.width)).toHaveLength(
    2,
  )
  for (const c of centres) {
    expect(await hitAt(page, c)).toBe('photo-handle')
  }
  // Paint: the .3 ghost tints the neighbour's placeholder.
  const [shown] = await pixelsAt(neighbour, [probe])
  const delta = Math.max(
    ...[0, 1, 2].map((i) => Math.abs((shown?.[i] ?? 0) - (hidden?.[i] ?? 0))),
  )
  expect(delta).toBeGreaterThan(10)
  await assertDocumentFitsViewport(page)
})

test('Fill at cover: an inward photo-corner drag leaves the photo still (M125)', async ({
  page,
}) => {
  const { frame } = await sizedPhotoFrame(page)
  const image = frame.getByTestId('spread-frame-image')
  const f = await box(frame)
  const p = await box(image)
  // The 3:2 photo covers the square frame and overhangs on both sides.
  expect(p.x).toBeLessThan(f.x - 20)
  await showLayer(page, frame)
  const se = centre(
    await box(
      frame.locator('[data-testid="photo-handle"][data-photo-handle="se"]'),
    ),
  )
  await page.mouse.move(se.x, se.y)
  await page.mouse.down()
  for (const step of [0.25, 0.5, 0.75, 1]) {
    await page.mouse.move(se.x - 50 * step, se.y - 50 * step)
  }
  await page.mouse.up()
  const after = await box(image)
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(after[key] - p[key])).toBeLessThanOrEqual(0.5)
  }
  const f1 = await box(frame)
  expect(Math.abs(f1.x - f.x)).toBeLessThanOrEqual(0.5)
})

test('pinned crop: Tab keeps the camera still, one Esc keeps the frame selected, a second deselects (M124, M126)', async ({
  page,
}) => {
  const { frame } = await sizedPhotoFrame(page)
  const scroll = page.getByTestId('pasteboard-scroll')
  await page.getByTestId('zoom-in').click()
  await page.getByTestId('zoom-in').click()
  await expect(page.getByTestId('zoom-label')).not.toHaveText('Fit')
  await frame.dblclick({ position: { x: 12, y: 12 } })
  await expect(frame).toHaveAttribute('data-crop-active', 'true')
  await frame.focus()
  // Scroll the nw photo handle out of the scrollport, past its left edge.
  const nw = frame.locator(
    '[data-testid="photo-handle"][data-photo-handle="nw"]',
  )
  const view = await box(scroll)
  const h = await box(nw)
  await scroll.evaluate(
    (el, by) => {
      el.scrollLeft += by
    },
    h.x + h.width + 10 - view.x,
  )
  await expect
    .poll(async () => (await box(nw)).x + h.width)
    .toBeLessThan(view.x)
  const read = () =>
    scroll.evaluate((el) => [el.scrollLeft, el.scrollTop] as const)
  const s0 = await read()
  const f0 = await box(frame)

  const focused = () =>
    page.evaluate(
      () => document.activeElement?.getAttribute('data-photo-handle') ?? null,
    )
  await page.keyboard.press('Tab')
  await expect.poll(focused).toBe('nw')
  await page.keyboard.press('Tab')
  await expect.poll(focused).toBe('ne')
  expect(await read()).toEqual(s0)
  const f1 = await box(frame)
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(f1[key] - f0[key])).toBeLessThanOrEqual(0.5)
  }

  await page.keyboard.press('Escape')
  await expect(frame).not.toHaveAttribute('data-crop-active', 'true')
  await expect(frame).toHaveAttribute('aria-pressed', 'true')
  await expect(frame.getByTestId('sel-handle')).toHaveCount(8)
  await expect(frame.getByTestId('crop-grabber')).toHaveCount(1)
  await expect(page.getByTestId('inspector-context')).toHaveText('Photo')
  await page.keyboard.press('Escape')
  await expect(frame).not.toHaveAttribute('aria-pressed', 'true')
  await expect(frame.getByTestId('sel-handle')).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})

interface CameraSample {
  x: number
  y: number
  w: number
  crop: boolean
}

/**
 * Records the frame rect on every animation frame until `stop()` (page side),
 * so a one-frame camera jump shows even when the camera settles back.
 */
async function sampleFrameRect(
  frame: Locator,
): Promise<() => Promise<CameraSample[]>> {
  await frame.evaluate((el) => {
    const samples: CameraSample[] = []
    const w = window as unknown as {
      __cameraSamples: CameraSample[]
      __cameraStop: boolean
    }
    w.__cameraSamples = samples
    w.__cameraStop = false
    const tick = () => {
      const r = el.getBoundingClientRect()
      samples.push({
        x: r.x,
        y: r.y,
        w: r.width,
        crop: el.getAttribute('data-crop-active') === 'true',
      })
      if (!w.__cameraStop) {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
  })
  return () =>
    frame.evaluate(() => {
      const w = window as unknown as {
        __cameraSamples: CameraSample[]
        __cameraStop: boolean
      }
      w.__cameraStop = true
      return w.__cameraSamples
    })
}

function sampleAt(samples: CameraSample[], index: number): CameraSample {
  const sample = samples[index]
  if (sample === undefined) {
    throw new Error(`no camera sample ${String(index)}`)
  }
  return sample
}

test('pinned crop right after a wheel zoom: the camera stays where the wheel left it', async ({
  page,
}) => {
  const { frame } = await sizedPhotoFrame(page)
  const at = centre(await box(frame))
  await page.mouse.move(at.x, at.y)
  const stop = await sampleFrameRect(frame)
  // No stillness wait. In one task: a wheel zoom over the frame, its first
  // live paint, then a native scroll of the pasteboard (scrollbar, focus or
  // the click's scroll-into-view) — all inside the 80 ms wheel settle window.
  const moved = await page
    .getByTestId('pasteboard-scroll')
    .evaluate(async (el, p) => {
      el.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: -100,
          clientX: p.x,
          clientY: p.y,
          bubbles: true,
          cancelable: true,
        }),
      )
      await new Promise((resolve) => requestAnimationFrame(resolve))
      const left = el.scrollLeft
      const top = el.scrollTop
      el.scrollLeft += 40
      el.scrollTop += 40
      const by = Math.max(
        Math.abs(el.scrollLeft - left),
        Math.abs(el.scrollTop - top),
      )
      await new Promise((resolve) => requestAnimationFrame(resolve))
      const w = window as unknown as { __cameraSamples: CameraSample[] }
      return {
        by,
        from: w.__cameraSamples.length,
        live: el.querySelector<HTMLElement>('[data-gesture="zoom"]') !== null,
      }
    }, at)
  expect(moved.by).toBeGreaterThan(10)
  // The scroll landed while the wheel zoom was still live.
  expect(moved.live).toBe(true)
  // The pinned crop turns on while that zoom may still be settling.
  // Off the centre grabber, like the outline test (12 px in from the sw corner).
  const f = await box(frame)
  await page.mouse.dblclick(f.x + 12, f.y + f.height - 12)
  await expect(frame).toHaveAttribute('data-crop-active', 'true')
  await expect(page.getByTestId('zoom-label')).not.toHaveText('Fit')
  // Let the settle (80 ms) commit the zoom, then sample 10 more frames.
  await expect(page.getByTestId('pasteboard-world')).not.toHaveAttribute(
    'data-gesture',
    'zoom',
  )
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let left = 10
        const step = () => {
          left -= 1
          if (left === 0) resolve()
          else requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }),
  )
  const samples = await stop()
  // `ref`: the frame painted after the wheel zoom and the native scroll.
  const ref = sampleAt(samples, moved.from - 1)
  expect(ref.w).toBeGreaterThan(sampleAt(samples, 0).w)
  const on = samples.findIndex((s) => s.crop)
  expect(on).toBeGreaterThanOrEqual(moved.from)
  const off = (s: CameraSample) =>
    Math.max(
      Math.abs(s.x - ref.x),
      Math.abs(s.y - ref.y),
      Math.abs(s.w - ref.w),
    )
  // Neither the zoom settle nor the pinned crop moves the camera: every
  // later frame, the one where crop turns on included, stays within 1 px.
  const drift = Math.max(...samples.slice(moved.from - 1).map(off))
  const atCrop = Math.abs(
    off(sampleAt(samples, on)) - off(sampleAt(samples, on - 1)),
  )
  test.info().annotations.push({
    type: 'camera-drift-px',
    description: `max ${drift.toFixed(2)}, crop-on frame ${atCrop.toFixed(2)}`,
  })
  expect(atCrop).toBeLessThanOrEqual(1)
  expect(drift).toBeLessThanOrEqual(1)
  // Every photo handle sits in the visible canvas and takes its own hit.
  const port = await box(page.getByTestId('pasteboard-scroll'))
  for (const handle of await frame.getByTestId('photo-handle').all()) {
    const c = centre(await box(handle))
    expect(c.x).toBeGreaterThan(port.x)
    expect(c.x).toBeLessThan(port.x + port.width)
    expect(await hitAt(page, c)).toBe('photo-handle')
  }
})

test('a 50 × 30 px frame has no grabber and no mid handles on its 30 px sides', async ({
  page,
}) => {
  const { frame } = await sizedPhotoFrame(page, (pxPerMm) => ({
    width: 50 / pxPerMm,
    height: 30 / pxPerMm,
  }))
  const f = await box(frame)
  expect(Math.abs(f.width - 50)).toBeLessThanOrEqual(1)
  expect(Math.abs(f.height - 30)).toBeLessThanOrEqual(1)
  await expect(frame.getByTestId('crop-grabber')).toHaveCount(0)
  const ids = await frame
    .getByTestId('sel-handle')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-handle')))
  expect(ids).toEqual(['nw', 'n', 'ne', 'sw', 's', 'se'])
  // Paint: the left / right edge middles hit the frame body, the corners and
  // the top / bottom middles hit their handles.
  const mid = f.y + f.height / 2
  expect(await hitAt(page, { x: f.x, y: mid })).not.toBe('sel-handle')
  expect(await hitAt(page, { x: f.x + f.width, y: mid })).not.toBe('sel-handle')
  expect(await hitAt(page, { x: f.x + f.width / 2, y: f.y + f.height })).toBe(
    'sel-handle',
  )
  expect(await hitAt(page, { x: f.x, y: f.y + f.height })).toBe('sel-handle')
})

test('photo layer fades in over 120 ms ease-out, at once under reduced motion', async ({
  page,
}) => {
  const { frame } = await sizedPhotoFrame(page)
  const layer = frame.getByTestId('photo-layer')
  const g = centre(await box(frame.getByTestId('crop-grabber')))
  await page.mouse.move(g.x, g.y)
  await expect(layer).toHaveAttribute('data-shown', 'true')
  const transition = () =>
    layer.evaluate((el) => {
      const s = getComputedStyle(el)
      return [
        s.transitionProperty,
        s.transitionDuration,
        s.transitionTimingFunction,
      ]
    })
  expect(await transition()).toEqual(['opacity', '0.12s', 'ease-out'])
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect((await transition())[1]).toBe('0s')
})
