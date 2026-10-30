import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { ASSET_DRAG_MIME } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import { openSessionEditor } from './fixtures/openSessionEditor'

// uikit/src/index.css + sandbox/v7.tsx: list selection #CACACA, field #D7D7D7;
// CoverSpread fills back #3E3C3B, spine #353332, empty front #8E8E8E.
const SEL = 'rgb(202, 202, 202)'
const FIELD = 'rgb(215, 215, 215)'
const BACK = 'rgb(62, 60, 59)'
const SPINE = 'rgb(53, 51, 50)'
const FRONT_EMPTY = 'rgb(142, 142, 142)'

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
  await openSessionEditor(page)
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
})

// Demo step 09 editor-cover-selected.
test('step 09: selecting the cover shows back · spine · front and the Cover inspector', async ({
  page,
}) => {
  await expect(page.getByTestId('canvas-cover')).toHaveCount(0)
  const row = page.locator('[data-item="cover"]')
  await expect(row).toHaveAttribute('aria-pressed', 'false')
  await row.click()
  await expect(row).toHaveAttribute('aria-pressed', 'true')
  await expect(row).toHaveCSS('background-color', SEL)

  const back = page.getByTestId('cover-back')
  const spine = page.getByTestId('cover-spine')
  const front = page.getByTestId('cover-front')
  await expect(back).toHaveCSS('background-color', BACK)
  await expect(spine).toHaveCSS('background-color', SPINE)
  await expect(front).toHaveCSS('background-color', FRONT_EMPTY)
  const box = (panel: typeof back) =>
    panel.evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect)
  const [b, s, f] = await Promise.all([box(back), box(spine), box(front)])
  // Order left to right, a narrow spine between two equal pages.
  expect(b.x).toBeLessThan(s.x)
  expect(s.x).toBeLessThan(f.x)
  expect(Math.abs(b.width - f.width)).toBeLessThan(1)
  expect(s.width).toBeLessThan(b.width / 4)

  // Nothing (e.g. the empty-pasteboard guidance) sits on top of the front.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const el = document.querySelector('[data-testid="cover-front"]')
        const r = el?.getBoundingClientRect()
        if (!r) return false
        const hit = document.elementFromPoint(
          r.left + r.width / 2,
          r.top + r.height / 2,
        )
        return el?.contains(hit) ?? false
      }),
    )
    .toBe(true)

  const inspector = page.getByTestId('insp-cover')
  await expect(inspector.getByTestId('inspector-context')).toHaveText('Cover')
  await expect(page.getByTestId('cover-front-thumb')).toBeVisible()
  await expect(inspector).toContainText('No photo yet')
  for (const id of ['front', 'spine', 'back']) {
    await expect(page.getByTestId(`cover-text-${id}`)).toHaveCSS(
      'background-color',
      FIELD,
    )
  }
  // uikit/src/sandbox/v7.tsx:214-217 lists Title font, Spine width, Direction and
  // Material in the Cover inspector; the product shows them as read-only rows
  // (see e2e/design-filmstrip-cover.spec.ts), never as inputs.
  await expect(inspector.locator('select, [role="combobox"]')).toHaveCount(0)
  await assertDocumentFitsViewport(page)

  // Picking a page leaves the cover.
  await page.locator('[data-testid^="spread-list-item-"]').first().click()
  await expect(page.getByTestId('canvas-cover')).toHaveCount(0)
  await expect(row).toHaveAttribute('aria-pressed', 'false')
})

// Demo step 13 editor-cover-photo-and-title.
test('step 13: drop a photo on the front and edit the title in the inspector', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await choosePhotoFolder(page, [
    photoFixturePaths.samplePng,
    photoFixturePaths.sampleOrient6,
  ])
  const items = page.getByTestId('filmstrip-item')
  await expect(items).toHaveCount(2, { timeout: 30_000 })
  await page.locator('[data-item="cover"]').click()
  const assetId = String(
    await page
      .locator('[data-testid="filmstrip"] [data-asset-id]')
      .first()
      .getAttribute('data-asset-id'),
  )
  expect(assetId).not.toBe('null')

  await page.evaluate(
    ({ mime, id }) => {
      const front = document.querySelector('[data-testid="cover-front"]')
      if (front === null) {
        throw new Error('missing cover front')
      }
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(mime, id)
      front.dispatchEvent(
        new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      )
      front.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      )
    },
    { mime: ASSET_DRAG_MIME, id: assetId },
  )
  await expect(page.getByTestId('cover-front')).toHaveAttribute(
    'data-photo-id',
    assetId,
  )
  await expect(page.getByTestId('cover-front-thumb')).toHaveAttribute(
    'data-photo-id',
    assetId,
  )
  await expect(page.getByTestId('insp-cover')).not.toContainText('No photo yet')

  const title = page.getByTestId('cover-text-front')
  await title.fill('Lake trip 2026')
  await expect(page.getByTestId('cover-front-text')).toHaveText(
    'Lake trip 2026',
  )
  await page.getByTestId('cover-text-spine').fill('Lake')
  await expect(page.getByTestId('cover-spine-text')).toHaveText('Lake')
  await page.getByTestId('cover-text-back').fill('Thanks')
  await expect(page.getByTestId('cover-back-text')).toHaveText('Thanks')
  await assertDocumentFitsViewport(page)

  // Undo reverts the last cover edit (history covers the cover).
  await page.keyboard.press('Escape')
  await page.getByTestId('undo').click()
  await expect(page.getByTestId('cover-back-text')).toHaveText('')
})
