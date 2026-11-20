import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Designer walkthrough-ux-review §A (direct crop), kit `#/demo` part: on a
// selected photo frame the frame handles crop (the photo stays on the page),
// a centre grabber pans, round photo corner handles scale, the outside part
// shows at 30 %. Double-click pins the layer (Crop · N%, no frame handles).

test.use({ viewport: { width: 1440, height: 900 } })

const DEMO = '[data-testid="demo"]'
const FRAME = `${DEMO} [data-testid="canvas"] [data-current] [data-testid="frame"]`

interface Box {
  x: number
  y: number
  width: number
  height: number
}

interface DemoApi {
  reset: () => void
}

/** #/demo: a new book, the photo folder, a photo dropped in spread 1's first frame, frame selected */
async function photoFrame(page: Page): Promise<Locator> {
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: DemoApi }).__demo.reset()
  })
  const c = (sel: string) => page.locator(sel).first().click()
  await c('[data-testid="create-library"]')
  await c('[data-testid="picker-select"]')
  await c(`${DEMO} [data-testid="new-book"]`)
  await page.locator('[role=dialog] input').first().fill('Lake trip')
  await c('[data-testid="create-book"]')
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await c('[data-testid="demo-add-folder"]')
  await page
    .locator('[role=dialog]')
    .getByRole('button', { name: /Choose|Select|Use|Add/i })
    .last()
    .click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await c('[data-item="p1"]')
  const frame = page.locator(FRAME).first()
  await page
    .locator('[data-testid="filmstrip"] [role="row"]')
    .nth(5)
    .dragTo(frame)
  await expect(frame.locator('img')).toHaveCount(1)
  // the drop selects the frame; its grabber appears under the resting pointer and shows the photo layer
  // until the pointer leaves (400 ms)
  await expect(page.getByTestId('crop-grabber')).toBeVisible()
  await page.mouse.move(5, 5)
  await expect(page.getByTestId('photo-handle')).toHaveCount(0)
  return frame
}

const box = async (l: Locator): Promise<Box> => {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}
const centre = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })
const photo = (frame: Locator) => box(frame.locator('img').first())

/** the testid of the topmost painted element at a point, and of every element under it */
function stackAt(page: Page, p: { x: number; y: number }) {
  return page.evaluate(
    ({ x, y }) =>
      document
        .elementsFromPoint(x, y)
        .map((e) => e.getAttribute('data-testid') ?? e.tagName.toLowerCase()),
    p,
  )
}

async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  mods: ('Shift' | 'Alt')[] = [],
) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (const m of mods) await page.keyboard.down(m)
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
  for (const m of mods) await page.keyboard.up(m)
}

const handle = (page: Page, h: string) =>
  page.locator(`[data-testid="sel-handle"][data-handle="${h}"]`)
const photoHandle = (page: Page, c: string) =>
  page.locator(`[data-testid="photo-handle"][data-corner="${c}"]`)

/** centres of the photo handles inside the viewport */
async function onScreenPhotoHandles(page: Page) {
  const v = await box(page.locator(`${DEMO} [data-testid="canvas"]`))
  const out: { x: number; y: number; corner: string }[] = []
  for (const b of await page.getByTestId('photo-handle').all()) {
    const p = centre(await box(b))
    const corner = (await b.getAttribute('data-corner')) ?? ''
    if (p.x > v.x && p.y > v.y && p.x < v.x + v.width && p.y < v.y + v.height)
      out.push({ ...p, corner })
  }
  return out
}

/** does the photo overflow the frame more across (true) or down (false)? */
async function wide(frame: Locator) {
  const img = await photo(frame)
  const f = await box(frame)
  return img.width - f.width > img.height - f.height
}

/** frame-crop out to the photo's own rect along its overflow axis: every photo corner then sits on a frame corner */
async function cropToPhoto(page: Page, frame: Locator) {
  const img = await photo(frame)
  const across = await wide(frame)
  // Alt: no snapping, the edges land on the photo's
  const a = centre(await box(handle(page, across ? 'w' : 'n')))
  await drag(page, a, across ? { x: img.x, y: a.y } : { x: a.x, y: img.y }, [
    'Alt',
  ])
  const b = centre(await box(handle(page, across ? 'e' : 's')))
  await drag(
    page,
    b,
    across
      ? { x: img.x + img.width, y: b.y }
      : { x: b.x, y: img.y + img.height },
    ['Alt'],
  )
}

const OUT: Record<string, readonly [number, number]> & {
  se: readonly [number, number]
} = {
  nw: [-1, -1],
  ne: [1, -1],
  sw: [-1, 1],
  se: [1, 1],
}
/** drag the first on-screen photo corner `px` outward (negative: inward) on both axes */
async function scaleCorner(page: Page, px: number) {
  const [p] = await onScreenPhotoHandles(page)
  if (!p) throw new Error('no photo corner on the canvas')
  const [sx, sy] = OUT[p.corner] ?? OUT.se
  // the pointer stays in the viewport (moves outside it are not delivered)
  const to = (v: number, max: number) => Math.min(max - 2, Math.max(2, v))
  await drag(page, p, {
    x: to(p.x + sx * px, 1440),
    y: to(p.y + sy * px, 900),
  })
}

/** one arrow press along the overflow axis; returns the photo's move (px) along it */
async function nudgeAlongOverflow(page: Page, frame: Locator) {
  const img = await photo(frame)
  const across = await wide(frame)
  await page.keyboard.press(across ? 'ArrowRight' : 'ArrowDown')
  const img2 = await photo(frame)
  return across ? img2.x - img.x : img2.y - img.y
}

/** hover the grabber: the photo layer shows */
async function showLayer(page: Page) {
  await page.getByTestId('crop-grabber').hover()
  await expect(page.getByTestId('photo-handle')).toHaveCount(4)
}

test.describe('kit direct crop (Designer walkthrough-ux-review §A)', () => {
  test('grabber painted at the visible photo centre; an edge handle crops and the photo stays put', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const frame = await photoFrame(page)
    const f = await box(frame)
    const img = await photo(frame)
    const g = centre(await box(page.getByTestId('crop-grabber')))
    const vis = {
      x:
        (Math.max(f.x, img.x) + Math.min(f.x + f.width, img.x + img.width)) / 2,
      y:
        (Math.max(f.y, img.y) + Math.min(f.y + f.height, img.y + img.height)) /
        2,
    }
    expect(Math.abs(g.x - vis.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(g.y - vis.y)).toBeLessThanOrEqual(1)
    // paint: the grabber is the topmost element at its centre
    expect((await stackAt(page, g))[0]).toBe('crop-grabber')
    // no photo layer until hover
    await expect(page.getByTestId('photo-handle')).toHaveCount(0)

    // drag the e handle 120 px in: the frame narrows, the image page rect is unchanged (still covering in Fill)
    const e = centre(await box(handle(page, 'e')))
    await drag(page, e, { x: e.x - 120, y: e.y })
    const f2 = await box(frame)
    expect(f2.width).toBeLessThan(f.width - 100) // 120 px less a snap
    const img2 = await photo(frame)
    for (const k of ['x', 'y', 'width', 'height'] as const)
      expect(Math.abs(img2[k] - img[k]), k).toBeLessThanOrEqual(0.5)
    expect(img2.x).toBeLessThanOrEqual(f2.x + 0.5)
    expect(img2.x + img2.width).toBeGreaterThanOrEqual(f2.x + f2.width - 0.5)
    // one step: undo restores the frame
    await page.keyboard.press('Control+z')
    await expect
      .poll(async () => Math.round((await box(frame)).width))
      .toBe(Math.round(f.width))
  })

  test('grabber hover shows the photo layer; hit order; corner scale keeps the aspect, min cover in Fill, Fit grows into Fill', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const frame = await photoFrame(page)
    await showLayer(page)
    const opacity = await page
      .locator('[data-testid="photo-layer"] img')
      .evaluate((el) => getComputedStyle(el).opacity)
    expect(opacity).toBe('0.3')
    await expect(page.getByTestId('photo-ghost')).toBeVisible()
    // hit order: photo handle → frame handle → grabber → ghost
    const corners = await onScreenPhotoHandles(page)
    expect(corners.length).toBeGreaterThan(0)
    for (const p of corners)
      expect((await stackAt(page, p))[0]).toBe('photo-handle')
    const mid = centre(await box(handle(page, 'n')))
    expect((await stackAt(page, mid))[0]).toBe('sel-handle')
    // the ghost takes the press over the frame body while the layer shows
    const f = await box(frame)
    const g = centre(await box(page.getByTestId('crop-grabber')))
    const body = { x: g.x, y: (f.y + g.y) / 2 }
    expect((await stackAt(page, body))[0]).toBe('photo-ghost')

    // the layer hides 400 ms after the pointer leaves the photo by > 12 px
    await page.mouse.move(5, 5)
    await expect(page.getByTestId('photo-handle')).toHaveCount(0)
    await expect(page.getByTestId('photo-ghost')).toHaveCount(0)

    // corner scale: aspect locked, grows
    await showLayer(page)
    const img = await photo(frame)
    await scaleCorner(page, 80)
    const big = await photo(frame)
    expect(big.width).toBeGreaterThan(img.width + 40)
    expect(
      Math.abs(big.width / big.height / (img.width / img.height) - 1),
    ).toBeLessThan(0.005)
    // below cover is not allowed in Fill: a big inward drag stops at cover
    await showLayer(page)
    await scaleCorner(page, -600)
    const min = await photo(frame)
    const fr = await box(frame)
    expect(min.width).toBeGreaterThanOrEqual(fr.width - 0.5)
    expect(min.height).toBeGreaterThanOrEqual(fr.height - 0.5)
    expect(
      Math.min(min.width - fr.width, min.height - fr.height),
    ).toBeLessThanOrEqual(0.5)

    // Fit: the photo sits inside; growing past cover switches the inspector to Fill
    const fit = page.getByRole('radio', { name: 'Fit', exact: true })
    await fit.click()
    await expect(fit).toBeChecked()
    await showLayer(page)
    await scaleCorner(page, 400)
    await expect(
      page.getByRole('radio', { name: 'Fill', exact: true }),
    ).toBeChecked()
  })

  test('photo handle over frame handle where they overlap', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const frame = await photoFrame(page)
    await cropToPhoto(page, frame)
    await showLayer(page)
    const ne = centre(await box(photoHandle(page, 'ne')))
    const fne = centre(await box(handle(page, 'ne')))
    expect(Math.hypot(ne.x - fne.x, ne.y - fne.y)).toBeLessThanOrEqual(3)
    const stack = await stackAt(page, ne)
    expect(stack[0]).toBe('photo-handle')
    expect(stack).toContain('sel-handle')
  })

  test('rotate chip shows the angle; Shift snaps to 15°; 0/90 snap within 2°', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const frame = await photoFrame(page)
    // shrink the frame so the knob and its circle stay on screen
    const se = centre(await box(handle(page, 'se')))
    const f0 = await box(frame)
    await drag(page, se, { x: f0.x + 300, y: f0.y + 260 })
    const f = await box(frame)
    const c = centre(f)
    const at = (deg: number) => {
      const t = (deg * Math.PI) / 180
      return { x: c.x + 150 * Math.sin(t), y: c.y - 150 * Math.cos(t) }
    }
    const knob = centre(await box(page.locator('[data-handle="rot"]')))
    await page.mouse.move(knob.x, knob.y)
    await page.mouse.down()
    await page.mouse.move(at(40).x, at(40).y, { steps: 8 })
    const chip = page.getByTestId('rotate-chip')
    await expect(chip).toHaveText('40°')
    await page.keyboard.down('Shift')
    await page.mouse.move(at(41).x, at(41).y)
    await expect(chip).toHaveText('45°')
    await page.keyboard.up('Shift')
    await page.mouse.move(at(91.5).x, at(91.5).y, { steps: 4 })
    await expect(chip).toHaveText('90°')
    await page.mouse.up()
    await expect(chip).toHaveCount(0)
  })

  test('pinned: frame handles hidden, photo handles + grabber, Tab cycles them, arrows nudge 1 px, Esc exits', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const frame = await photoFrame(page)
    // the grabber sits on the frame centre: a double-click there pins, as on the frame
    await page.getByTestId('crop-grabber').dblclick()
    await expect(page.getByTestId('crop-tag')).toHaveText(/^Crop · \d+%$/)
    await expect(page.getByTestId('sel-handle')).toHaveCount(0)
    await expect(page.getByTestId('photo-handle')).toHaveCount(4)
    await expect(page.getByTestId('crop-grabber')).toBeVisible()
    // the pinned layer stays with the pointer far away
    await page.mouse.move(5, 5)
    await page.evaluate(() => new Promise((r) => setTimeout(r, 600)))
    await expect(page.getByTestId('photo-handle')).toHaveCount(4)

    const seen: string[] = []
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
      seen.push(
        await page.evaluate(
          () => document.activeElement?.getAttribute('data-corner') ?? '',
        ),
      )
    }
    expect(seen).toEqual(['nw', 'ne', 'sw', 'se', 'nw'])
    // under load the first read can come before the focus-visible style settles
    await expect
      .poll(() =>
        photoHandle(page, 'nw').evaluate((el) => {
          const s = getComputedStyle(el)
          return [
            s.outlineStyle,
            s.outlineWidth,
            s.outlineColor,
            s.outlineOffset,
          ]
        }),
      )
      .toEqual(['solid', '2px', 'rgb(58, 56, 57)', '2px'])

    // arrows nudge the photo 1 screen px along its overflow axis
    const d = await nudgeAlongOverflow(page, frame)
    expect(Math.abs(d - 1)).toBeLessThanOrEqual(0.2)

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('crop-tag')).toHaveCount(0)
    await expect(page.getByTestId('sel-handle')).toHaveCount(8)
  })

  test('small frames: < 64 px no grabber, < 40 px side hides its mid handles', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const frame = await photoFrame(page)
    const f = await box(frame)
    const se = centre(await box(handle(page, 'se')))
    await drag(page, se, { x: f.x + 56, y: f.y + 120 })
    await expect(page.getByTestId('crop-grabber')).toHaveCount(0)
    await expect(page.getByTestId('sel-handle')).toHaveCount(8)
    const se2 = centre(await box(handle(page, 'se')))
    await drag(page, se2, { x: f.x + 32, y: f.y + 120 })
    await expect(page.getByTestId('sel-handle')).toHaveCount(6)
    await expect(handle(page, 'n')).toHaveCount(0)
    await expect(handle(page, 's')).toHaveCount(0)
    await expect(handle(page, 'e')).toHaveCount(1)
  })
})
