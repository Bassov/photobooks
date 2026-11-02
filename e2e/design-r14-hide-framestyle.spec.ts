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

// Owner Q8 (2026-11-02 08:36, "Ок, ок" to option B): FRAME STYLE and ARRANGE
// stay out of the Photo inspector until their roadmap item; M78 is closed as
// hidden. Kit `uikit#/demo` (v0.10.0) `editor-frame-selected` at 1440 × 900,
// page y: ADJUST 698.78, CAPTION 735.78, POSITION & SIZE 772.78 (x 1172,
// 37 px pitch, M72). Delete frame: `p-4` around DeleteFrameButton's `p-3`
// (uikit/src/sandbox/context-inspector.tsx), `destructive-ghost` sm → x 1168,
// w 244, 32 tall, ink --destructive rgb(57, 55, 56), 28 px under the last
// section, which is now POSITION & SIZE.

const INK = 'rgb(57, 55, 56)'

const KIT = {
  titleX: 1172,
  rows: { adjust: 698.78, caption: 735.78, geometry: 772.78 },
  remove: { x: 1168, width: 244, height: 32, inset: 28 },
} as const

const ORDER = [
  'inspector-photo-disclosure',
  'inspector-fit-crop-disclosure',
  'inspector-rotate-disclosure',
  'inspector-adjust-disclosure',
  'inspector-caption-disclosure',
  'inspector-geometry-disclosure',
]

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

const body = (page: Page) => page.getByTestId('inspector-body')
const disclosure = (page: Page, id: string) =>
  page.getByTestId(`inspector-${id}-disclosure`)
const trigger = (page: Page, id: string) =>
  disclosure(page, id).locator('.pb-disclosure__trigger')

/** Nothing of FRAME STYLE / ARRANGE is in the DOM, not just hidden. */
async function expectHidden(page: Page) {
  for (const id of ['style', 'arrange']) {
    await expect(disclosure(page, id)).toHaveCount(0)
    await expect(
      page.getByTestId(`inspector-${id}-disclosure-summary`),
    ).toHaveCount(0)
  }
  for (const name of ['Frame style', 'Arrange']) {
    await expect(body(page).getByText(name, { exact: true })).toHaveCount(0)
  }
  for (const id of ['frame-style', 'style-list', 'style-new', 'frame-layer']) {
    await expect(page.getByTestId(id)).toHaveCount(0)
  }
  for (const move of ['back', 'backward', 'forward', 'front']) {
    await expect(page.getByTestId(`z-${move}`)).toHaveCount(0)
  }
  await expect(page.getByText('New style from this frame')).toHaveCount(0)
  await expect(body(page).getByText('z 1', { exact: true })).toHaveCount(0)
}

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

test.describe('M78 hidden: Photo inspector has no FRAME STYLE / ARRANGE', () => {
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

  test('filled frame: sections end at POSITION & SIZE, then the kit Delete frame', async ({
    page,
  }) => {
    await selectFrame(page, true)
    await expect(page.getByTestId('inspector-photo-dpi')).toBeVisible()
    await expectHidden(page)
    expect(await sectionOrder(page)).toEqual(ORDER)

    for (const [id, kit] of Object.entries(KIT.rows)) {
      await expect(trigger(page, id)).toHaveAttribute('aria-expanded', 'false')
      const title = trigger(page, id).locator('.inspector-eyebrow')
      expectNear((await box(title)).y, kit, `${id} y`)
      expectNear((await box(title)).x, KIT.titleX, `${id} x`)
    }

    // One transparent 1 px divider per section; none doubled where the two
    // sections were (kit Section `border-b last:border-b-0`).
    const geometry = disclosure(page, 'geometry')
    const geometryBox = await box(geometry)
    expectNear(geometryBox.height, 37, 'POSITION & SIZE row')
    await expect(geometry).toHaveCSS('border-bottom-width', '1px')

    const remove = page.getByTestId('frame-delete')
    await expect(remove).toHaveText(/Delete frame\s*Del/)
    const removeBox = await box(remove)
    expectNear(removeBox.x, KIT.remove.x, 'Delete frame x')
    expectNear(removeBox.width, KIT.remove.width, 'Delete frame width')
    expectNear(removeBox.height, KIT.remove.height, 'Delete frame height')
    expectNear(
      removeBox.y,
      geometryBox.y + geometryBox.height + KIT.remove.inset,
      'Delete frame y',
    )
    await expect(remove).toHaveCSS('color', INK)
    await expect(remove).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')

    // Kit destructive-ghost hover: the ink stays, a light tint appears.
    await remove.hover()
    await expect(remove).toHaveAttribute('data-hovered', 'true')
    await expect(remove).toHaveCSS('color', INK)
    await expect(remove).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await assertDocumentFitsViewport(page)
  })

  test('empty frame: the same sections, still no FRAME STYLE / ARRANGE', async ({
    page,
  }) => {
    await selectFrame(page, false)
    await expect(page.getByText('Empty — drag a photo')).toBeVisible()
    await expectHidden(page)
    const ids = await sectionOrder(page)
    expect(ids.slice(-3)).toEqual(ORDER.slice(-3))
    await expect(page.getByTestId('frame-delete')).toHaveCSS('color', INK)
  })

  test('every section open: still hidden, Delete frame stays in the body scrollport', async ({
    page,
  }) => {
    await selectFrame(page, true)
    for (const id of ['adjust', 'caption', 'geometry']) {
      await trigger(page, id).click()
      await expect(trigger(page, id)).toHaveAttribute('aria-expanded', 'true')
    }
    await page.mouse.move(0, 899)
    await expectHidden(page)
    await assertDocumentFitsViewport(page)
    await assertNamedScrollport(page, 'inspector-body', { axis: 'vertical' })
    const remove = page.getByTestId('frame-delete')
    await remove.scrollIntoViewIfNeeded()
    await expect(remove).toBeInViewport()
    expectNear((await box(remove)).x, KIT.remove.x, 'Delete frame x')
    await assertDocumentFitsViewport(page)
  })
})
