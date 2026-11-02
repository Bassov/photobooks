import type { Locator, Page } from '@playwright/test'
import { existsSync } from 'node:fs'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import { expect, test } from './fixtures/coverage'
import { dragPlaceFirstFilmstripItem } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { openLibraryBook } from './fixtures/openLibraryBook'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'

// Owner Must M72, round 11, relayed by the Designer (review r10 of prod,
// 2026-11-01). Owner rule: every Designer item is a Must; round 11, Designer
// review r10 2026-11-01. Kit values measured on the rendered kit
// `uikit#/demo` (v0.10.0) at 1440 × 900 with getBoundingClientRect /
// getComputedStyle after replaying the demo-capture steps to
// `editor-frame-selected`, each section expanded alone; y is page y.
//
// Collapsed: ADJUST 698.78, CAPTION 735.78, POSITION & SIZE 772.78, FRAME
//     STYLE 809.78, ARRANGE 846.78 (x 1172, 37 px pitch). Summaries on the
//     title row, right edge 1428.00, 12px / 400 / rgb(83, 81, 82), 16.8 px
//     box: FRAME STYLE "None" y 809.63, ARRANGE "z 1" y 846.63; ADJUST and
//     POSITION & SIZE show none.
// ADJUST open: Brightness 727.03, Contrast 762.83, Saturation 798.63 (35.8
//     pitch, 27.8 px rows); "Reset adjustments" 834.42 (dy 135.64), 13px /
//     500 / rgb(83, 81, 82), opacity 0.5 while disabled; section 206.39 tall.
// POSITION & SIZE open: lock button x 1404 y 767.03, 28 × 28, on the title
//     row; X / Y prefix x 1168 / 1306 y 808.63 (W / H 848.63; 12 px wide); X / Y value
//     inputs x 1186 / 1324 y 807.61 (dy 34.83), 18.84 px tall, text-align
//     start; W / H inputs 847.61; Frame rotation label 889.23; ∠ input x 1358
//     y 891.61; section 183 tall.
// FIT & CROP pan: ↔ / ↕ inputs x 1186 / 1324 y 387.02, text-align start.
// FRAME STYLE open: None chip y 838.03, 62.84 tall; "New style from this
//     frame" 908.88; section 169.84 tall.
// ARRANGE open: z buttons y 875.03 from x 1156 (36 px step); "layer 1 of 1"
//     y 882.63; section 99 tall.
// ppi chip: 11px / 500; kit 401 dpi (success) text rgb(57, 55, 56); the
//     error chip (too low) uses the kit `--badge-error-fg` rgb(35, 34, 35).
// M60 (unchanged): PHOTO 105.75, FIT & CROP 272.39, ROTATE & FLIP 495.19,
//     Straighten 607.44, Quarter turn 643.23.

const MUTED = 'rgb(83, 81, 82)'
const INK = 'rgb(57, 55, 56)'
const ERROR_INK = 'rgb(35, 34, 35)'

const KIT = {
  titleX: 1172,
  collapsed: {
    adjust: 698.78,
    caption: 735.78,
    geometry: 772.78,
    style: 809.78,
    arrange: 846.78,
  },
  summaryRight: 1428,
  styleSummary: 809.63,
  arrangeSummary: 846.63,
  adjust: {
    rows: [727.03, 762.83, 798.63],
    reset: 834.42,
    height: 206.39,
  },
  geometry: {
    lock: { x: 1404, y: 767.03, size: 28 },
    prefixX: [1168, 1306],
    prefixY: [808.63, 848.63],
    inputX: [1186, 1324],
    xy: 807.61,
    wh: 847.61,
    inputHeight: 18.84,
    rotationLabel: 889.23,
    angle: { x: 1358, y: 891.61 },
    height: 183,
  },
  pan: { x: [1186, 1324], y: 387.02 },
  style: { chip: 838.03, chipHeight: 62.84, newStyle: 908.88, height: 169.84 },
  arrange: { buttons: 875.03, firstX: 1156, layer: 882.63, height: 99 },
  m60: {
    photo: 105.75,
    fitCrop: 272.39,
    rotate: 495.19,
    straighten: 607.44,
    quarterTurn: 643.23,
  },
} as const

async function box(locator: Locator) {
  const b = await locator.boundingBox()
  if (b === null) throw new Error('not visible')
  return b
}

function expectNear(actual: number, kit: number, what: string) {
  expect(
    Math.abs(actual - kit),
    `${what} ${String(actual)} vs kit ${String(kit)}`,
  ).toBeLessThanOrEqual(0.5)
}

async function near(locator: Locator, kit: number, axis: 'x' | 'y' = 'y') {
  expectNear((await box(locator))[axis], kit, axis)
}

async function look(locator: Locator) {
  return locator.evaluate((el) => {
    const s = getComputedStyle(el)
    return {
      size: s.fontSize,
      weight: s.fontWeight,
      color: s.color,
      opacity: s.opacity,
      align: s.textAlign,
    }
  })
}

const body = (page: Page) => page.getByTestId('inspector-body')
const disclosure = (page: Page, id: string) =>
  page.getByTestId(`inspector-${id}-disclosure`)
const title = (page: Page, id: string) =>
  disclosure(page, id).locator('.pb-disclosure__trigger .inspector-eyebrow')
const trigger = (page: Page, id: string) =>
  disclosure(page, id).locator('.pb-disclosure__trigger')
const summary = (page: Page, id: string) =>
  page.getByTestId(`inspector-${id}-disclosure-summary`)

async function toggle(page: Page, id: string, open: boolean) {
  await trigger(page, id).click()
  await expect(trigger(page, id)).toHaveAttribute(
    'aria-expanded',
    open ? 'true' : 'false',
  )
  await page.mouse.move(0, 899)
}

async function selectFilledFrame(page: Page, photo: string) {
  await choosePhotoFolder(page, [photo])
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
    timeout: 60_000,
  })
  await dragPlaceFirstFilmstripItem(page, 0)
  await page.getByTestId('spread-frame').first().click()
  await expect(page.getByTestId('inspector-context')).toHaveText('Photo')
  await page.mouse.move(0, 899)
}

test.describe('M72: Photo inspector sections match the kit', () => {
  test.beforeAll(() => {
    if (!existsSync(photoFixturePaths.samplePng)) {
      ensurePhotoFixtures({ includeLargeJpeg: false })
    }
  })

  test.beforeEach(async ({ page }) => {
    await installPhotoDirectoryPickerStub(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openLibraryBook(page)
    await selectFilledFrame(page, photoFixturePaths.samplePng)
  })

  test('collapsed rows carry the kit summaries; M60 rows stay', async ({
    page,
  }) => {
    for (const [id, kit] of Object.entries(KIT.collapsed)) {
      await expect(trigger(page, id)).toHaveAttribute('aria-expanded', 'false')
      await near(title(page, id), kit)
      await near(title(page, id), KIT.titleX, 'x')
    }
    await expect(summary(page, 'style')).toHaveText('None')
    await expect(summary(page, 'arrange')).toHaveText('z 1')
    await expect(summary(page, 'adjust')).toHaveCount(0)
    await expect(summary(page, 'geometry')).toHaveCount(0)
    await expect(summary(page, 'caption')).toHaveCount(0)
    await expect(page.getByTestId('frame-lock')).toHaveCount(0)
    for (const [id, kit] of [
      ['style', KIT.styleSummary],
      ['arrange', KIT.arrangeSummary],
    ] as const) {
      const b = await box(summary(page, id))
      expectNear(b.y, kit, `${id} summary y`)
      expectNear(b.x + b.width, KIT.summaryRight, `${id} summary right`)
      expectNear(b.height, 16.8, `${id} summary height`)
      const read = await look(summary(page, id))
      expect({
        size: read.size,
        weight: read.weight,
        color: read.color,
      }).toEqual({ size: '12px', weight: '400', color: MUTED })
    }
    // Names stay the titles; the summary is the trigger's description.
    await expect(
      page.getByRole('button', { name: 'Arrange', exact: true }),
    ).toHaveAccessibleDescription('z 1')

    const m60 = body(page).locator('.pb-disclosure__trigger .inspector-eyebrow')
    await near(m60.nth(0), KIT.m60.photo)
    await near(m60.nth(1), KIT.m60.fitCrop)
    await near(m60.nth(2), KIT.m60.rotate)
    await near(
      page.getByTestId('photo-straighten').locator('.fit-crop-label'),
      KIT.m60.straighten,
    )
    await near(page.getByTestId('rotate-summary'), KIT.m60.quarterTurn)
  })

  test('ADJUST opens on the kit slider pitch and muted Reset', async ({
    page,
  }) => {
    await toggle(page, 'adjust', true)
    const rows = ['brightness', 'contrast', 'saturation']
    for (const [at, key] of rows.entries()) {
      await near(
        page.getByTestId(`adjust-${key}`).locator('.fit-crop-label'),
        KIT.adjust.rows[at] ?? 0,
      )
    }
    const reset = page.getByTestId('adjust-reset')
    await near(reset, KIT.adjust.reset)
    await expect(reset).toBeDisabled()
    expect(await look(reset)).toMatchObject({
      size: '13px',
      weight: '500',
      color: MUTED,
      opacity: '0.5',
    })
    expectNear(
      (await box(disclosure(page, 'adjust'))).height,
      KIT.adjust.height,
      'ADJUST height',
    )

    // Adjusting enables Reset and folds into an "Edited" summary.
    await page.getByTestId('adjust-brightness').getByRole('slider').focus()
    await page.keyboard.press('ArrowRight')
    await expect(reset).toBeEnabled()
    expect((await look(reset)).opacity).toBe('1')
    await toggle(page, 'adjust', false)
    await expect(summary(page, 'adjust')).toHaveText('Edited')
    await toggle(page, 'adjust', true)
    await reset.click()
    await toggle(page, 'adjust', false)
    await expect(summary(page, 'adjust')).toHaveCount(0)
  })

  test('POSITION & SIZE: lock on the title row, values left after the prefix', async ({
    page,
  }) => {
    await toggle(page, 'geometry', true)
    const k = KIT.geometry
    const lock = page.getByTestId('frame-lock')
    const lockBox = await box(lock)
    expectNear(lockBox.x, k.lock.x, 'lock x')
    expectNear(lockBox.y, k.lock.y, 'lock y')
    expect([lockBox.width, lockBox.height]).toEqual([k.lock.size, k.lock.size])
    await expect(
      disclosure(page, 'geometry').locator('.pb-disclosure__header'),
    ).toContainText('Position & size')
    expect(
      await disclosure(page, 'geometry')
        .locator('.pb-disclosure__header [data-testid="frame-lock"]')
        .count(),
    ).toBe(1)

    const geometry = page.getByTestId('inspector-geometry')
    for (const [row, names, y, prefixY] of [
      [0, ['X', 'Y'], k.xy, k.prefixY[0]],
      [1, ['Width', 'Height'], k.wh, k.prefixY[1]],
    ] as const) {
      for (const [col, name] of names.entries()) {
        const input = geometry.getByRole('textbox', { name, exact: true })
        const field = geometry.locator('.fit-crop-field').nth(row * 2 + col)
        const prefix = field.locator('.fit-crop-affix').first()
        await near(input, y)
        await near(input, k.inputX[col] ?? 0, 'x')
        await near(prefix, k.prefixX[col] ?? 0, 'x')
        await near(prefix, prefixY)
        expectNear((await box(input)).height, k.inputHeight, `${name} height`)
        expect((await look(input)).align, name).toBe('start')
      }
    }
    await near(
      page.getByTestId('frame-rotation').locator('.fit-crop-label'),
      k.rotationLabel,
    )
    const angle = geometry.getByRole('textbox', {
      name: 'Rotation',
      exact: true,
    })
    await near(angle, k.angle.y)
    await near(angle, k.angle.x, 'x')
    expect((await look(angle)).align).toBe('start')
    expectNear(
      (await box(disclosure(page, 'geometry'))).height,
      k.height,
      'POSITION & SIZE height',
    )

    await toggle(page, 'geometry', false)
    await expect(lock).toHaveCount(0)
  })

  test('FIT & CROP pan values sit left after the prefix', async ({ page }) => {
    const fit = page.getByTestId('inspector-fit-crop')
    for (const [at, name] of ['Pan X', 'Pan Y'].entries()) {
      const input = fit.getByRole('textbox', { name, exact: true })
      await near(input, KIT.pan.y)
      await near(input, KIT.pan.x[at] ?? 0, 'x')
      expect((await look(input)).align, name).toBe('start')
    }
  })

  test('FRAME STYLE opens on the kit chips; its summary names the style', async ({
    page,
  }) => {
    await toggle(page, 'style', true)
    const none = page.getByTestId('style-none')
    await near(none, KIT.style.chip)
    expectNear((await box(none)).height, KIT.style.chipHeight, 'chip height')
    await near(page.getByTestId('style-new'), KIT.style.newStyle)
    expectNear(
      (await box(disclosure(page, 'style'))).height,
      KIT.style.height,
      'FRAME STYLE height',
    )
    await expect(summary(page, 'style')).toHaveCount(0)

    await page.getByRole('button', { name: 'White mat', exact: true }).click()
    await toggle(page, 'style', false)
    await expect(summary(page, 'style')).toHaveText('White mat')
  })

  test('ARRANGE opens on the kit toolbar row', async ({ page }) => {
    await toggle(page, 'arrange', true)
    for (const [at, move] of [
      'back',
      'backward',
      'forward',
      'front',
    ].entries()) {
      const button = page.getByTestId(`z-${move}`)
      await near(button, KIT.arrange.buttons)
      await near(button, KIT.arrange.firstX + at * 36, 'x')
    }
    await near(page.getByTestId('frame-layer'), KIT.arrange.layer)
    expectNear(
      (await box(disclosure(page, 'arrange'))).height,
      KIT.arrange.height,
      'ARRANGE height',
    )
    await expect(summary(page, 'arrange')).toHaveCount(0)
  })

  test('every section open: the inspector body scrolls, the page does not', async ({
    page,
  }) => {
    for (const id of ['adjust', 'caption', 'geometry', 'style', 'arrange']) {
      await toggle(page, id, true)
    }
    await assertDocumentFitsViewport(page)
    await assertNamedScrollport(page, 'inspector-body', { axis: 'vertical' })
    await page.getByTestId('frame-delete').scrollIntoViewIfNeeded()
    await expect(page.getByTestId('frame-delete')).toBeInViewport()
    await assertDocumentFitsViewport(page)
  })

  test('the too-low ppi chip keeps the kit error ink', async ({ page }) => {
    const chip = page.getByTestId('inspector-photo-dpi')
    await expect(chip).toContainText('ppi')
    expect(await look(chip)).toMatchObject({
      size: '11px',
      weight: '500',
      color: ERROR_INK,
    })
  })
})

async function openInspectorPanel(page: Page) {
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
}

/** Deletes the seeded frames one by one (selecting the next when needed). */
async function deleteAllFrames(page: Page, frames: Locator) {
  const remove = page.getByTestId('frame-delete')
  for (let guard = 0; guard < 8 && (await frames.count()) > 0; guard++) {
    if ((await remove.count()) === 0) {
      await frames.first().click()
    }
    await remove.click()
  }
}

test.describe('M72: summaries follow state', () => {
  test.beforeEach(async ({ page }) => {
    await installPhotoDirectoryPickerStub(page)
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test('the print-quality ppi chip is the kit success ink', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    ensurePhotoFixtures()
    await openLibraryBook(page)
    await selectFilledFrame(page, photoFixturePaths.largeJpeg)
    const chip = page.getByTestId('inspector-photo-dpi')
    await expect(chip).toHaveAttribute('data-color', 'success')
    expect(await look(chip)).toMatchObject({
      size: '11px',
      weight: '500',
      color: INK,
    })
  })

  test('ARRANGE reads z of the layer after Send to back and Bring forward', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await openSessionEditor(page)
    const frames = page
      .getByTestId('spread-view')
      .first()
      .getByTestId('spread-frame')
    await openInspectorPanel(page)
    await deleteAllFrames(page, frames)
    await expect(frames).toHaveCount(0)
    const spread = await box(page.getByTestId('spread-view').first())
    for (const [from, to] of [
      [0.1, 0.4],
      [0.5, 0.8],
    ] as const) {
      await page.keyboard.press('f')
      await page.mouse.move(
        spread.x + spread.width * from,
        spread.y + spread.height * 0.2,
      )
      await page.mouse.down()
      await page.mouse.move(
        spread.x + spread.width * to,
        spread.y + spread.height * 0.6,
        { steps: 6 },
      )
      await page.mouse.up()
    }
    await expect(frames).toHaveCount(2)
    await expect(summary(page, 'arrange')).toHaveText('z 2')

    await toggle(page, 'arrange', true)
    await page.getByTestId('z-back').click()
    await expect(page.getByTestId('frame-layer')).toHaveText('layer 1 of 2')
    await toggle(page, 'arrange', false)
    await expect(summary(page, 'arrange')).toHaveText('z 1')

    await toggle(page, 'arrange', true)
    await page.getByTestId('z-forward').click()
    await expect(page.getByTestId('frame-layer')).toHaveText('layer 2 of 2')
    await toggle(page, 'arrange', false)
    await expect(summary(page, 'arrange')).toHaveText('z 2')
    await expect(summary(page, 'style')).toHaveText('None')
  })
})
