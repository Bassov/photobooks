import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { ASSET_DRAG_MIME } from './fixtures/dropAssetOnFrame'
import { dispatchCtrlWheel } from './fixtures/dispatchCtrlWheel'
import { PERF_BUDGETS } from './perf/budgets'
import {
  clearPerfScenario,
  collectFrameStatsArtifact,
  enablePerfScenario,
} from './perf/perfFixture'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import { pointOf } from './fixtures/locatorBox'
import { applyContactSheet } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import type { Page } from '@playwright/test'

const ASSET_MULTI_MIME = 'application/x-photobooks-assets'

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

async function importFour(page: Page): Promise<string[]> {
  await openSessionEditor(page)
  await page.bringToFront()
  await choosePhotoFolder(page, [
    photoFixturePaths.samplePng,
    photoFixturePaths.sampleOrient6,
    photoFixturePaths.sampleLossyWebp,
    photoFixturePaths.sampleLosslessWebp,
  ])
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(4, {
    timeout: 45_000,
  })
  const ids: string[] = []
  for (let index = 0; index < 4; index += 1) {
    const id = await page
      .getByTestId('filmstrip-item')
      .nth(index)
      .getAttribute('data-asset-id')
    expect(id).toBeTruthy()
    ids.push(String(id))
  }
  return ids
}

async function dropAssetsAt(
  page: Page,
  ids: readonly string[],
  point: { clientX: number; clientY: number },
): Promise<void> {
  await page.evaluate(
    ({ single, multi, ids: carried, p }) => {
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(single, carried[0] ?? '')
      if (carried.length > 1) {
        dataTransfer.setData(multi, carried.join('\n'))
      }
      document.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, dataTransfer }),
      )
      const scroll = document.querySelector('[data-testid="pasteboard-scroll"]')
      if (!(scroll instanceof HTMLElement)) {
        throw new Error('missing pasteboard scroll')
      }
      for (const type of ['dragover', 'drop']) {
        scroll.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            ...p,
          }),
        )
      }
      document.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
    },
    {
      single: ASSET_DRAG_MIME,
      multi: ASSET_MULTI_MIME,
      ids: [...ids],
      p: point,
    },
  )
}

test('no selection: the filmstrip has nothing selected and fits the viewport', async ({
  page,
}) => {
  await openSessionEditor(page)
  await expect(
    page.locator('[data-testid="filmstrip-item"][data-selected="true"]'),
  ).toHaveCount(0)
  await assertDocumentFitsViewport(page)
})

test.describe('multi-select and multi-drop', () => {
  test('shift range, ctrl toggle and Esc manage the selection', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await importFour(page)
    const items = page.getByTestId('filmstrip-item')
    const selected = page.locator(
      '[data-testid="filmstrip-item"][data-selected="true"]',
    )
    await items.nth(0).click()
    await items.nth(3).click({ modifiers: ['Shift'] })
    await expect(selected).toHaveCount(4)
    await items.nth(1).click({ modifiers: ['ControlOrMeta'] })
    await expect(selected).toHaveCount(3)
    await page.keyboard.press('Escape')
    await expect(selected).toHaveCount(0)
    await assertDocumentFitsViewport(page)
  })

  test('four photos dropped on a 2×2 contact sheet fill all frames in order, one undo step', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const ids = await importFour(page)
    await applyContactSheet(page, 2, 2)
    const frame = page
      .getByRole('button', { name: 'Place photo', exact: true })
      .first()
    await dropAssetsAt(page, ids, await pointOf(frame))
    await expect(
      page.getByTestId('spread-view').first().getByTestId('spread-frame-image'),
    ).toHaveCount(4, { timeout: 30_000 })
    await expect(page.getByTestId('filmstrip-placed')).toHaveCount(4)

    await page.keyboard.press('ControlOrMeta+z')
    await expect(page.getByTestId('spread-frame-image')).toHaveCount(0)
  })

  test('dropping between spreads creates a new spread holding the photos', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const ids = await importFour(page)
    const slots = page.getByTestId('pasteboard-slot')
    const before = await page
      .getByTestId('pasteboard-scroll')
      .getAttribute('data-spread-count')
    const gap = await pointOf(page.getByTestId('spread-view').first(), 2)
    await dropAssetsAt(page, ids.slice(0, 2), gap)
    await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
      'data-spread-count',
      String(Number(before) + 1),
    )
    await expect(page.getByTestId('filmstrip-placed')).toHaveCount(2, {
      timeout: 30_000,
    })
    await expect(slots.first()).toBeVisible()
    await assertDocumentFitsViewport(page)
  })
})

test.describe('frame-budget gates', () => {
  test('zoomed-out four-photo drop over frames and gaps stays within budget', async ({
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

    const ids = ['painter-a', 'painter-b', 'painter-c', 'painter-d']
    const points = await page.evaluate(
      ({ single, multi, carried }) => {
        const dataTransfer = new DataTransfer()
        dataTransfer.setData(single, carried[0] ?? '')
        dataTransfer.setData(multi, carried.join('\n'))
        document.dispatchEvent(
          new DragEvent('dragstart', { bubbles: true, dataTransfer }),
        )
        const scroll = document.querySelector(
          '[data-testid="pasteboard-scroll"]',
        )
        if (!(scroll instanceof HTMLElement)) {
          return []
        }
        const result: { x: number; y: number }[] = []
        const targets = [
          ...scroll.querySelectorAll<HTMLElement>(
            '[data-testid="pasteboard-gap"]',
          ),
          ...scroll.querySelectorAll<HTMLElement>('[data-frame-id]'),
        ]
        for (const node of targets) {
          const box = node.getBoundingClientRect()
          if (box.width > 0) {
            result.push({ x: box.left + box.width / 2, y: box.top + 2 })
          }
        }
        return result
      },
      { single: ASSET_DRAG_MIME, multi: ASSET_MULTI_MIME, carried: ids },
    )
    expect(points.length).toBeGreaterThan(40)

    await clearPerfScenario(page)
    await page.evaluate(
      async ({ single, multi, carried, dragPoints }) => {
        const scroll = document.querySelector(
          '[data-testid="pasteboard-scroll"]',
        )
        if (!(scroll instanceof HTMLElement)) {
          throw new Error('missing scroll')
        }
        const dataTransfer = new DataTransfer()
        dataTransfer.setData(single, carried[0] ?? '')
        dataTransfer.setData(multi, carried.join('\n'))
        const fire = (type: string, point: { x: number; y: number }): void => {
          scroll.dispatchEvent(
            new DragEvent(type, {
              bubbles: true,
              cancelable: true,
              clientX: point.x,
              clientY: point.y,
              dataTransfer,
            }),
          )
        }
        for (const point of dragPoints) {
          fire('dragover', point)
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              resolve()
            })
          })
        }
        const last = dragPoints[dragPoints.length - 1]
        if (last !== undefined) {
          fire('drop', last)
        }
        document.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
      },
      {
        single: ASSET_DRAG_MIME,
        multi: ASSET_MULTI_MIME,
        carried: ids,
        dragPoints: points,
      },
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
