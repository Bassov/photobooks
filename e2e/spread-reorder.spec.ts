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
import { addSpreads, applyLayout } from './fixtures/layoutTiles'
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

/**
 * The pasteboard opens fitted on one spread, so only a window of the stack is
 * mounted: it must be the leading run of the expected order.
 */
async function expectPasteboardFollows(
  page: Page,
  expected: readonly string[],
): Promise<void> {
  await expect
    .poll(async () => {
      const mounted = await pasteboardOrder(page)
      return (
        mounted.length >= 2 &&
        mounted.every((id, index) => id === expected[index])
      )
    })
    .toBe(true)
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
  await expectPasteboardFollows(page, before)

  const lastId = before.at(-1) ?? ''
  const listBox = await page.getByTestId('spreads-list').boundingBox()
  expect(listBox).not.toBeNull()
  await dragItemTo(page, lastId, (listBox?.y ?? 0) + 2)

  const after = [lastId, ...before.slice(0, -1)]
  await expect.poll(() => panelOrder(page)).toEqual(after)
  await expectPasteboardFollows(page, after)
  await assertDocumentFitsViewport(page)

  await page.getByTestId('undo').click()
  await expect.poll(() => panelOrder(page)).toEqual(before)
  await expectPasteboardFollows(page, before)
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

  await applyLayout(page, '4-grid')
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

  await applyLayout(page, '2-up')
  await expect(active.getByRole('button', { name: 'Place photo' })).toHaveCount(
    0,
  )
  const placedAfter = await active
    .locator('button[data-filled="true"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-asset-id')))
  expect(placedAfter).toEqual(placedBefore)
  await expect(page.getByTestId('filmstrip-placed')).toHaveCount(2)

  await applyLayout(page, 'Full bleed')
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
  await addSpreads(page, 12)
  const list = page.getByTestId('spreads-list')
  // The list is windowed: only the rows near the viewport are mounted.
  await expect
    .poll(() => list.evaluate((el) => el.scrollHeight > el.clientHeight))
    .toBe(true)
  await assertNamedScrollport(page, 'spreads-list', {
    axis: 'vertical',
    nudgeHorizontal: true,
  })
  await assertDocumentFitsViewport(page)

  await list.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await expect
    .poll(async () => (await panelOrder(page)).length)
    .toBeGreaterThan(0)
  const lastId = (await panelOrder(page)).at(-1) ?? ''
  // The windowed list may re-mount rows after the scroll; drag only once the
  // last row is attached (same precondition dragItemTo requires).
  await expect(page.locator(`[data-item="${lastId}"]`)).toBeAttached()
  const listBox = await list.boundingBox()
  expect(listBox).not.toBeNull()
  await dragItemTo(page, lastId, (listBox?.y ?? 0) + 2)

  // Scrolled to the bottom, the pointer at the list top maps well above the end.
  await expect
    .poll(async () => (await panelOrder(page)).at(-1))
    .not.toBe(lastId)
  await assertDocumentFitsViewport(page)
})
