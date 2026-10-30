import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { expandDisclosure } from './fixtures/expandDisclosure'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { installPhotoDirectoryPickerStub } from './fixtures/photoDirectoryPicker'

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

const frames = (page: Page) =>
  page.getByTestId('spread-view').first().getByTestId('spread-frame')

async function selectFirstFrame(page: Page) {
  await openSessionEditor(page)
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
  await frames(page).first().click()
  await expandDisclosure(page, 'Position & size')
  await expect(page.getByTestId('inspector-geometry')).toBeVisible()
}

/** Delete frames through the inspector until the spread is bare. */
async function emptySpread(page: Page) {
  for (let guard = 0; guard < 8 && (await frames(page).count()) > 0; guard++) {
    // A click on the selected frame toggles it off: only pick when unselected.
    if ((await page.getByTestId('frame-delete').count()) === 0) {
      await frames(page).first().click()
    }
    await page.getByTestId('frame-delete').click()
  }
  await expect(frames(page)).toHaveCount(0)
}

/** Draw a frame with the Frame tool; x-range as fractions of the spread. */
async function drawFrame(page: Page, from: number, to: number) {
  const box = await page.getByTestId('spread-view').first().boundingBox()
  if (box === null) {
    throw new Error('spread not visible')
  }
  await page.keyboard.press('f')
  await page.mouse.move(box.x + box.width * from, box.y + box.height * 0.2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * to, box.y + box.height * 0.6, {
    steps: 6,
  })
  await page.mouse.up()
}

test('typing W in the Frame tab resizes the selected frame', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await selectFirstFrame(page)
  const frame = frames(page).first()
  const before = await frame.boundingBox()
  const width = page.getByRole('textbox', { name: 'Width' })
  const current = Number(await width.inputValue())
  await width.fill(String(current / 2))
  await width.press('Enter')
  await expect
    .poll(async () => (await frame.boundingBox())?.width ?? 0)
    .toBeLessThan((before?.width ?? 0) * 0.75)
})

test('Arrange "front" updates the layer label', async ({ page }) => {
  test.setTimeout(90_000)
  await selectFirstFrame(page)
  await emptySpread(page)
  await drawFrame(page, 0.1, 0.4)
  await drawFrame(page, 0.5, 0.8)
  await expect(frames(page)).toHaveCount(2)
  await expandDisclosure(page, 'Arrange')
  const label = page.getByTestId('frame-layer')
  await expect(label).toHaveText('layer 2 of 2')
  await page.getByTestId('z-back').click()
  await expect(label).toHaveText('layer 1 of 2')
  await page.getByTestId('z-front').click()
  await expect(label).toHaveText('layer 2 of 2')
})

test('Delete in the Frame tab removes the frame', async ({ page }) => {
  test.setTimeout(90_000)
  await selectFirstFrame(page)
  const before = await frames(page).count()
  await page.getByTestId('frame-delete').click()
  await expect(frames(page)).toHaveCount(before - 1)
  await expect(page.getByTestId('inspector-geometry')).toHaveCount(0)
})
