import type { Locator, Page } from '@playwright/test'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { expect, test } from './fixtures/coverage'
import { dropAssetOnFrame } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { applyContactSheet } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import {
  browserAssertNoLoafThenClear,
  browserBeginLoafScenarioWindow,
  clearPerfScenario,
  enablePerfScenario,
} from './perf/perfFixture'

// arrange-lock: the frame context menu and Ctrl/Cmd shortcuts dispatch the
// inspector's `reorderFrame` / `setFrameLocked`; a locked frame ignores drag
// and drop (src/editor/frameArrange.ts).

const canvas = (page: Page) => page.getByTestId('pasteboard-scroll')
const menu = (page: Page) => page.getByTestId('frame-menu')

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('not visible')
  return box
}

/** Bare spread: the Frame tool draws only on empty paper. */
async function clearSpread(page: Page, frames: Locator) {
  for (let guard = 0; guard < 8 && (await frames.count()) > 0; guard++) {
    if ((await page.getByTestId('frame-delete').count()) === 0) {
      await frames.first().click()
    }
    await page.getByTestId('frame-delete').click()
  }
  await expect(frames).toHaveCount(0)
}

async function openInspector(page: Page) {
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
}

test.describe('Arrange menu, shortcuts and lock', () => {
  test.beforeAll(() => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
  })

  test.beforeEach(async ({ page }) => {
    await installPhotoDirectoryPickerStub(page)
    await openSessionEditor(page)
  })

  test('the menu sends a frame behind another, a shortcut brings it back, and locks it', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await openInspector(page)
    const view = page.getByTestId('spread-view').first()
    const frames = view.getByTestId('spread-frame')
    await clearSpread(page, frames)
    const box = await boxOf(view)
    // Two overlapping frames drawn with the Frame tool; the later one is on top.
    for (const [x0, y0, x1, y1] of [
      [0.1, 0.2, 0.6, 0.6],
      [0.9, 0.8, 0.4, 0.4],
    ] as const) {
      await page.keyboard.press('f')
      await page.mouse.move(box.x + box.width * x0, box.y + box.height * y0)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width * x1, box.y + box.height * y1, {
        steps: 6,
      })
      await page.mouse.up()
    }
    await expect(frames).toHaveCount(2)
    const drawn = await frames.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-frame-id') ?? ''),
    )
    const overlap = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 }
    const topAt = () =>
      page.evaluate(
        ({ x, y }) =>
          document
            .elementFromPoint(x, y)
            ?.closest('[data-testid="spread-frame"]')
            ?.getAttribute('data-frame-id'),
        overlap,
      )
    const zOf = (id: string | undefined) =>
      view
        .locator(`[data-testid="spread-frame"][data-frame-id="${id ?? ''}"]`)
        .evaluate((el) => Number(getComputedStyle(el).zIndex))
    expect(await topAt()).toBe(drawn[1])

    await page.mouse.click(overlap.x, overlap.y, { button: 'right' })
    await expect(menu(page)).toBeVisible()
    await assertDocumentFitsViewport(page)
    // Already on top: only the moves that can change the stack are offered.
    await expect(menu(page).getByRole('menuitem')).toHaveText([
      /Send backward/,
      /Send to back/,
      /Lock/,
    ])
    const popover = await menu(page).evaluate((el) => {
      const bg = getComputedStyle(
        el.closest('.pb-menu-popover') ?? el,
      ).backgroundColor
      return bg.match(/\d+/g)?.slice(0, 3).map(Number) ?? []
    })
    expect(Math.max(...popover) - Math.min(...popover)).toBeLessThanOrEqual(8)

    await page.getByTestId('frame-menu-back').click()
    await expect(menu(page)).toHaveCount(0)
    await expect.poll(topAt).toBe(drawn[0])
    expect(await zOf(drawn[1])).toBeLessThan(await zOf(drawn[0]))
    await expect(page.getByTestId('inspector-context')).toHaveText('Photo')

    await page.keyboard.press('Control+Shift+BracketRight')
    await expect.poll(topAt).toBe(drawn[1])
    expect(await zOf(drawn[1])).toBeGreaterThan(await zOf(drawn[0]))

    await page.mouse.click(overlap.x, overlap.y, { button: 'right' })
    await page.getByTestId('frame-menu-lock').click()
    const top = view.locator(`[data-frame-id="${drawn[1] ?? ''}"]`)
    await expect(top).toHaveAttribute('data-locked', 'true')
    await page.mouse.click(overlap.x, overlap.y, { button: 'right' })
    await expect(page.getByTestId('frame-menu-lock')).toHaveText(/Unlock/)
    await page.keyboard.press('Escape')
    await expect(menu(page)).toHaveCount(0)
  })

  test('a locked frame ignores drag, resize and a photo drop until unlocked', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await choosePhotoFolder(page, [photoFixturePaths.samplePng])
    const item = page.getByTestId('filmstrip-item').first()
    await expect
      .poll(async () => (await item.getAttribute('data-asset-id')) ?? '')
      .not.toBe('')
    const assetId = (await item.getAttribute('data-asset-id')) ?? ''
    const frame = canvas(page).getByTestId('spread-frame').first()
    const handles = page.getByTestId('sel-handle')
    await frame.click()
    await expect(handles).toHaveCount(8)

    await page.keyboard.press('Control+Shift+KeyL')
    await expect(frame).toHaveAttribute('data-locked', 'true')
    await expect(handles).toHaveCount(0)

    const before = await boxOf(frame)
    const drag = async () => {
      const from = await boxOf(frame)
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
      await page.mouse.down()
      await page.mouse.move(
        from.x + from.width / 2 + 40,
        from.y + from.height / 2 + 30,
        { steps: 6 },
      )
      await page.mouse.up()
    }
    await drag()
    expect(await boxOf(frame)).toEqual(before)

    await dropAssetOnFrame(page, assetId, frame, { keepSelection: true })
    await expect(frame).toHaveAttribute('data-filled', 'false')

    await page.keyboard.press('Control+Shift+KeyL')
    await expect(frame).not.toHaveAttribute('data-locked', 'true')
    await expect(handles).toHaveCount(8)
    await drag()
    await expect.poll(async () => (await boxOf(frame)).x).not.toBe(before.x)
    await dropAssetOnFrame(page, assetId, frame, { keepSelection: true })
    await expect(frame).toHaveAttribute('data-filled', 'true')
  })

  test('a locked frame refuses the click swap as source and target', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await choosePhotoFolder(page, [
      photoFixturePaths.samplePng,
      photoFixturePaths.sampleOrient6,
    ])
    const items = page.getByTestId('filmstrip-item')
    await expect(items).toHaveCount(2, { timeout: 30_000 })
    await applyContactSheet(page, 2, 1)
    const active = page.getByTestId('spread-view').first()
    const frames = active.getByTestId('spread-frame')
    await expect(frames).toHaveCount(2)
    const ids = await frames.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-frame-id') ?? ''),
    )
    const frameA = active.locator(`button[data-frame-id="${ids[0] ?? ''}"]`)
    const frameB = active.locator(`button[data-frame-id="${ids[1] ?? ''}"]`)
    const assetA = (await items.nth(0).getAttribute('data-asset-id')) ?? ''
    const assetB = (await items.nth(1).getAttribute('data-asset-id')) ?? ''
    await dropAssetOnFrame(page, assetA, frameA)
    await dropAssetOnFrame(page, assetB, frameB)
    await expect(frameA).toHaveAttribute('data-asset-id', assetA)
    await expect(frameB).toHaveAttribute('data-asset-id', assetB)
    const status = page.getByTestId('editor-status')
    const lockedStatus = 'Frame is locked. Unlock it to move, resize or rotate.'
    const select = async (frame: Locator) => {
      await page.keyboard.press('Escape')
      await frame.click()
    }

    // Locked source: the click on B is refused, both photos and the lock stay.
    await select(frameA)
    await page.keyboard.press('Control+Shift+KeyL')
    await expect(frameA).toHaveAttribute('data-locked', 'true')
    await frameB.click()
    await expect.poll(() => status.textContent()).toBe(lockedStatus)
    await expect(frameA).toHaveAttribute('data-asset-id', assetA)
    await expect(frameB).toHaveAttribute('data-asset-id', assetB)
    await expect(frameA).toHaveAttribute('data-locked', 'true')

    // Locked target: same.
    await select(frameB)
    await frameA.click()
    await expect.poll(() => status.textContent()).toBe(lockedStatus)
    await expect(frameA).toHaveAttribute('data-asset-id', assetA)
    await expect(frameB).toHaveAttribute('data-asset-id', assetB)
    await expect(frameA).toHaveAttribute('data-locked', 'true')

    // Unlocked, the pair swaps again.
    await select(frameA)
    await page.keyboard.press('Control+Shift+KeyL')
    await expect(frameA).not.toHaveAttribute('data-locked', 'true')
    await frameB.click()
    await expect.poll(() => status.textContent()).toBe('Photos swapped')
    await expect(frameA).toHaveAttribute('data-asset-id', assetB)
    await expect(frameB).toHaveAttribute('data-asset-id', assetA)
  })
})

test.describe('Arrange frame-budget gates', () => {
  test('restacking and locking from the keyboard logs no LoAF', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await enablePerfScenario(page, '/?fixture=painter&perf=1')
    const frame = canvas(page).getByTestId('spread-frame').first()
    await expect(frame).toBeVisible()
    await frame.click()
    await expect(frame).toHaveAttribute('aria-pressed', 'true')

    await page.evaluate(browserBeginLoafScenarioWindow)
    await clearPerfScenario(page)
    for (const key of [
      'Control+Shift+BracketRight',
      'Control+Shift+BracketLeft',
      'Control+BracketRight',
      'Control+Shift+KeyL',
      'Control+Shift+KeyL',
    ]) {
      await page.keyboard.press(key)
      await page.waitForTimeout(120)
    }
    await expect(frame).not.toHaveAttribute('data-locked', 'true')
    await page.waitForTimeout(300)
    await page.evaluate(browserAssertNoLoafThenClear)
  })
})
