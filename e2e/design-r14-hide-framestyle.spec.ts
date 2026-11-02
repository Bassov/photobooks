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
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'

// framestyle-arrange-unhide (M78): FRAME STYLE and ARRANGE are back in the
// Photo inspector (Owner Q8 switch removed). Kit `uikit#/demo` (v0.10.0)
// `editor-frame-selected` at 1440 × 900, page y: ADJUST 698.78, CAPTION
// 735.78, POSITION & SIZE 772.78, FRAME STYLE 809.78, ARRANGE 846.78 (x 1172,
// 37 px pitch). Delete frame (`p-4` around DeleteFrameButton's `p-3`,
// `destructive-ghost` sm): x 1168, w 244, 32 tall, ink rgb(57, 55, 56), 28 px
// under ARRANGE. Open sections, offsets from the FRAME STYLE title (the body
// scrolls): chips +28.25 (62.5 × 62.84, 68.5 px pitch), "New style from this
// frame" +99.1 (268 × 32, 13 px / 500 on --field, 14 px plus), ARRANGE title
// +169.85, z buttons +198.1 (32 × 32, 36 px pitch, --field), "layer 1 of 1"
// 12 / 16.8 muted, Delete frame +287.1. With White mat: slider labels +115.1,
// +150.89, +186.69 (12 / 16.8 muted), uses note +222.49 (count 700 in ink),
// "New style" +264.08, ARRANGE +334.83.

const INK = 'rgb(57, 55, 56)'
const MUTED = 'rgb(83, 81, 82)'
const FIELD = 'rgb(215, 215, 215)'
const SEL = 'rgb(202, 202, 202)'

const KIT = {
  titleX: 1172,
  rows: {
    adjust: 698.78,
    caption: 735.78,
    geometry: 772.78,
    style: 809.78,
    arrange: 846.78,
  },
  remove: { x: 1168, width: 244, height: 32, inset: 28 },
  open: {
    chips: 28.25,
    newStyle: 99.1,
    arrange: 169.85,
    buttons: 198.1,
    remove: 287.1,
  },
  styled: {
    sliders: [115.1, 150.89, 186.69],
    uses: 222.49,
    newStyle: 264.08,
    arrange: 334.83,
  },
} as const

const ORDER = [
  'inspector-photo-disclosure',
  'inspector-fit-crop-disclosure',
  'inspector-rotate-disclosure',
  'inspector-adjust-disclosure',
  'inspector-caption-disclosure',
  'inspector-geometry-disclosure',
  'inspector-style-disclosure',
  'inspector-arrange-disclosure',
]

async function box(locator: Locator) {
  const b = await locator.boundingBox()
  if (b === null) throw new Error('not visible')
  return b
}

function expectNear(actual: number, kit: number, what: string, tol = 0.5) {
  expect(
    Math.abs(actual - kit),
    `${what} ${String(actual)} vs kit ${String(kit)}`,
  ).toBeLessThanOrEqual(tol)
}

const body = (page: Page) => page.getByTestId('inspector-body')
const disclosure = (page: Page, id: string) =>
  page.getByTestId(`inspector-${id}-disclosure`)
const trigger = (page: Page, id: string) =>
  disclosure(page, id).locator('.pb-disclosure__trigger')
const title = (page: Page, id: string) =>
  trigger(page, id).locator('.inspector-eyebrow')

async function sectionOrder(page: Page) {
  return body(page)
    .locator(':scope > .pb-disclosure')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')))
}

async function selectFrame(page: Page, filled: boolean) {
  if (filled) {
    await choosePhotoFolder(page, [photoFixturePaths.samplePng])
    await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
      timeout: 60_000,
    })
    await dragPlaceFirstFilmstripItem(page, 0)
  }
  await page.getByTestId('spread-frame').first().click()
  await expect(page.getByTestId('inspector-context')).toHaveText('Photo')
  await page.mouse.move(0, 899)
}

async function open(page: Page, id: string) {
  await trigger(page, id).click()
  await expect(trigger(page, id)).toHaveAttribute('aria-expanded', 'true')
}

/** y of `locator` below the FRAME STYLE title (the body may have scrolled). */
async function offset(page: Page, locator: Locator) {
  return (await box(locator)).y - (await box(title(page, 'style'))).y
}

test.describe('M78: Photo inspector shows FRAME STYLE / ARRANGE in the kit look', () => {
  test.beforeAll(() => {
    if (!existsSync(photoFixturePaths.samplePng)) {
      ensurePhotoFixtures({ includeLargeJpeg: false })
    }
  })

  test.beforeEach(async ({ page }) => {
    await installPhotoDirectoryPickerStub(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openLibraryBook(page)
  })

  test('filled frame: kit rows through ARRANGE, then the kit Delete frame', async ({
    page,
  }) => {
    await selectFrame(page, true)
    await expect(page.getByTestId('inspector-photo-dpi')).toBeVisible()
    expect(await sectionOrder(page)).toEqual(ORDER)

    for (const [id, kit] of Object.entries(KIT.rows)) {
      await expect(trigger(page, id)).toHaveAttribute('aria-expanded', 'false')
      expectNear((await box(title(page, id))).y, kit, `${id} y`)
      expectNear((await box(title(page, id))).x, KIT.titleX, `${id} x`)
      await expect(title(page, id)).toHaveCSS('font-size', '11px')
    }
    await expect(
      page.getByTestId('inspector-style-disclosure-summary'),
    ).toHaveText('None')
    await expect(
      page.getByTestId('inspector-arrange-disclosure-summary'),
    ).toHaveText('z 1')

    // One 1 px divider per section, none doubled; ARRANGE is a 37 px row.
    const arrange = disclosure(page, 'arrange')
    const arrangeBox = await box(arrange)
    expectNear(arrangeBox.height, 37, 'ARRANGE row')
    await expect(arrange).toHaveCSS('border-bottom-width', '1px')

    const remove = page.getByTestId('frame-delete')
    await expect(remove).toHaveText(/Delete frame\s*Del/)
    const removeBox = await box(remove)
    expectNear(removeBox.x, KIT.remove.x, 'Delete frame x')
    expectNear(removeBox.width, KIT.remove.width, 'Delete frame width')
    expectNear(removeBox.height, KIT.remove.height, 'Delete frame height')
    expectNear(
      removeBox.y,
      arrangeBox.y + arrangeBox.height + KIT.remove.inset,
      'Delete frame y',
    )
    await expect(remove).toHaveCSS('color', INK)
    await expect(remove).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await remove.hover()
    await expect(remove).toHaveAttribute('data-hovered', 'true')
    await expect(remove).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await assertDocumentFitsViewport(page)
  })

  test('empty frame: both sections listed, swatches without a photo', async ({
    page,
  }) => {
    await selectFrame(page, false)
    await expect(page.getByText('Empty — drag a photo')).toBeVisible()
    const ids = await sectionOrder(page)
    expect(ids.slice(-5)).toEqual(ORDER.slice(-5))
    await open(page, 'style')
    await expect(
      page.getByTestId('style-none').locator('.frame-style-chip-thumb'),
    ).toHaveCSS('background-image', 'none')
    await expect(page.getByTestId('frame-delete')).toHaveCSS('color', INK)
  })

  test('FRAME STYLE and ARRANGE open on the kit chips, button and toolbar', async ({
    page,
  }) => {
    await selectFrame(page, true)
    await open(page, 'style')
    await open(page, 'arrange')
    await page.mouse.move(0, 899)

    // Chips: kit 62.5 × 62.84 on --field, the current one on --sel / 600.
    const chips = page.getByTestId('style-list').locator(':scope > button')
    await expect(chips).toHaveCount(4)
    for (let at = 0; at < 4; at += 1) {
      const chip = await box(chips.nth(at))
      expectNear(await offset(page, chips.nth(at)), KIT.open.chips, 'chip y')
      expectNear(chip.x, 1156 + at * 68.5, `chip ${String(at)} x`)
      expectNear(chip.width, 62.5, 'chip width')
      expectNear(chip.height, 62.84, 'chip height')
    }
    await expect(chips.first()).toHaveCSS('background-color', SEL)
    await expect(chips.first()).toHaveCSS('font-weight', '600')
    await expect(chips.nth(1)).toHaveCSS('background-color', FIELD)
    await expect(chips.nth(1)).toHaveCSS('font-size', '11px')
    // Kit `bg-cover` swatch: the frame's own photo.
    await expect(chips.first().locator('.frame-style-chip-thumb')).toHaveCSS(
      'background-image',
      /^url\("blob:/,
    )

    const add = page.getByTestId('style-new')
    expectNear(await offset(page, add), KIT.open.newStyle, 'New style y')
    expectNear((await box(add)).height, 32, 'New style height')
    expectNear((await box(add)).width, 268, 'New style width')
    await expect(add).toHaveCSS('font-size', '13px')
    await expect(add).toHaveCSS('font-weight', '500')
    await expect(add).toHaveCSS('background-color', FIELD)
    await expect(add).not.toHaveCSS('box-shadow', 'none')
    expectNear((await box(add.locator('svg'))).width, 14, 'plus icon')

    expectNear(
      await offset(page, title(page, 'arrange')),
      KIT.open.arrange,
      'ARRANGE title y',
    )
    for (const [at, move] of [
      'back',
      'backward',
      'forward',
      'front',
    ].entries()) {
      const button = page.getByTestId(`z-${move}`)
      expectNear(await offset(page, button), KIT.open.buttons, `z-${move} y`)
      expectNear((await box(button)).x, 1156 + at * 36, `z-${move} x`)
      expectNear((await box(button)).height, 32, `z-${move} height`)
      await expect(button).toHaveCSS('background-color', FIELD)
    }
    const layer = page.getByTestId('frame-layer')
    await expect(layer).toHaveText('layer 1 of 1')
    await expect(layer).toHaveCSS('font-size', '12px')
    await expect(layer).toHaveCSS('line-height', '16.8px')
    await expect(layer).toHaveCSS('color', MUTED)
    expectNear(
      await offset(page, page.getByTestId('frame-delete')),
      KIT.open.remove,
      'Delete frame y',
    )

    // White mat: kit slider pitch, uses note, then the button and ARRANGE.
    await page.getByRole('button', { name: 'White mat', exact: true }).click()
    await page.mouse.move(0, 899)
    for (const [at, name] of ['Mat', 'Stroke', 'Corner radius'].entries()) {
      const label = page
        .getByTestId('frame-style')
        .getByText(name, { exact: true })
      expectNear(
        await offset(page, label),
        KIT.styled.sliders[at] ?? 0,
        `${name} y`,
      )
      await expect(label).toHaveCSS('font-size', '12px')
      await expect(label).toHaveCSS('line-height', '16.8px')
    }
    const uses = page.getByTestId('style-uses')
    expectNear(await offset(page, uses), KIT.styled.uses, 'uses y')
    await expect(uses).toHaveCSS('line-height', '16.8px')
    await expect(uses).toHaveCSS('color', MUTED)
    await expect(uses.locator('b')).toHaveCSS('color', INK)
    expectNear(await offset(page, add), KIT.styled.newStyle, 'New style y')
    expectNear(
      await offset(page, title(page, 'arrange')),
      KIT.styled.arrange,
      'ARRANGE title y',
    )
    await expect(
      page.getByTestId('inspector-style-disclosure-summary'),
    ).toHaveCount(0)
  })

  test('every section open: Delete frame stays in the body scrollport, no layout shift', async ({
    page,
  }) => {
    await selectFrame(page, true)
    const panel = page.getByTestId('inspector-panel')
    const before = await box(panel)
    for (const id of ['adjust', 'caption', 'geometry', 'style', 'arrange']) {
      await open(page, id)
    }
    await page.getByRole('button', { name: 'White mat', exact: true }).click()
    await page.mouse.move(0, 899)
    const after = await box(panel)
    expect({ x: after.x, width: after.width }).toEqual({
      x: before.x,
      width: before.width,
    })
    await assertDocumentFitsViewport(page)
    await assertNamedScrollport(page, 'inspector-body', { axis: 'vertical' })
    const remove = page.getByTestId('frame-delete')
    await remove.scrollIntoViewIfNeeded()
    await expect(remove).toBeInViewport()
    expectNear((await box(remove)).x, KIT.remove.x, 'Delete frame x')
    await assertDocumentFitsViewport(page)
  })
})
