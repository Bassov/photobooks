import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { dispatchCtrlWheel } from './fixtures/dispatchCtrlWheel'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import {
  clearPerfScenario,
  collectFrameStatsArtifact,
  enablePerfScenario,
} from './perf/perfFixture'
import { PERF_BUDGETS } from './perf/budgets'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import { openSessionEditor } from './fixtures/openSessionEditor'

const FRAME_DRAG_MIME = 'application/x-photobooks-frame'
const ASSET_DRAG_MIME = 'application/x-photobooks-asset'

async function dropAssetOnFrame(
  page: import('@playwright/test').Page,
  assetId: string,
  frame: import('@playwright/test').Locator,
): Promise<void> {
  const box = await frame.boundingBox()
  if (box === null) {
    throw new Error('frame has no box')
  }
  const point = {
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
  }
  await page.evaluate(
    ({ mime, id, point: p }) => {
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(mime, id)
      document.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, dataTransfer }),
      )
      const scroll = document.querySelector('[data-testid="pasteboard-scroll"]')
      if (!(scroll instanceof HTMLElement)) {
        throw new Error('missing pasteboard scroll')
      }
      scroll.dispatchEvent(
        new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          ...p,
        }),
      )
      scroll.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          ...p,
        }),
      )
      document.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
    },
    { mime: ASSET_DRAG_MIME, id: assetId, point },
  )
}

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

test('empty gallery has no Unplace control and activation leaves placeholders', async ({
  page,
}) => {
  await openSessionEditor(page)

  await expect(page.getByRole('button', { name: 'Unplace' })).toHaveCount(0)
  await expect(page.getByTestId('filmstrip-placed')).toHaveCount(0)
  const frame = page
    .getByRole('button', { name: 'Place photo', exact: true })
    .first()
  await frame.focus()
  await page.keyboard.press('Enter')

  await expect(page.getByTestId('spread-frame-image')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Place photo', exact: true }).first(),
  ).toBeVisible()
  await assertDocumentFitsViewport(page)
})

test.describe('keyboard rearrange', () => {
  test('keyboard swap, move, and unplace keep photos in the filmstrip', async ({
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
    await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(2, {
      timeout: 30_000,
    })
    await page.bringToFront()

    await page.getByRole('radio', { name: '4-grid' }).click()
    const active = page.getByTestId('spread-view').first()
    await expect(
      active.getByRole('button', { name: 'Place photo', exact: true }),
    ).toHaveCount(4)

    const first = page.getByTestId('filmstrip-item').nth(0)
    const second = page.getByTestId('filmstrip-item').nth(1)
    const firstId = await first.getAttribute('data-asset-id')
    const secondId = await second.getAttribute('data-asset-id')
    expect(firstId).toBeTruthy()
    expect(secondId).toBeTruthy()

    const firstFrame = active
      .getByRole('button', { name: 'Place photo', exact: true })
      .nth(0)
    await dropAssetOnFrame(page, String(firstId), firstFrame)
    await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
      timeout: 30_000,
    })
    await expect(
      active.getByRole('button', { name: 'Replace photo' }),
    ).toHaveCount(0)
    await expect(
      active.getByRole('button', { name: 'Select photo to move' }),
    ).toHaveCount(1)

    const secondFrame = active
      .getByRole('button', { name: 'Place photo', exact: true })
      .nth(0)
    await dropAssetOnFrame(page, String(secondId), secondFrame)
    await expect(page.getByTestId('spread-frame-image')).toHaveCount(2, {
      timeout: 30_000,
    })
    await expect(page.getByTestId('filmstrip-placed')).toHaveCount(2)

    await page.getByRole('grid', { name: 'Book gallery' }).focus()
    await page.keyboard.press('Escape')
    await expect(first).not.toHaveAttribute('aria-selected', 'true')
    await expect(second).not.toHaveAttribute('aria-selected', 'true')

    const placed = active.locator('button[data-filled="true"]')
    const firstPlacedId = await placed.nth(0).getAttribute('data-frame-id')
    const secondPlacedId = await placed.nth(1).getAttribute('data-frame-id')
    // Assert swap on asset identity — blob src can change when the frame
    // upgrades from filmstrip thumb fallback to a covering tier URL.
    const firstAssetId = await placed.nth(0).getAttribute('data-asset-id')
    const secondAssetId = await placed.nth(1).getAttribute('data-asset-id')
    expect(firstAssetId).toBeTruthy()
    expect(secondAssetId).toBeTruthy()
    expect(firstAssetId).not.toBe(secondAssetId)
    const pasteboardBefore = await page
      .getByTestId('pasteboard-scroll')
      .boundingBox()
    await page
      .getByRole('button', { name: 'Select photo to move' })
      .first()
      .focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { pressed: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const pasteboardAfter = await page
      .getByTestId('pasteboard-scroll')
      .boundingBox()
    expect(pasteboardAfter).toEqual(pasteboardBefore)
    await assertDocumentFitsViewport(page)
    // Session opens at stack-fit (~13%). Classes/outlineWidth were green while
    // the inset ring stayed under the photo — assert pixels change vs cancel.
    const zoomText = await page.getByTestId('zoom-indicator').innerText()
    const zoomPercent = Number.parseInt(zoomText.replace('%', ''), 10)
    expect(zoomPercent).toBeGreaterThan(0)
    expect(zoomPercent).toBeLessThan(40)
    const pressed = page.getByRole('button', { pressed: true })
    await expect(pressed).toHaveAttribute('aria-label', 'Cancel move')
    const activeShot = await pressed.screenshot()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { pressed: true })).toHaveCount(0)
    // Blur so cancelled shot has no focus-visible ring either.
    await page.getByRole('grid', { name: 'Book gallery' }).focus()
    const cancelledShot = await page
      .locator(`button[data-frame-id="${firstPlacedId ?? ''}"]`)
      .screenshot()
    expect(
      Buffer.compare(activeShot, cancelledShot),
      `move-source ring must paint at ${String(zoomPercent)}% (active vs cancelled pixels)`,
    ).not.toBe(0)
    await page.locator(`button[data-frame-id="${firstPlacedId ?? ''}"]`).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { pressed: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await expect
      .poll(async () => page.getByTestId('editor-status').textContent())
      .toBe(
        'Photo selected to move. Activate another frame to swap or move it, or press Unplace.',
      )
    await page.getByRole('button', { name: 'Swap photos' }).first().focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('filmstrip-placed')).toHaveCount(2)
    await expect(page.getByTestId('spread-frame-image')).toHaveCount(2)
    await expect(page.getByTestId('filmstrip-item')).toHaveCount(2)
    await expect(
      active.locator(`button[data-frame-id="${firstPlacedId ?? ''}"]`),
    ).toHaveAttribute('data-asset-id', secondAssetId ?? '')
    await expect(
      active.locator(`button[data-frame-id="${secondPlacedId ?? ''}"]`),
    ).toHaveAttribute('data-asset-id', firstAssetId ?? '')
    await expect
      .poll(async () => page.getByTestId('editor-status').textContent())
      .toBe('Photos swapped')

    await page
      .getByRole('button', { name: 'Select photo to move' })
      .first()
      .focus()
    await page.keyboard.press('Enter')
    const moveSource = page.getByRole('button', { pressed: true })
    const moveSourceFrameId = await moveSource.getAttribute('data-frame-id')
    const moveSourceAssetId = await moveSource.getAttribute('data-asset-id')
    expect(moveSourceFrameId).toBeTruthy()
    expect(moveSourceAssetId).toBeTruthy()
    const moveTarget = page
      .getByRole('button', { name: 'Move photo here' })
      .first()
    const moveTargetFrameId = await moveTarget.getAttribute('data-frame-id')
    expect(moveTargetFrameId).toBeTruthy()
    expect(moveTargetFrameId).not.toBe(moveSourceFrameId)
    await moveTarget.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('filmstrip-placed')).toHaveCount(2)
    await expect(page.getByTestId('spread-frame-image')).toHaveCount(2)
    await expect(
      active.locator(`button[data-frame-id="${moveTargetFrameId ?? ''}"]`),
    ).toHaveAttribute('data-asset-id', moveSourceAssetId ?? '')
    await expect(
      active.locator(`button[data-frame-id="${moveSourceFrameId ?? ''}"]`),
    ).toHaveAttribute('data-filled', 'false')
    await expect
      .poll(async () => page.getByTestId('editor-status').textContent())
      .toBe('Photo moved')

    await page
      .getByRole('button', { name: 'Select photo to move' })
      .first()
      .focus()
    await page.keyboard.press('Enter')
    const unplaceSourceId = await page
      .getByRole('button', { pressed: true })
      .getAttribute('data-frame-id')
    await page.getByRole('button', { name: 'Unplace' }).focus()
    await page.keyboard.press('Enter')
    await expect
      .poll(async () =>
        page.evaluate(
          () => document.activeElement?.getAttribute('data-frame-id') ?? '',
        ),
      )
      .toBe(unplaceSourceId)
    await expect
      .poll(async () => page.getByTestId('editor-status').textContent())
      .toBe('Photo unplaced')
    await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
      timeout: 5_000,
    })
    await expect(page.getByTestId('filmstrip-placed')).toHaveCount(1)
    await expect(page.getByTestId('filmstrip-item')).toHaveCount(2)
    await assertDocumentFitsViewport(page)
  })

  test('move-source ring paints at stack-fit and physical zoom', async ({
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
    await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(2, {
      timeout: 30_000,
    })
    await page.bringToFront()
    await page.getByRole('radio', { name: '4-grid' }).click()
    const active = page.getByTestId('spread-view').first()
    for (const index of [0, 1] as const) {
      const item = page.getByTestId('filmstrip-item').nth(index)
      const assetId = await item.getAttribute('data-asset-id')
      expect(assetId).toBeTruthy()
      const frame = active
        .getByRole('button', { name: 'Place photo', exact: true })
        .nth(0)
      await dropAssetOnFrame(page, String(assetId), frame)
      await expect(page.getByTestId('spread-frame-image')).toHaveCount(
        index + 1,
        { timeout: 30_000 },
      )
    }
    await page.getByRole('grid', { name: 'Book gallery' }).focus()
    await page.keyboard.press('Escape')

    const source = active
      .getByRole('button', { name: 'Select photo to move' })
      .first()
    const frameId = await source.getAttribute('data-frame-id')
    expect(frameId).toBeTruthy()
    const frame = active.locator(`button[data-frame-id="${frameId ?? ''}"]`)

    async function assertRingPaintsAtZoom(expectedZoom: RegExp): Promise<void> {
      await expect(page.getByTestId('zoom-indicator')).toHaveText(expectedZoom)
      await frame.focus()
      await page.keyboard.press('Enter')
      await expect(frame).toHaveAttribute('aria-pressed', 'true')
      await expect(frame).toHaveAttribute('aria-label', 'Cancel move')
      const activeShot = await frame.screenshot()
      await page.keyboard.press('Escape')
      await expect(frame).not.toHaveAttribute('aria-pressed', 'true')
      await page.getByRole('grid', { name: 'Book gallery' }).focus()
      const cancelledShot = await frame.screenshot()
      const zoomLabel = await page.getByTestId('zoom-indicator').innerText()
      expect(
        Buffer.compare(activeShot, cancelledShot),
        `move-source ring must paint at ${zoomLabel} (active vs cancelled pixels)`,
      ).not.toBe(0)
    }

    await expect(page.getByTestId('zoom-indicator')).toHaveText(/^\d+%$/)
    const fitPercent = Number.parseInt(
      (await page.getByTestId('zoom-indicator').innerText()).replace('%', ''),
      10,
    )
    expect(fitPercent).toBeGreaterThan(0)
    expect(fitPercent).toBeLessThan(40)
    await assertRingPaintsAtZoom(new RegExp(`^${String(fitPercent)}%$`))

    await page.getByRole('button', { name: '100%' }).click()
    await assertRingPaintsAtZoom(/^100%$/)
    await assertDocumentFitsViewport(page)
  })
})

test('escape cancels a move source and Delete unplaces a focused frame', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openSessionEditor(page)
  await page.bringToFront()
  await choosePhotoFolder(page, [photoFixturePaths.samplePng])
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
    timeout: 30_000,
  })
  await page.bringToFront()
  await page.getByRole('radio', { name: '4-grid' }).click()
  const active = page.getByTestId('spread-view').first()
  const firstItem = page.getByTestId('filmstrip-item').first()
  const assetId = await firstItem.getAttribute('data-asset-id')
  expect(assetId).toBeTruthy()
  const frame = active
    .getByRole('button', { name: 'Place photo', exact: true })
    .first()
  await dropAssetOnFrame(page, String(assetId), frame)
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
    timeout: 30_000,
  })
  await page.evaluate(() => {
    const input = document.createElement('input')
    input.setAttribute('aria-label', 'Note')
    document.body.append(input)
  })
  await page.getByRole('textbox', { name: 'Note' }).focus()
  await page.keyboard.press('Backspace')
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(1)

  const filled = active.locator('button[data-filled="true"]')
  await filled.focus()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { pressed: true })).toHaveCount(0)
  await expect(page.getByTestId('filmstrip-item').first()).not.toHaveAttribute(
    'aria-selected',
    'true',
  )

  await filled.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Cancel move' })).toHaveCount(1)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { pressed: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Unplace' })).toHaveCount(0)

  await filled.focus()
  await page.keyboard.press('Delete')
  await expect(page.getByTestId('spread-frame-image')).toHaveCount(0)
  await expect(page.getByTestId('filmstrip-placed')).toHaveCount(0)
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(1)
})

test('frame drag hover moves from one frame onto another and the filmstrip', async ({
  page,
}) => {
  await page.goto('/?fixture=painter')
  await expect(page.getByTestId('spread-view').first()).toBeVisible()

  const hover = await page.evaluate((mime) => {
    const body = document.querySelector<HTMLElement>(
      '.spread-frame-body[draggable="true"]',
    )
    const frame = body?.closest<HTMLElement>('[data-frame-id]')
    if (body === null || frame === null || frame === undefined) {
      return {
        onFrame: false,
        onNext: false,
        onFilmstrip: false,
        framesClear: false,
      }
    }
    const spreadId = frame
      .closest('[data-spread-id]')
      ?.getAttribute('data-spread-id')
    const frameId = frame.getAttribute('data-frame-id')
    const next = Array.from(
      document.querySelectorAll<HTMLElement>('[data-frame-id]'),
    ).find((node) => {
      const box = node.getBoundingClientRect()
      return node.getAttribute('data-frame-id') !== frameId && box.width > 0
    })
    if (
      spreadId === null ||
      spreadId === undefined ||
      frameId === null ||
      next === undefined
    ) {
      return {
        onFrame: false,
        onNext: false,
        onFilmstrip: false,
        framesClear: false,
      }
    }
    const dataTransfer = new DataTransfer()
    dataTransfer.setData(mime, `${spreadId}\n${frameId}`)
    body.dispatchEvent(
      new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      }),
    )
    const scroll = document.querySelector('[data-testid="pasteboard-scroll"]')
    const filmstrip = document.querySelector('[data-testid="filmstrip-scroll"]')
    if (
      !(scroll instanceof HTMLElement) ||
      !(filmstrip instanceof HTMLElement)
    ) {
      return {
        onFrame: false,
        onNext: false,
        onFilmstrip: false,
        framesClear: false,
      }
    }
    const sourceBox = frame.getBoundingClientRect()
    scroll.dispatchEvent(
      new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        clientX: sourceBox.left + sourceBox.width / 2,
        clientY: sourceBox.top + sourceBox.height / 2,
        dataTransfer,
      }),
    )
    const onFrame =
      scroll
        .querySelector('[data-drop-hover="true"]')
        ?.getAttribute('data-frame-id') === frameId
    const nextBox = next.getBoundingClientRect()
    scroll.dispatchEvent(
      new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        clientX: nextBox.left + nextBox.width / 2,
        clientY: nextBox.top + nextBox.height / 2,
        dataTransfer,
      }),
    )
    const onNext =
      scroll
        .querySelector('[data-drop-hover="true"]')
        ?.getAttribute('data-frame-id') === next.getAttribute('data-frame-id')
    filmstrip.dispatchEvent(
      new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      }),
    )
    return {
      onFrame,
      onNext,
      onFilmstrip: filmstrip.getAttribute('data-drop-hover') === 'true',
      framesClear: scroll.querySelector('[data-drop-hover="true"]') === null,
    }
  }, FRAME_DRAG_MIME)

  expect(hover).toEqual({
    onFrame: true,
    onNext: true,
    onFilmstrip: true,
    framesClear: true,
  })
  await assertDocumentFitsViewport(page)
})

test.describe('frame-budget gates', () => {
  test('zoomed-out frame drag stays within frame-budget gates', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    await enablePerfScenario(page, '/?fixture=painter&perf=1')
    await expect(page.getByTestId('spread-view').first()).toBeVisible()
    await dispatchCtrlWheel(page, 500, 24)
    await expect(page.getByTestId('pasteboard-slot')).toHaveCount(40)
    await expect
      .poll(async () =>
        page.getByTestId('pasteboard-world').getAttribute('data-gesture'),
      )
      .toBeNull()

    const points = await page.evaluate((mime) => {
      const frame = document.querySelector<HTMLElement>('[data-frame-id]')
      const spreadId = frame
        ?.closest('[data-spread-id]')
        ?.getAttribute('data-spread-id')
      const frameId = frame?.getAttribute('data-frame-id')
      if (
        spreadId === null ||
        spreadId === undefined ||
        frameId === null ||
        frameId === undefined
      ) {
        return []
      }
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(mime, `${spreadId}\n${frameId}`)
      document.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, dataTransfer }),
      )
      const scroll = document.querySelector('[data-testid="pasteboard-scroll"]')
      if (!(scroll instanceof HTMLElement)) {
        return []
      }
      return Array.from(scroll.querySelectorAll<HTMLElement>('[data-frame-id]'))
        .map((node) => {
          const box = node.getBoundingClientRect()
          return {
            x: box.left + box.width / 2,
            y: box.top + box.height / 2,
            width: box.width,
          }
        })
        .filter((point) => point.width > 0)
        .map(({ x, y }) => ({ x, y }))
    }, FRAME_DRAG_MIME)
    expect(points.length).toBeGreaterThan(40)

    await clearPerfScenario(page)
    await page.evaluate(
      async ({ mime, points: dragPoints }) => {
        const scroll = document.querySelector(
          '[data-testid="pasteboard-scroll"]',
        )
        if (!(scroll instanceof HTMLElement)) {
          throw new Error('missing scroll')
        }
        const dataTransfer = new DataTransfer()
        dataTransfer.setData(mime, 's\nf')
        for (const point of dragPoints) {
          scroll.dispatchEvent(
            new DragEvent('dragover', {
              bubbles: true,
              cancelable: true,
              clientX: point.x,
              clientY: point.y,
              dataTransfer,
            }),
          )
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              resolve()
            })
          })
        }
      },
      { mime: FRAME_DRAG_MIME, points },
    )

    await page.evaluate((handlerBudgetMs) => {
      const perf = window.__photobooksPerf
      if (!perf) {
        throw new Error('window.__photobooksPerf is not available')
      }
      perf.assertNoLoafEntries(0)
      perf.assertHandlerP95WithinBudget('dragover', handlerBudgetMs)
    }, PERF_BUDGETS.handlerP95Ms * PERF_BUDGETS.cpuThrottleRate)
    await collectFrameStatsArtifact(page, testInfo)
  })
})
