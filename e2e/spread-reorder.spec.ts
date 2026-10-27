import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import { dropAssetOnFrame } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

async function panelOrder(page: Page): Promise<string[]> {
  return page
    .getByTestId('spreads-list')
    .locator('[data-item]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-item') ?? ''))
}

async function pasteboardOrder(page: Page): Promise<string[]> {
  return page
    .locator('[data-pasteboard-slot]')
    .evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-spread-id') ?? ''),
    )
}

/** Synthetic drag of a list item to a viewport Y inside the spreads list. */
async function dragItemTo(
  page: Page,
  itemId: string,
  clientY: number,
): Promise<void> {
  await page.evaluate(
    ({ id, y }) => {
      const item = document.querySelector(`[data-item="${id}"]`)
      const list = document.querySelector('[data-testid="spreads-list"]')
      if (!(item instanceof HTMLElement) || !(list instanceof HTMLElement)) {
        throw new Error('missing spreads list')
      }
      const dataTransfer = new DataTransfer()
      item.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, dataTransfer }),
      )
      const init = {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientY: y,
      }
      list.dispatchEvent(new DragEvent('dragover', init))
      list.dispatchEvent(new DragEvent('drop', init))
      item.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
    },
    { id: itemId, y: clientY },
  )
}

test('drag reorders spreads, the pasteboard follows, and undo restores', async ({
  page,
}) => {
  await openSessionEditor(page)
  const before = await panelOrder(page)
  expect(before.length).toBeGreaterThan(1)
  expect(await pasteboardOrder(page)).toEqual(before)

  const lastId = before.at(-1) ?? ''
  const listBox = await page.getByTestId('spreads-list').boundingBox()
  expect(listBox).not.toBeNull()
  await dragItemTo(page, lastId, (listBox?.y ?? 0) + 2)

  const after = [lastId, ...before.slice(0, -1)]
  await expect.poll(() => panelOrder(page)).toEqual(after)
  await expect.poll(() => pasteboardOrder(page)).toEqual(after)
  await assertDocumentFitsViewport(page)

  await page.getByTestId('undo').click()
  await expect.poll(() => panelOrder(page)).toEqual(before)
  await expect.poll(() => pasteboardOrder(page)).toEqual(before)
})

test('Alt+ArrowDown on a focused spread moves it and keeps focus', async ({
  page,
}) => {
  await openSessionEditor(page)
  const [a, b] = await panelOrder(page)
  const item = page.getByTestId(`spread-list-item-${a ?? ''}`)
  await item.focus()
  await page.keyboard.press('Alt+ArrowDown')
  await expect
    .poll(async () => (await panelOrder(page)).slice(0, 2))
    .toEqual([b, a])
  await expect(page.getByTestId(`spread-list-item-${a ?? ''}`)).toBeFocused()
})

test('switching a template keeps photos in order and unplaces extras', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openSessionEditor(page)
  await choosePhotoFolder(page, [
    photoFixturePaths.samplePng,
    photoFixturePaths.sampleOrient6,
  ])
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(2, {
    timeout: 30_000,
  })
  await page.bringToFront()

  await page.getByRole('radio', { name: '4-grid' }).click()
  const active = page.getByTestId('spread-view').first()
  const empty = active.getByRole('button', {
    name: 'Place photo',
    exact: true,
  })
  await expect(empty).toHaveCount(4)
  for (let i = 0; i < 2; i += 1) {
    const id = await page
      .getByTestId('filmstrip-item')
      .nth(i)
      .getAttribute('data-asset-id')
    await dropAssetOnFrame(page, String(id), empty.nth(0))
    await expect(page.getByTestId('spread-frame-image')).toHaveCount(i + 1, {
      timeout: 30_000,
    })
  }
  const placedBefore = await active
    .locator('button[data-filled="true"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-asset-id')))

  await page.getByRole('radio', { name: '2-up' }).click()
  await expect(active.getByRole('button', { name: 'Place photo' })).toHaveCount(
    0,
  )
  const placedAfter = await active
    .locator('button[data-filled="true"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-asset-id')))
  expect(placedAfter).toEqual(placedBefore)
  await expect(page.getByTestId('filmstrip-placed')).toHaveCount(2)

  await page.getByRole('radio', { name: 'Full bleed' }).click()
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(1)
  const placedOne = await active
    .locator('button[data-filled="true"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-asset-id')))
  expect(placedOne).toEqual(placedBefore.slice(0, 1))
  await expect(page.getByTestId('filmstrip-placed')).toHaveCount(1)
})

test('reorder in an overflowing list scrolls only inside spreads-list', async ({
  page,
}) => {
  await openSessionEditor(page)
  for (let i = 0; i < 12; i += 1) {
    await page.getByTestId('add-spread').click()
  }
  const list = page.getByTestId('spreads-list')
  await expect(list.locator('[data-item]')).toHaveCount(15)
  await assertNamedScrollport(page, 'spreads-list', {
    axis: 'vertical',
    nudgeHorizontal: true,
  })
  await assertDocumentFitsViewport(page)

  const before = await panelOrder(page)
  const lastId = before.at(-1) ?? ''
  await list.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  const listBox = await list.boundingBox()
  expect(listBox).not.toBeNull()
  await dragItemTo(page, lastId, (listBox?.y ?? 0) + 2)

  await expect
    .poll(async () => (await panelOrder(page)).at(-1))
    .not.toBe(lastId)
  const after = await panelOrder(page)
  // Scrolled to the bottom, the pointer at the list top maps past the first items.
  expect(after.indexOf(lastId)).toBeGreaterThan(3)
  expect(after.filter((id) => id !== lastId)).toEqual(
    before.filter((id) => id !== lastId),
  )
  await assertDocumentFitsViewport(page)
})
