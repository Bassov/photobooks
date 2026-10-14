import { expect, test } from '@playwright/test'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import {
  clearPerfScenario,
  collectFrameStatsArtifact,
  enablePerfScenario,
} from './perf/perfFixture'

test('normal visit paints one empty spread on the pasteboard', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.getByText(/Pasteboard workspace arrives/)).toHaveCount(0)
  await expect(page.getByTestId('spread-view')).toHaveCount(1)
  const placeholder = page.getByTestId('spread-frame-placeholder')
  await expect(placeholder).toBeVisible()
  const box = await placeholder.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(40)
  expect(box?.height ?? 0).toBeGreaterThan(40)
  await expect(page.getByRole('region', { name: 'Spreads' })).toBeVisible()
  await assertDocumentFitsViewport(page)
})

test('painter fixture scrolls inside the pasteboard', async ({ page }) => {
  await page.goto('/?fixture=painter')

  await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
    'data-spread-count',
    '40',
  )
  const stackHeight = await page
    .getByTestId('pasteboard-scroll')
    .evaluate((el) => el.scrollHeight)
  expect(stackHeight).toBe(40 * (300 * 0.5 + 24))
  const mounted = await page.getByTestId('spread-view').count()
  expect(mounted).toBeGreaterThan(0)
  expect(mounted).toBeLessThan(40)

  const placeholder = page.getByTestId('spread-frame-placeholder').first()
  await expect(placeholder).toBeVisible()
  const box = await placeholder.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(40)
  expect(box?.height ?? 0).toBeGreaterThan(40)
  await expect(page.getByTestId('spread-frame-image').first()).toBeVisible()

  const centered = await page
    .getByTestId('pasteboard-scroll')
    .evaluate((el) => {
      const slot = el.querySelector('[data-pasteboard-slot]')
      if (!(slot instanceof HTMLElement)) {
        return false
      }
      const port = el.getBoundingClientRect()
      const slotBox = slot.getBoundingClientRect()
      const slotMid = slotBox.left + slotBox.width / 2
      const portMid = port.left + port.width / 2
      return Math.abs(slotMid - portMid) < 2 && slotBox.width < port.width - 8
    })
  expect(centered).toBe(true)

  const containment = await page
    .getByTestId('pasteboard-slot')
    .first()
    .evaluate((el) => {
      const style = getComputedStyle(el)
      return {
        contain: style.contain,
        contentVisibility: style.contentVisibility,
        blockSize: style.containIntrinsicBlockSize,
      }
    })
  expect(containment.contentVisibility).toBe('auto')
  const hasSlotContainment =
    containment.contain === 'content' ||
    (containment.contain.includes('layout') &&
      containment.contain.includes('paint') &&
      containment.contain.includes('style'))
  expect(hasSlotContainment).toBe(true)
  expect(containment.blockSize).not.toBe('none')
  expect(containment.blockSize).not.toBe('auto')

  const firstSpreadId = await page
    .getByTestId('pasteboard-slot')
    .first()
    .getAttribute('data-spread-id')
  expect(firstSpreadId).toBeTruthy()

  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'pasteboard-scroll', {
    axis: 'vertical',
  })

  await page.getByTestId('pasteboard-scroll').evaluate((el) => {
    el.scrollTop = el.scrollHeight / 2
  })

  await expect
    .poll(async () =>
      page.getByTestId('pasteboard-scroll').evaluate((el) => {
        const port = el.getBoundingClientRect()
        const views = Array.from(
          el.querySelectorAll('[data-testid="spread-view"]'),
        )
        const slices = views
          .map((view) => {
            const rect = view.getBoundingClientRect()
            return {
              top: Math.max(rect.top, port.top),
              bottom: Math.min(rect.bottom, port.bottom),
            }
          })
          .filter((slice) => slice.bottom > slice.top)
          .sort((a, b) => a.top - b.top)
        let cursor = port.top
        let gap = 0
        for (const slice of slices) {
          if (slice.top > cursor) {
            gap += slice.top - cursor
          }
          cursor = Math.max(cursor, slice.bottom)
        }
        if (cursor < port.bottom) {
          gap += port.bottom - cursor
        }
        const moreBelow = el.scrollTop + el.clientHeight < el.scrollHeight - 1
        return gap < port.height * 0.25 && moreBelow
      }),
    )
    .toBe(true)

  await expect
    .poll(async () =>
      page.getByTestId('pasteboard-scroll').evaluate((el, firstId) => {
        const active = el.querySelector('[data-active="true"]')
        if (!(active instanceof HTMLElement)) {
          return false
        }
        const port = el.getBoundingClientRect()
        const box = active.getBoundingClientRect()
        const overlaps = box.bottom > port.top && box.top < port.bottom
        return overlaps && active.dataset.spreadId !== firstId
      }, firstSpreadId),
    )
    .toBe(true)
})

test.describe('frame-budget gates', () => {
  test.describe.configure({ retries: 2 })

  test('fixture pasteboard scroll stays within frame-budget gates', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    await enablePerfScenario(page, '/?fixture=painter&perf=1')
    await expect(page.getByTestId('spread-view').first()).toBeVisible()
    await clearPerfScenario(page)

    await page.getByTestId('pasteboard-scroll').evaluate(async (el) => {
      const step = Math.max(Math.floor(el.clientHeight * 0.85), 1)
      let guard = 0
      while (
        el.scrollTop + el.clientHeight < el.scrollHeight - 1 &&
        guard < 80
      ) {
        el.scrollTop += step
        guard += 1
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            resolve()
          })
        })
      }
    })

    await page.evaluate((loafMax) => {
      const perf = window.__photobooksPerf
      if (!perf) {
        throw new Error('window.__photobooksPerf is not available')
      }
      perf.assertNoLoafEntries(loafMax)
    }, 0)
    await collectFrameStatsArtifact(page, testInfo)
  })
})
