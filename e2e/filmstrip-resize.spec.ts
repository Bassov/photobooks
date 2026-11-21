import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { pixelsAt } from './fixtures/paintProbe'

// Designer walkthrough-ux-review §B "Resizable filmstrip" (prod; kit #645,
// e2e/kit-filmstrip-resize.spec.ts): the dock top edge is a separator; thumb
// height H is `auto` (follows the window height) or 56 .. max px, persisted
// per device in localStorage["photobooks.filmstrip.thumb.v2"].

test.use({ viewport: { width: 1440, height: 900 } })

const V2 = 'photobooks.filmstrip.thumb.v2'

const sep = (page: Page) => page.getByTestId('thumb-resizer')
const pill = (page: Page) => page.getByTestId('thumb-resizer-pill')
const chip = (page: Page) => page.getByTestId('thumb-resizer-chip')
const thumb = (page: Page) =>
  page.getByTestId('filmstrip-item').first().locator('.filmstrip-drag')
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), V2)

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

const thumbH = async (page: Page) => (await box(thumb(page))).height

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

async function editorWithPhotos(page: Page): Promise<void> {
  await openSessionEditor(page)
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

/** The ::before file-name strip under a row ("none" when hidden). */
const nameStrip = (page: Page) =>
  page
    .getByTestId('filmstrip-item')
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el, '::before')
      return { content: s.content, height: parseFloat(s.height) }
    })

test('drag the separator: 4 px steps to 128, chip painted only while dragging, names, reload keeps H', async ({
  page,
}) => {
  await editorWithPhotos(page)
  expect(await thumbH(page)).toBeCloseTo(76, 0)
  expect((await nameStrip(page)).content).toBe('none')
  await expect(sep(page)).toHaveAttribute('aria-valuenow', '76')

  const s = await box(sep(page))
  const x = s.x + s.width / 2
  const y = s.y + s.height / 2
  // Paint: the separator is the top hit at its centre (not canvas, not a thumb).
  expect(
    await page.evaluate(
      ([px, py]) =>
        document
          .elementFromPoint(px ?? 0, py ?? 0)
          ?.getAttribute('data-testid'),
      [x, y],
    ),
  ).toBe('thumb-resizer')

  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y - 52, { steps: 6 })
  await expect(chip(page)).toHaveText('128 px')
  const c = await box(chip(page))
  // Paint (the chip takes no hits): its clip differs from the same clip after release.
  const clip = { x: c.x, y: c.y, width: c.width, height: c.height }
  const during = await page.screenshot({ clip })
  // Chip bottom sits 30 px above the dock edge (edge = separator top + 5).
  const edge = (await box(sep(page))).y + 5
  expect(edge - (c.y + c.height)).toBeCloseTo(30, 0)
  await expect.poll(() => thumbH(page)).toBeCloseTo(128, 0)
  expect(await stored(page)).toBeNull()
  await page.mouse.up()

  await expect(chip(page)).toHaveCount(0)
  await page.mouse.move(x, y - 300)
  expect((await page.screenshot({ clip })).equals(during)).toBe(false)
  await expect(sep(page)).toHaveAttribute('aria-valuenow', '128')
  expect(await stored(page)).toBe('128')
  expect(await thumbH(page)).toBeCloseTo(128, 0)
  // H ≥ 90: the kit file-name strip (11 px × 1.35 + 4) shows under the image.
  const names = await nameStrip(page)
  expect(names.content).toMatch(/\.(png|jpe?g)"$/i)
  expect(names.height).toBeCloseTo(18.85, 1)
  expect(
    (await box(page.getByTestId('filmstrip-item').first())).height,
  ).toBeCloseTo(128 + 18.85, 0)

  await page.reload()
  await openSessionEditor(page)
  await expect(sep(page)).toHaveAttribute('aria-valuenow', '128')
})

test('keys ↑/↓ ±8, Home, End, Enter and double-click; no page scroll', async ({
  page,
}) => {
  await editorWithPhotos(page)
  await sep(page).focus()
  const now = () => sep(page).getAttribute('aria-valuenow')
  await page.keyboard.press('ArrowUp')
  expect(await now()).toBe('84')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  expect(await now()).toBe('68')
  await page.keyboard.press('End')
  expect(await now()).toBe('240')
  await expect.poll(() => thumbH(page)).toBeCloseTo(240, 0)
  await page.keyboard.press('Home')
  expect(await now()).toBe('56')
  await expect.poll(() => thumbH(page)).toBeCloseTo(56, 0)
  expect(await stored(page)).toBe('56')
  await page.keyboard.press('Enter')
  expect(await now()).toBe('76')
  expect(await stored(page)).toBe('auto')
  await page.keyboard.press('End')
  await sep(page).dblclick()
  expect(await now()).toBe('76')
  expect(await stored(page)).toBe('auto')
  expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([
    0, 0,
  ])
})

test('old key ignored; window resize re-clamps without writing', async ({
  page,
}) => {
  await page.addInitScript((k) => {
    // First load only: the reload below must see what the test left.
    if (sessionStorage.getItem('seeded') !== null) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('photobooks.filmstrip.thumbHeight', '96')
    localStorage.setItem(k, '240')
  }, V2)
  await openSessionEditor(page)
  await expect(sep(page)).toHaveAttribute('aria-valuenow', '240')
  await expect(sep(page)).toHaveAttribute('aria-valuemax', '240')
  await page.setViewportSize({ width: 1440, height: 600 })
  await expect(sep(page)).toHaveAttribute('aria-valuenow', '212')
  await expect(sep(page)).toHaveAttribute('aria-valuemax', '212')
  expect(await stored(page)).toBe('240')

  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('photobooks.filmstrip.thumbHeight', '96')
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.reload()
  await openSessionEditor(page)
  await expect(sep(page)).toHaveAttribute('aria-valuenow', '76')
})

test('the empty-state row follows H', async ({ page }) => {
  await openSessionEditor(page)
  const empty = page.getByTestId('filmstrip-empty')
  await expect(empty).toBeVisible()
  // Kit strip p-1 pb-2 around a row of height H.
  expect((await box(empty)).height).toBeCloseTo(76 + 12, 0)
  expect((await box(page.getByTestId('dock'))).height).toBeCloseTo(132, 0)
  await sep(page).focus()
  await page.keyboard.press('Home')
  await expect.poll(async () => (await box(empty)).height).toBeCloseTo(68, 0)
})

test('separator look matches the kit: hover line + pill, drag tint, focus ring', async ({
  page,
}) => {
  await openSessionEditor(page)
  await expect(pill(page)).toBeHidden()
  await expect(sep(page)).toHaveCSS('cursor', 'ns-resize')
  expect((await box(sep(page))).height).toBe(9)
  const dock = await box(page.getByTestId('dock'))
  expect((await box(sep(page))).y).toBeCloseTo(dock.y - 5, 0)

  await sep(page).hover()
  await expect(pill(page)).toBeVisible()
  await expect(pill(page)).toHaveCSS('width', '36px')
  await expect(pill(page)).toHaveCSS('height', '4px')
  await expect(pill(page)).toHaveCSS('border-top-left-radius', '2px')
  await expect(pill(page)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.24)')
  const line = page.locator('.film-resizer-line')
  await expect(line).toHaveCSS('background-color', 'rgb(163, 163, 163)')
  const p = await box(pill(page))
  expect(p.y + p.height / 2).toBeCloseTo(dock.y, 0)
  expect(p.x + p.width / 2).toBeCloseTo(dock.x + dock.width / 2, 0)

  const select = await page.evaluate(() => {
    const probe = document.createElement('div')
    probe.style.background = 'var(--select)'
    document.querySelector('[data-testid="dock"]')?.append(probe)
    const color = getComputedStyle(probe).backgroundColor
    probe.remove()
    return color
  })
  const s = await box(sep(page))
  await page.mouse.move(s.x + s.width / 2, s.y + 4)
  await page.mouse.down()
  await expect(pill(page)).toHaveCSS('background-color', select)
  await expect(chip(page)).toHaveText('76 px')
  await expect(chip(page)).toHaveCSS('font-size', '11px')
  await expect(chip(page)).toHaveCSS('font-weight', '500')
  await expect(chip(page)).toHaveCSS('padding', '2px 6px')
  await page.mouse.up()
  await expect(chip(page)).toHaveCount(0)

  await page.mouse.move(dock.x + 10, dock.y - 200)
  await sep(page).focus()
  await page.keyboard.press('Shift')
  await expect(sep(page)).toBeFocused()
  await expect(pill(page)).toHaveCSS('outline-style', 'solid')
  await expect(pill(page)).toHaveCSS('outline-width', '2px')
  await expect(pill(page)).toHaveCSS('outline-color', 'rgb(58, 56, 57)')
  await expect(pill(page)).toHaveCSS('outline-offset', '2px')
})

/** First thumb card vs the strip: x, radius, shadow and painted ring pixels. */
async function firstThumbLook(page: Page) {
  const item = page.getByTestId('filmstrip-item').first()
  const strip = page.getByTestId('filmstrip-scroll')
  const [t, s] = [await box(item), await box(strip)]
  const look = await item.evaluate((el) => {
    const c = getComputedStyle(el)
    return { radius: c.borderTopLeftRadius, shadow: c.boxShadow }
  })
  // 1 px outside the left / top edge (the ring) vs 3 px out (bare chrome).
  const [x, y] = [t.x - s.x, t.y - s.y]
  const [ringL, bareL, ringT, bareT] = await pixelsAt(strip, [
    { x: x - 1, y: y + t.height / 2 },
    { x: x - 3, y: y + t.height / 2 },
    { x: x + t.width / 2, y: y - 1 },
    { x: x + t.width / 2, y: y - 3 },
  ])
  const darker = (a: number[] = [], b: number[] = []) =>
    [0, 1, 2].every((k) => (b[k] ?? 0) - (a[k] ?? 0) >= 6)
  return {
    x: t.x,
    ...look,
    ringLeft: darker(ringL, bareL),
    ringTop: darker(ringT, bareT),
  }
}

test('first thumb sits 4 px into the strip with a 4 px radius and an outer hairline ring (kit)', async ({
  page,
}) => {
  await editorWithPhotos(page)
  const expected = {
    x: expect.closeTo(224, 0.6),
    radius: '4px',
    shadow: 'rgba(0, 0, 0, 0.08) 0px 0px 0px 1px',
    ringLeft: true,
    ringTop: true,
  }
  expect(await thumbH(page)).toBeCloseTo(76, 0)
  const atAuto = await firstThumbLook(page)
  expect(Math.abs(atAuto.x - 224)).toBeLessThanOrEqual(0.25)
  expect(atAuto).toEqual(expected)

  // Same row origin and ring at H = 128 (separator drag, 4 px steps).
  const s = await box(sep(page))
  const [cx, cy] = [s.x + s.width / 2, s.y + s.height / 2]
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx, cy - 52, { steps: 6 })
  await page.mouse.up()
  await expect(sep(page)).toHaveAttribute('aria-valuenow', '128')
  const at128 = await firstThumbLook(page)
  expect(Math.abs(at128.x - 224)).toBeLessThanOrEqual(0.25)
  expect(at128).toEqual(expected)
})

/** Writes `count` 1×1 PNGs into a fresh temp dir (square thumbs). */
function squarePngs(count: number, tag: string): string[] {
  const dir = join(
    tmpdir(),
    `photobooks-${tag}-${String(process.pid)}-${String(Date.now())}`,
  )
  mkdirSync(dir, { recursive: true })
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  return Array.from({ length: count }, (_, i) => {
    const path = join(dir, `${tag}-${String(i).padStart(3, '0')}.png`)
    writeFileSync(path, png)
    return path
  })
}

/** Scrolls the strip to the end; last thumb's right edge vs the scrollport's. */
async function lastThumbEndGap(page: Page) {
  const scroll = page.getByTestId('filmstrip-scroll')
  const measure = () =>
    scroll.evaluate((node) => {
      // Re-applied per poll: a late layout pass can move the end.
      node.scrollLeft = node.scrollWidth
      const r = node.getBoundingClientRect()
      const portRight = r.left + node.clientLeft + node.clientWidth
      const rights = [
        ...node.querySelectorAll('[data-testid="filmstrip-item"]'),
      ].map((row) => row.getBoundingClientRect().right)
      const atEnd =
        Math.abs(node.scrollLeft + node.clientWidth - node.scrollWidth) <= 1
      return {
        atEnd,
        overflows: node.scrollWidth > node.clientWidth,
        gap: portRight - Math.max(...rights),
        portRight: portRight - r.left,
      }
    })
  await expect.poll(measure).toMatchObject({ atEnd: true, overflows: true })
  // The window re-renders after the scroll commit; wait for the gap to settle.
  await expect
    .poll(async () => (await measure()).gap, { timeout: 10_000 })
    .toBeLessThan(40)
  return measure()
}

/** Gallery of `count` loaded, thumbs at H, strip scrolled to the end: 4 px tail. */
async function expectEndInset(page: Page, count: number, h: number) {
  await expect
    .poll(
      () => page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
      { timeout: 60_000 },
    )
    .toBe(String(count))
  await expect(page.getByTestId('filmstrip-status')).toHaveCount(0, {
    timeout: 60_000,
  })
  expect(await thumbH(page)).toBeCloseTo(h, 0)

  const end = await lastThumbEndGap(page)
  // Was 12 px: the spacer and the window width each counted a gap after the last thumb.
  expect(end.gap).toBeCloseTo(4, 0)
  // Paint: the thumb reaches 4 px from the end; 1.5 px from it is bare chrome.
  const strip = page.getByTestId('filmstrip-scroll')
  const y = (await box(strip)).height / 2
  const [thumbPx, bare] = await pixelsAt(strip, [
    { x: end.portRight - 4.5, y },
    { x: end.portRight - 1.5, y },
  ])
  const differs = [0, 1, 2].some(
    (k) => Math.abs((thumbPx?.[k] ?? 0) - (bare?.[k] ?? 0)) >= 6,
  )
  expect(differs).toBe(true)
}

test('the last thumb ends 4 px from the strip end when scrolled to the end (kit)', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const count = 24
  await openSessionEditor(page)
  await choosePhotoFolder(page, squarePngs(count, 'end'))
  await expectEndInset(page, count, 76)

  // H 76 → 92 from the separator keyboard (8 px steps).
  await sep(page).focus()
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  await expect(sep(page)).toHaveAttribute('aria-valuenow', '92')
  await expectEndInset(page, count, 92)
})

test('a long strip still virtualises at a large H', async ({ page }) => {
  test.setTimeout(120_000)
  const count = 120
  const dir = join(
    tmpdir(),
    `photobooks-resize-${String(process.pid)}-${String(Date.now())}`,
  )
  mkdirSync(dir, { recursive: true })
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  const files = Array.from({ length: count }, (_, i) => {
    const path = join(dir, `resize-${String(i).padStart(3, '0')}.png`)
    writeFileSync(path, png)
    return path
  })
  await page.addInitScript((k) => {
    localStorage.setItem(k, '160')
  }, V2)
  await openSessionEditor(page)
  await choosePhotoFolder(page, files)
  await expect
    .poll(
      () => page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
      { timeout: 120_000 },
    )
    .toBe(String(count))
  await expect(page.getByTestId('filmstrip-status')).toHaveCount(0, {
    timeout: 60_000,
  })
  expect(await thumbH(page)).toBeCloseTo(160, 0)

  const scroll = page.getByTestId('filmstrip-scroll')
  await scroll.evaluate((node) => {
    node.scrollLeft = node.scrollWidth / 2
  })
  // Rows cover the scrollport mid-strip, and only a bounded window renders.
  await expect
    .poll(async () =>
      scroll.evaluate((node) => {
        const r = node.getBoundingClientRect()
        const rows = [
          ...node.querySelectorAll('[data-testid="filmstrip-item"]'),
        ]
        const covered = (x: number) =>
          rows.some((row) => {
            const b = row.getBoundingClientRect()
            return b.left <= x && b.right >= x - 8
          })
        return covered(r.left + 1) && covered(r.right - 1)
      }),
    )
    .toBe(true)
  const rendered = await page.getByTestId('filmstrip-item').count()
  expect(rendered).toBeGreaterThan(0)
  expect(rendered).toBeLessThan(count / 2)
})
