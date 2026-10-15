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

const FRAME_DRAG_MIME = 'application/x-photobooks-frame'

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test('empty gallery has no Unplace control and activation leaves placeholders', async ({
  page,
}) => {
  await page.goto('/')

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
  test.describe.configure({ retries: 2 })

  test('keyboard swap, move, and unplace keep photos in the filmstrip', async ({
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
    await first.focus()
    await page.keyboard.press('Space')
    await expect(first).toHaveAttribute('aria-selected', 'true')
    const firstFrame = active
      .getByRole('button', { name: 'Place photo', exact: true })
      .nth(0)
    await firstFrame.focus()
    await expect(firstFrame).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
      timeout: 30_000,
    })
    await expect(
      active.getByRole('button', { name: 'Replace photo' }),
    ).toHaveCount(1)

    await second.focus()
    await page.keyboard.press('Space')
    await expect(second).toHaveAttribute('aria-selected', 'true')
    const secondFrame = active
      .getByRole('button', { name: 'Place photo', exact: true })
      .nth(0)
    await secondFrame.focus()
    await expect(secondFrame).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('spread-frame-image')).toHaveCount(2, {
      timeout: 30_000,
    })
    await expect(page.getByTestId('filmstrip-placed')).toHaveCount(2)

    await page.getByRole('grid', { name: 'Book gallery' }).focus()
    await page.keyboard.press('Escape')
    await expect(first).not.toHaveAttribute('aria-selected', 'true')
    await expect(second).not.toHaveAttribute('aria-selected', 'true')

    await page
      .getByRole('button', { name: 'Select photo to move' })
      .first()
      .focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { pressed: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.getByRole('button', { name: 'Swap photos' }).first().focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('filmstrip-placed')).toHaveCount(2)
    await expect(page.getByTestId('spread-frame-image')).toHaveCount(2)
    await expect(page.getByTestId('filmstrip-item')).toHaveCount(2)

    await page
      .getByRole('button', { name: 'Select photo to move' })
      .first()
      .focus()
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Move photo here' }).first().focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('filmstrip-placed')).toHaveCount(2)
    await expect(page.getByTestId('spread-frame-image')).toHaveCount(2)

    await page
      .getByRole('button', { name: 'Select photo to move' })
      .first()
      .focus()
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Unplace' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('spread-frame-image')).toHaveCount(1, {
      timeout: 5_000,
    })
    await expect(page.getByTestId('filmstrip-placed')).toHaveCount(1)
    await expect(page.getByTestId('filmstrip-item')).toHaveCount(2)
    await assertDocumentFitsViewport(page)
  })
})

test('frame drag hover moves from a frame onto the filmstrip', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('spread-view').first()).toBeVisible()

  const hover = await page.evaluate((mime) => {
    const frames = Array.from(
      document.querySelectorAll<HTMLElement>('[data-frame-id]'),
    )
    const frame = frames[0]
    if (frame === undefined) {
      return { onFrame: false, onFilmstrip: false, framesClear: false }
    }
    const spreadId = frame
      .closest('[data-spread-id]')
      ?.getAttribute('data-spread-id')
    const frameId = frame.getAttribute('data-frame-id')
    if (spreadId === null || spreadId === undefined || frameId === null) {
      return { onFrame: false, onFilmstrip: false, framesClear: false }
    }
    const dataTransfer = new DataTransfer()
    dataTransfer.setData(mime, `${spreadId}\n${frameId}`)
    document.dispatchEvent(
      new DragEvent('dragstart', { bubbles: true, dataTransfer }),
    )
    const scroll = document.querySelector('[data-testid="pasteboard-scroll"]')
    const filmstrip = document.querySelector('[data-testid="filmstrip-scroll"]')
    if (
      !(scroll instanceof HTMLElement) ||
      !(filmstrip instanceof HTMLElement)
    ) {
      return { onFrame: false, onFilmstrip: false, framesClear: false }
    }
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
    const onFrame =
      scroll
        .querySelector('[data-drop-hover="true"]')
        ?.getAttribute('data-frame-id') === frameId
    filmstrip.dispatchEvent(
      new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      }),
    )
    return {
      onFrame,
      onFilmstrip: filmstrip.getAttribute('data-drop-hover') === 'true',
      framesClear: scroll.querySelector('[data-drop-hover="true"]') === null,
    }
  }, FRAME_DRAG_MIME)

  expect(hover).toEqual({ onFrame: true, onFilmstrip: true, framesClear: true })
  await assertDocumentFitsViewport(page)
})

test.describe('frame-budget gates', () => {
  test.describe.configure({ retries: 2 })

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
