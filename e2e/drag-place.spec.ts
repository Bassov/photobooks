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
import { openSessionEditor } from './fixtures/openSessionEditor'

const ASSET_DRAG_MIME = 'application/x-photobooks-asset'

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test('empty gallery has no Placed badge and activation leaves placeholders', async ({
  page,
}) => {
  await openSessionEditor(page)

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
  test('keyboard place then replace keeps both photos in the filmstrip', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await openSessionEditor(page)
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
  await openSessionEditor(page)
  await expect(page.getByTestId('spread-frame').first()).toBeVisible()
  // Same-spread peer frames can share one rect until layout settles; wait for
  // two distinct centers stable across consecutive polls before synthetic drag.
  let previousPair: string | null = null
  await expect
    .poll(
      async () => {
        const key = await page.evaluate(() => {
          const scroll = document.querySelector(
            '[data-testid="pasteboard-scroll"]',
          )
          if (!(scroll instanceof HTMLElement)) {
            return null
          }
          const bySpread = new Map<string, HTMLElement[]>()
          for (const node of Array.from(
            scroll.querySelectorAll<HTMLElement>('[data-frame-id]'),
          )) {
            const box = node.getBoundingClientRect()
            if (box.width < 1) {
              continue
            }
            const spreadId = node
              .closest('[data-spread-id]')
              ?.getAttribute('data-spread-id')
            if (
              spreadId === null ||
              spreadId === undefined ||
              spreadId === ''
            ) {
              continue
            }
            const list = bySpread.get(spreadId) ?? []
            list.push(node)
            bySpread.set(spreadId, list)
          }
          for (const frames of bySpread.values()) {
            if (frames.length < 2) {
              continue
            }
            const first = frames[0]
            const second = frames[1]
            if (first === undefined || second === undefined) {
              continue
            }
            const a = first.getBoundingClientRect()
            const b = second.getBoundingClientRect()
            const ax = a.left + a.width / 2
            const ay = a.top + a.height / 2
            const bx = b.left + b.width / 2
            const by = b.top + b.height / 2
            if (Math.hypot(ax - bx, ay - by) < 8) {
              continue
            }
            const idA = first.getAttribute('data-frame-id') ?? ''
            const idB = second.getAttribute('data-frame-id') ?? ''
            return [
              idA,
              idB,
              ax.toFixed(2),
              ay.toFixed(2),
              bx.toFixed(2),
              by.toFixed(2),
            ].join('|')
          }
          return null
        })
        if (key === null) {
          previousPair = null
          return false
        }
        if (previousPair !== null && previousPair === key) {
          return true
        }
        previousPair = key
        return false
      },
      { timeout: 15_000 },
    )
    .toBe(true)

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
    const bySpread = new Map<string, HTMLElement[]>()
    for (const node of Array.from(
      scroll.querySelectorAll<HTMLElement>('[data-frame-id]'),
    )) {
      const box = node.getBoundingClientRect()
      if (box.width < 1) {
        continue
      }
      const spreadId = node
        .closest('[data-spread-id]')
        ?.getAttribute('data-spread-id')
      if (spreadId === null || spreadId === undefined || spreadId === '') {
        continue
      }
      const list = bySpread.get(spreadId) ?? []
      list.push(node)
      bySpread.set(spreadId, list)
    }
    let first: HTMLElement | undefined
    let second: HTMLElement | undefined
    for (const frames of bySpread.values()) {
      if (frames.length < 2) {
        continue
      }
      const a = frames[0]
      const b = frames[1]
      if (a === undefined || b === undefined) {
        continue
      }
      const boxA = a.getBoundingClientRect()
      const boxB = b.getBoundingClientRect()
      const ax = boxA.left + boxA.width / 2
      const ay = boxA.top + boxA.height / 2
      const bx = boxB.left + boxB.width / 2
      const by = boxB.top + boxB.height / 2
      if (Math.hypot(ax - bx, ay - by) < 8) {
        continue
      }
      first = a
      second = b
      break
    }
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
  test.describe('stabilized drag', () => {
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
        const scroll = document.querySelector(
          '[data-testid="pasteboard-scroll"]',
        )
        if (!(scroll instanceof HTMLElement)) {
          return []
        }
        return Array.from(
          scroll.querySelectorAll<HTMLElement>('[data-frame-id]'),
        )
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
        const scroll = document.querySelector(
          '[data-testid="pasteboard-scroll"]',
        )
        if (!(scroll instanceof HTMLElement)) {
          return []
        }
        return Array.from(
          scroll.querySelectorAll<HTMLElement>('[data-frame-id]'),
        )
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

  test.describe('autosave during drag', () => {
    test('autosave during continuous drag stays within frame-budget gates', async ({
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

      // Dirty the book so autosave debounce arms, then drag longer than 1s.
      await page.getByRole('radio', { name: '2-up' }).click()
      await expect(page.getByTestId('save-indicator')).toHaveText('Unsaved')

      const points = await page.evaluate((mime) => {
        const dataTransfer = new DataTransfer()
        dataTransfer.setData(mime, 'painter-b')
        document.dispatchEvent(
          new DragEvent('dragstart', { bubbles: true, dataTransfer }),
        )
        const scroll = document.querySelector(
          '[data-testid="pasteboard-scroll"]',
        )
        if (!(scroll instanceof HTMLElement)) {
          return []
        }
        return Array.from(
          scroll.querySelectorAll<HTMLElement>('[data-frame-id]'),
        )
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
      const midDrag = await page.evaluate(
        async ({ mime, points: dragPoints }) => {
          const scroll = document.querySelector(
            '[data-testid="pasteboard-scroll"]',
          )
          if (!(scroll instanceof HTMLElement)) {
            throw new Error('missing scroll')
          }
          const dataTransfer = new DataTransfer()
          dataTransfer.setData(mime, 'painter-b')
          const started = performance.now()
          let sawSavedMidDrag = false
          let sawSavingMidDrag = false
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
            const indicator = document.querySelector(
              '[data-testid="save-indicator"]',
            )
            const text = indicator?.textContent ?? ''
            if (text === 'Saved') {
              sawSavedMidDrag = true
            }
            if (text === 'Saving…') {
              sawSavingMidDrag = true
            }
            // Keep the gesture active across the 1s autosave debounce.
            if (index % 4 === 0) {
              await new Promise<void>((resolve) => {
                window.setTimeout(() => {
                  resolve()
                }, 40)
              })
            } else {
              await new Promise<void>((resolve) => {
                requestAnimationFrame(() => {
                  resolve()
                })
              })
            }
          }
          document.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
          return {
            elapsedMs: performance.now() - started,
            sawSavedMidDrag,
            sawSavingMidDrag,
          }
        },
        { mime: ASSET_DRAG_MIME, points },
      )
      expect(midDrag.elapsedMs).toBeGreaterThan(1000)
      expect(midDrag.sawSavedMidDrag).toBe(false)
      expect(midDrag.sawSavingMidDrag).toBe(false)

      await page.evaluate(() => {
        const perf = window.__photobooksPerf
        if (!perf) {
          throw new Error('window.__photobooksPerf is not available')
        }
        perf.assertNoLoafEntries(0)
      })
      await collectFrameStatsArtifact(page, testInfo)

      await expect(page.getByTestId('save-indicator')).toHaveText('Saved', {
        timeout: 15_000,
      })
    })
  })
})
