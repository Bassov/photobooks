import { expect, test } from '@playwright/test'
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

const ASSET_DRAG_MIME = 'application/x-photobooks-asset'

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test('empty gallery has no Placed badge and activation leaves placeholders', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.getByTestId('filmstrip-placed')).toHaveCount(0)
  const frame = page.getByRole('button', { name: 'Place photo' }).first()
  await frame.focus()
  await page.keyboard.press('Enter')

  await expect(page.getByTestId('spread-frame-image')).toHaveCount(0)
  await expect(
    page.getByTestId('spread-frame-placeholder').first(),
  ).toBeVisible()
  await assertDocumentFitsViewport(page)
})

test.describe('keyboard place', () => {
  test.describe.configure({ retries: 2 })

  test('keyboard place then replace keeps both photos in the filmstrip', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await page.goto('/')
    await page
      .getByTestId('photo-file-input')
      .setInputFiles([
        photoFixturePaths.samplePng,
        photoFixturePaths.sampleOrient6,
      ])
    await expect(page.getByTestId('filmstrip-item')).toHaveCount(2, {
      timeout: 30_000,
    })

    const first = page.getByTestId('filmstrip-item').nth(0)
    const second = page.getByTestId('filmstrip-item').nth(1)
    await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(2, {
      timeout: 30_000,
    })
    // Tier swap waits on Image.decode, which Chromium defers on background pages.
    await page.bringToFront()
    await first.focus()
    await page.keyboard.press('Space')
    await expect(first).toHaveAttribute('aria-selected', 'true')

    const place = page.getByRole('button', { name: 'Place photo' }).first()
    await place.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('filmstrip-placed')).toHaveCount(1, {
      timeout: 5_000,
    })
    await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
      timeout: 30_000,
    })
    await expect(first.getByTestId('filmstrip-placed')).toBeVisible()
    await expect(second.getByTestId('filmstrip-placed')).toHaveCount(0)
    await expect(page.getByTestId('filmstrip-item')).toHaveCount(2)

    await second.focus()
    await page.keyboard.press('Space')
    await expect(second).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('button', { name: 'Replace photo' }).focus()
    await page.keyboard.press('Enter')
    await expect(first.getByTestId('filmstrip-placed')).toHaveCount(0)
    await expect(second.getByTestId('filmstrip-placed')).toBeVisible()
    await expect(page.getByTestId('filmstrip-item')).toHaveCount(2)
    await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
      timeout: 30_000,
    })
    await assertDocumentFitsViewport(page)
  })
})

test('drag hover follows one frame and clears off a frame', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('spread-frame').first()).toBeVisible()

  const hover = await page.evaluate((mime) => {
    const dataTransfer = new DataTransfer()
    dataTransfer.setData(mime, 'ghost')
    document.dispatchEvent(
      new DragEvent('dragstart', { bubbles: true, dataTransfer }),
    )
    const scroll = document.querySelector('[data-testid="pasteboard-scroll"]')
    if (!(scroll instanceof HTMLElement)) {
      return { error: 'missing scroll' }
    }
    const frames = Array.from(
      scroll.querySelectorAll<HTMLElement>('[data-frame-id]'),
    ).filter((frame) => frame.getBoundingClientRect().width > 0)
    const first = frames[0]
    const second = frames[1]
    if (first === undefined || second === undefined) {
      return { error: 'need two frames' }
    }
    const over = (frame: HTMLElement): void => {
      const box = frame.getBoundingClientRect()
      scroll.dispatchEvent(
        new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          clientX: box.left + box.width / 2,
          clientY: box.top + box.height / 2,
          dataTransfer,
        }),
      )
    }
    over(first)
    const onFirst =
      scroll.querySelector('[data-drop-hover="true"]') === first &&
      scroll.querySelectorAll('[data-drop-hover="true"]').length === 1
    over(second)
    const onSecond =
      scroll.querySelector('[data-drop-hover="true"]') === second &&
      scroll.querySelectorAll('[data-drop-hover="true"]').length === 1
    const slot = first.closest('[data-pasteboard-slot]')
    const slotBox = slot?.getBoundingClientRect()
    if (slotBox === undefined) {
      return { error: 'missing slot' }
    }
    scroll.dispatchEvent(
      new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        clientX: slotBox.left + 4,
        clientY: slotBox.bottom - 2,
        dataTransfer,
      }),
    )
    return {
      onFirst,
      onSecond,
      cleared: scroll.querySelector('[data-drop-hover="true"]') === null,
    }
  }, ASSET_DRAG_MIME)

  expect(hover).toEqual({ onFirst: true, onSecond: true, cleared: true })
  await assertDocumentFitsViewport(page)
})

test.describe('frame-budget gates', () => {
  test.describe.configure({ retries: 2 })

  test('zoomed-out gallery drag stays within frame-budget gates', async ({
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
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(mime, 'painter-b')
      document.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, dataTransfer }),
      )
      const scroll = document.querySelector('[data-testid="pasteboard-scroll"]')
      if (!(scroll instanceof HTMLElement)) {
        return []
      }
      return Array.from(scroll.querySelectorAll<HTMLElement>('[data-frame-id]'))
        .map((frame) => {
          const box = frame.getBoundingClientRect()
          return {
            x: box.left + box.width / 2,
            y: box.top + box.height / 2,
            width: box.width,
          }
        })
        .filter((point) => point.width > 0)
        .map(({ x, y }) => ({ x, y }))
    }, ASSET_DRAG_MIME)
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
        dataTransfer.setData(mime, 'painter-b')
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
      { mime: ASSET_DRAG_MIME, points },
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

  test('save during drag stays within frame-budget gates', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    await enablePerfScenario(page, '/?fixture=painter&perf=1')
    await expect(page.getByTestId('spread-view').first()).toBeVisible()
    await dispatchCtrlWheel(page, 500, 24)
    await expect(page.getByTestId('pasteboard-slot')).toHaveCount(40)

    await page.evaluate(async () => {
      const project = window.__photobooksProject
      if (!project) {
        throw new Error('window.__photobooksProject is not available')
      }
      await project.attachMemoryLibraryForTests()
      const adopted = await project.adoptCurrentBookInLibrary()
      if (!adopted.ok) {
        const code = adopted.code ?? 'unknown'
        throw new Error(`adopt failed: ${code}`)
      }
    })

    const points = await page.evaluate((mime) => {
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(mime, 'painter-b')
      document.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, dataTransfer }),
      )
      const scroll = document.querySelector('[data-testid="pasteboard-scroll"]')
      if (!(scroll instanceof HTMLElement)) {
        return []
      }
      return Array.from(scroll.querySelectorAll<HTMLElement>('[data-frame-id]'))
        .map((frame) => {
          const box = frame.getBoundingClientRect()
          return {
            x: box.left + box.width / 2,
            y: box.top + box.height / 2,
            width: box.width,
          }
        })
        .filter((point) => point.width > 0)
        .map(({ x, y }) => ({ x, y }))
    }, ASSET_DRAG_MIME)
    expect(points.length).toBeGreaterThan(40)

    await clearPerfScenario(page)
    await page.evaluate(
      async ({ mime, points: dragPoints }) => {
        const project = window.__photobooksProject
        if (!project) {
          throw new Error('window.__photobooksProject is not available')
        }
        const scroll = document.querySelector(
          '[data-testid="pasteboard-scroll"]',
        )
        if (!(scroll instanceof HTMLElement)) {
          throw new Error('missing scroll')
        }
        const dataTransfer = new DataTransfer()
        dataTransfer.setData(mime, 'painter-b')
        for (let index = 0; index < dragPoints.length; index += 1) {
          const point = dragPoints[index]
          if (!point) {
            continue
          }
          scroll.dispatchEvent(
            new DragEvent('dragover', {
              bubbles: true,
              cancelable: true,
              clientX: point.x,
              clientY: point.y,
              dataTransfer,
            }),
          )
          if (index === 8) {
            project.saveBookNow()
          }
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              resolve()
            })
          })
        }
      },
      { mime: ASSET_DRAG_MIME, points },
    )

    await page.evaluate(() => {
      const perf = window.__photobooksPerf
      if (!perf) {
        throw new Error('window.__photobooksPerf is not available')
      }
      perf.assertNoLoafEntries(0)
    })
    await collectFrameStatsArtifact(page, testInfo)
  })
})
