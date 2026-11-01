import type { Locator, Page } from '@playwright/test'
import { existsSync } from 'node:fs'
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

// Owner Musts M76 and M77, round 12, relayed by the Designer (review r11 of
// prod, 2026-11-02). Owner rule: every Designer item is a Must; round 12,
// Designer review r11 2026-11-02. Kit values measured on the rendered kit
// `uikit#/demo` (v0.10.0) at 1440 × 900 with getBoundingClientRect /
// getComputedStyle after replaying the demo-capture steps to
// `editor-frame-selected` / `editor-crop-mode`. Shadows drop the transparent
// Tailwind ring layers (`rgba(0, 0, 0, 0) 0px 0px 0px 0px`).
//
// M76 field boxes (kit MmField FieldGroup, `rounded-md shadow-xs`): Pan X,
//     Pan Y, X, Y, Width, Height, Rotation are 32 px tall, radius 8px, shadow
//     rgba(20, 20, 19, 0.06) 0px 1px 2px 0px.
// M76 Caption open: input top 28.25 below the CAPTION title top, hint
//     "Printed 1.5 mm under the frame, Caption style" 66.25 below it.
// M77 crop toggle: Crop and Done both radius 8px, 32 px tall, shadow
//     rgba(20, 20, 19, 0.06) 0px 1px 2px 0px; Done bg rgb(35, 34, 35).

const SHADOW_XS = 'rgba(20, 20, 19, 0.06) 0px 1px 2px 0px'

const KIT = {
  field: { height: 32, radius: '8px', shadow: SHADOW_XS },
  caption: { input: 28.25, hint: 66.25 },
  crop: { height: 32, radius: '8px', shadow: SHADOW_XS },
  doneBg: 'rgb(35, 34, 35)',
}

const PAN = ['Pan X', 'Pan Y']
const GEOMETRY = ['X', 'Y', 'Width', 'Height', 'Rotation']

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

async function chrome(locator: Locator) {
  return locator.evaluate((el) => {
    const s = getComputedStyle(el)
    return {
      height: el.getBoundingClientRect().height,
      radius: s.borderTopLeftRadius,
      shadow: s.boxShadow
        .split(/,\s*(?![^(]*\))/)
        .filter(
          (layer) => !layer.startsWith('rgba(0, 0, 0, 0) 0px 0px 0px 0px'),
        )
        .join(', '),
      background: s.backgroundColor,
    }
  })
}

const disclosure = (page: Page, id: string) =>
  page.getByTestId(`inspector-${id}-disclosure`)
const trigger = (page: Page, id: string) =>
  disclosure(page, id).locator('.pb-disclosure__trigger')
const title = (page: Page, id: string) =>
  disclosure(page, id).locator('.pb-disclosure__trigger .inspector-eyebrow')
const fieldBox = (scope: Locator, name: string) =>
  scope
    .getByRole('textbox', { name, exact: true })
    .locator('xpath=ancestor::*[contains(@class, "fit-crop-field")][1]')

async function open(page: Page, id: string) {
  await trigger(page, id).click()
  await expect(trigger(page, id)).toHaveAttribute('aria-expanded', 'true')
  await page.mouse.move(0, 899)
}

async function expectKitField(field: Locator, name: string) {
  const got = await chrome(field)
  expect(
    { height: got.height, radius: got.radius, shadow: got.shadow },
    name,
  ).toEqual(KIT.field)
}

test.describe('M76 / M77: Photo inspector fields, Caption and Done match the kit', () => {
  test.beforeAll(() => {
    if (!existsSync(photoFixturePaths.samplePng)) {
      ensurePhotoFixtures({ includeLargeJpeg: false })
    }
  })

  test.beforeEach(async ({ page }) => {
    await installPhotoDirectoryPickerStub(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openLibraryBook(page)
    await choosePhotoFolder(page, [photoFixturePaths.samplePng])
    await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
      timeout: 60_000,
    })
    await dragPlaceFirstFilmstripItem(page, 0)
    await page.getByTestId('spread-frame').first().click()
    await expect(page.getByTestId('inspector-context')).toHaveText('Photo')
    await page.mouse.move(0, 899)
  })

  test('M76: Pan and POSITION & SIZE field boxes carry the kit radius and shadow', async ({
    page,
  }) => {
    const fit = page.getByTestId('inspector-fit-crop')
    for (const name of PAN) {
      await expectKitField(fieldBox(fit, name), name)
    }
    await open(page, 'geometry')
    const geometry = disclosure(page, 'geometry')
    for (const name of GEOMETRY) {
      const field = fieldBox(geometry, name)
      await field.scrollIntoViewIfNeeded()
      await expectKitField(field, name)
    }
  })

  test('M76: the Caption input and hint sit at the kit offsets under the title', async ({
    page,
  }) => {
    await open(page, 'caption')
    const input = page.getByTestId('caption-input')
    await input.scrollIntoViewIfNeeded()
    const top = (await box(title(page, 'caption'))).y
    expectNear(
      (await box(input)).y - top,
      KIT.caption.input,
      'caption input dy',
    )
    const hint = disclosure(page, 'caption').getByText(
      'Printed 1.5 mm under the frame, Caption style',
    )
    expectNear((await box(hint)).y - top, KIT.caption.hint, 'caption hint dy')
  })

  test('M77: Crop and Done carry the kit shadow-xs', async ({ page }) => {
    const toggle = page.getByTestId('crop-toggle')
    await expect(toggle).toHaveText('Crop')
    const crop = await chrome(toggle)
    expect(
      { height: crop.height, radius: crop.radius, shadow: crop.shadow },
      'Crop',
    ).toEqual(KIT.crop)
    await toggle.click()
    await expect(toggle).toHaveText('Done')
    await page.mouse.move(0, 899)
    // The variant swap animates the fill; wait for it to settle.
    await expect
      .poll(async () => (await chrome(toggle)).background, {
        message: 'Done bg',
      })
      .toBe(KIT.doneBg)
    const done = await chrome(toggle)
    expect(
      { height: done.height, radius: done.radius, shadow: done.shadow },
      'Done',
    ).toEqual(KIT.crop)
  })
})
