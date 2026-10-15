import { expect, test, type Page } from '@playwright/test'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import {
  clearPerfScenario,
  collectFrameStatsArtifact,
  enablePerfScenario,
} from './perf/perfFixture'
import { PERF_BUDGETS } from './perf/budgets'

test('normal visit paints three empty spreads on the pasteboard', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.getByText(/Pasteboard workspace arrives/)).toHaveCount(0)
  await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
    'data-spread-count',
    '3',
  )
  await expect(
    page.getByRole('radiogroup', { name: 'Spread template' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add spread' })).toBeVisible()
  const slots = await readSpreadSlots(page)
  expect(slots.map((slot) => slot.placeholders)).toEqual([1, 2, 1])
  expect(slots[0]?.active).toBe(true)
  expect(slots.map((slot) => slot.widthPx)).toEqual([150, 300, 150])
  const placeholder = page.getByTestId('spread-frame-placeholder').first()
  await expect(placeholder).toBeVisible()
  const box = await placeholder.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(40)
  expect(box?.height ?? 0).toBeGreaterThan(40)
  await expect(page.getByRole('region', { name: 'Spreads' })).toBeVisible()
  await expect(page.getByTestId('zoom-indicator')).toHaveText('13%')
  await assertDocumentFitsViewport(page)
})

test('choosing 4-grid paints four placeholders on the active spread only', async ({
  page,
}) => {
  await page.goto('/')
  const before = await readSpreadSlots(page)
  const activeIndex = before.findIndex((slot) => slot.active)
  expect(activeIndex).toBe(0)
  const radio = page.getByRole('radio', { name: '4-grid' })
  await radio.focus()
  await page.keyboard.press('Space')
  await expect(radio).toBeChecked()
  const slots = await readSpreadSlots(page)
  expect(slots[activeIndex]?.placeholders).toBe(4)
  expect(
    slots
      .filter((_, index) => index !== activeIndex)
      .map((slot) => slot.placeholders),
  ).toEqual(
    before
      .filter((_, index) => index !== activeIndex)
      .map((slot) => slot.placeholders),
  )
  await assertDocumentFitsViewport(page)
})

test('add spread keeps the new spread inside the pasteboard', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add spread' }).click()
  await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
    'data-spread-count',
    '4',
  )
  await expect
    .poll(async () => {
      const slots = await readSpreadSlots(page)
      return slots[3]?.inScrollport === true
    })
    .toBe(true)
  const slots = await readSpreadSlots(page)
  expect(slots.map((slot) => slot.placeholders)).toEqual([1, 2, 2, 1])
  expect(slots[2]?.widthPx).toBe(300)
  expect(slots[3]?.widthPx).toBe(150)
  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'pasteboard-scroll', {
    axis: 'vertical',
    nudgeHorizontal: false,
  })
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

test('camera controls set physical size, fit width, and fit spread', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('zoom-indicator')).toHaveText('13%')

  await page.getByRole('button', { name: '100%' }).click()
  await expect(page.getByTestId('zoom-indicator')).toHaveText('100%')
  const physical = await readSpreadSlots(page)
  expect(physical[0]?.widthPx).toBeCloseTo(300 * (96 / 25.4), 0)
  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'pasteboard-scroll', {
    axis: 'horizontal',
  })

  await page.getByRole('button', { name: 'Fit width' }).click()
  const portWidth = await page
    .getByTestId('pasteboard-scroll')
    .evaluate((el) => el.clientWidth)
  const fittedWidth = await readSpreadSlots(page)
  const activeWidth = fittedWidth.find((slot) => slot.active)
  expect(activeWidth?.widthPx).toBeCloseTo(portWidth, 0)

  await page.getByRole('button', { name: 'Fit spread' }).click()
  const port = await page.getByTestId('pasteboard-scroll').evaluate((el) => ({
    width: el.clientWidth,
    height: el.clientHeight,
  }))
  const box = await page.getByTestId('spread-view').first().boundingBox()
  expect(box).not.toBeNull()
  expect(box?.width ?? 0).toBeLessThanOrEqual(port.width + 1)
  expect(box?.height ?? 0).toBeLessThanOrEqual(port.height + 1)
  await assertDocumentFitsViewport(page)
})

test('wheel, keys, pinch, and space-drag stay inside the pasteboard', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: '100%' }).click()
  const beforeKey = await readCenterAnchor(page)
  await page.keyboard.press('+')
  expectAnchorHeld(beforeKey, await readCenterAnchor(page))

  const beforeWheel = await readCenterAnchor(page)
  await dispatchCtrlWheel(page, -240, 2)
  expectAnchorHeld(beforeWheel, await readCenterAnchor(page))

  const beforePinch = await readCenterAnchor(page)
  await dispatchPinch(page)
  expectAnchorHeld(beforePinch, await readCenterAnchor(page))

  await page.getByRole('button', { name: '100%' }).click()
  const scroll = page.getByTestId('pasteboard-scroll')
  await scroll.focus()
  const topBefore = await scroll.evaluate((el) => el.scrollTop)
  const box = await scroll.boundingBox()
  expect(box).not.toBeNull()
  await page.keyboard.down('Space')
  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + 120,
  )
  await page.mouse.down()
  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + 30,
  )
  await page.mouse.up()
  await page.keyboard.up('Space')
  expect(await scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(topBefore)
  await assertDocumentFitsViewport(page)
})

test('whole-book zoom mounts every fixture spread', async ({ page }) => {
  await page.goto('/?fixture=painter')
  await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
    'data-spread-count',
    '40',
  )
  await dispatchCtrlWheel(page, 500, 24)
  await expect(page.getByTestId('pasteboard-slot')).toHaveCount(40)
  await assertDocumentFitsViewport(page)
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

  test('template switch and add spread stay within frame-budget gates', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    await enablePerfScenario(page, '/?perf=1')
    await expect(page.getByRole('radio', { name: '4-grid' })).toBeVisible()
    await clearPerfScenario(page)

    await page.getByRole('radio', { name: '4-grid' }).click()
    await page.getByRole('button', { name: 'Add spread' }).click()
    await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
      'data-spread-count',
      '4',
    )

    await page.evaluate((loafMax) => {
      const perf = window.__photobooksPerf
      if (!perf) {
        throw new Error('window.__photobooksPerf is not available')
      }
      perf.assertNoLoafEntries(loafMax)
    }, 0)
    await collectFrameStatsArtifact(page, testInfo)
  })

  test('zoomed fixture photos keep a covering tier inside the pasteboard', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await page.goto('/?fixture=painter')
    const first = page.getByTestId('spread-view').first()
    await expect(first.getByTestId('spread-frame-placeholder')).toHaveCount(1)
    await expect(first.getByTestId('spread-frame-image').first()).toBeVisible()

    await dispatchCtrlWheel(page, -300, 28)
    await expect
      .poll(async () =>
        percentOf(await page.getByTestId('zoom-indicator').innerText()),
      )
      .toBeGreaterThanOrEqual(400)
    await expect.poll(async () => gestureLabel(page)).toBe('')
    await expect
      .poll(async () => tierCovers(await readFilledTier(page)), {
        timeout: 30_000,
      })
      .toBe(true)
    await assertDocumentFitsViewport(page)
    await assertNamedScrollport(page, 'pasteboard-scroll', { axis: 'vertical' })
  })

  test('continuous zoom stays within frame-budget gates', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    await enablePerfScenario(page, '/?fixture=painter&perf=1')
    await expect(page.getByTestId('spread-view').first()).toBeVisible()
    await dispatchCtrlWheel(page, 500, 24)
    await expect(page.getByTestId('pasteboard-slot')).toHaveCount(40)
    await clearPerfScenario(page)
    const tierAtFit = await readFilledTier(page)

    await dispatchCtrlWheel(page, -300, 28)
    await expect
      .poll(async () =>
        percentOf(await page.getByTestId('zoom-indicator').innerText()),
      )
      .toBeGreaterThanOrEqual(400)
    await expect
      .poll(async () =>
        page.getByTestId('pasteboard-world').evaluate((el) => {
          if (!(el instanceof HTMLElement)) {
            return 'missing'
          }
          return el.dataset.gesture ?? el.style.transform
        }),
      )
      .toBe('')
    const laidOutWidth = await page
      .getByTestId('spread-view')
      .first()
      .evaluate((el) =>
        el instanceof HTMLElement ? Number.parseFloat(el.style.width) : 0,
      )
    expect(laidOutWidth).toBeGreaterThanOrEqual(300 * (96 / 25.4) * 4 - 1)
    await expect
      .poll(
        async () => {
          const sample = await readFilledTier(page)
          return (
            sample.tier !== null &&
            sample.tier !== tierAtFit.tier &&
            sample.src.length > 0 &&
            tierCovers(sample)
          )
        },
        { timeout: 30_000 },
      )
      .toBe(true)
    await dispatchCtrlWheel(page, 300, 36)

    await page.evaluate((handlerBudgetMs) => {
      const perf = window.__photobooksPerf
      if (!perf) {
        throw new Error('window.__photobooksPerf is not available')
      }
      perf.assertNoLoafEntries(0)
      perf.assertHandlerP95WithinBudget('wheel-zoom', handlerBudgetMs)
    }, PERF_BUDGETS.handlerP95Ms * PERF_BUDGETS.cpuThrottleRate)
    await collectFrameStatsArtifact(page, testInfo)
  })
})

interface SpreadSlotSnapshot {
  placeholders: number
  widthPx: number
  inScrollport: boolean
  active: boolean
}

async function readSpreadSlots(page: Page): Promise<SpreadSlotSnapshot[]> {
  return page.getByTestId('pasteboard-scroll').evaluate((el) => {
    const port = el.getBoundingClientRect()
    return Array.from(el.querySelectorAll('[data-pasteboard-slot]')).map(
      (slot) => {
        const view = slot.querySelector('[data-testid="spread-view"]')
        const widthPx =
          view instanceof HTMLElement ? Number.parseFloat(view.style.width) : 0
        const box = slot.getBoundingClientRect()
        return {
          placeholders: slot.querySelectorAll(
            '[data-testid="spread-frame-placeholder"]',
          ).length,
          widthPx,
          inScrollport: box.bottom > port.top && box.top < port.bottom,
          active: slot.getAttribute('data-active') === 'true',
        }
      },
    )
  })
}

function percentOf(label: string): number {
  return Number.parseInt(label, 10)
}

async function gestureLabel(page: Page): Promise<string> {
  return page.getByTestId('pasteboard-world').evaluate((el) => {
    if (!(el instanceof HTMLElement)) {
      return 'missing'
    }
    return el.dataset.gesture ?? el.style.transform
  })
}

interface TierSample {
  tier: number | null
  longEdge: number
  src: string
}

async function readFilledTier(page: Page): Promise<TierSample> {
  return page.evaluate(() => {
    const image = document.querySelector('[data-testid="spread-frame-image"]')
    if (!(image instanceof HTMLImageElement)) {
      return { tier: null, longEdge: 0, src: '' }
    }
    const box = image.getBoundingClientRect()
    const raw = image.dataset.tier
    const ratio = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1
    return {
      tier: raw === undefined || raw === '' ? null : Number(raw),
      longEdge: Math.max(box.width, box.height) * ratio,
      src: image.getAttribute('src') ?? '',
    }
  })
}

function tierCovers(sample: TierSample): boolean {
  if (sample.tier === null || !(sample.src.length > 0)) {
    return false
  }
  return sample.tier >= sample.longEdge || sample.tier === 2560
}

interface AnchorSample {
  scrollLeft: number
  scrollTop: number
  width: number
  anchorX: number
  anchorY: number
}

async function readCenterAnchor(page: Page): Promise<AnchorSample> {
  return page.getByTestId('pasteboard-scroll').evaluate((el) => {
    const port = el.getBoundingClientRect()
    const view = el.querySelector('[data-testid="spread-view"]')
    const width =
      view instanceof HTMLElement ? view.getBoundingClientRect().width : 0
    return {
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
      width,
      anchorX: port.width / 2,
      anchorY: port.height / 2,
    }
  })
}

function expectAnchorHeld(before: AnchorSample, after: AnchorSample): void {
  expect(before.width).toBeGreaterThan(0)
  const scale = after.width / before.width
  expect(scale).toBeGreaterThan(1)
  const heldX = (before.scrollLeft + before.anchorX) * scale - after.scrollLeft
  const heldY = (before.scrollTop + before.anchorY) * scale - after.scrollTop
  expect(heldX).toBeCloseTo(before.anchorX, 0)
  expect(heldY).toBeCloseTo(before.anchorY, 0)
}

async function dispatchCtrlWheel(
  page: Page,
  deltaY: number,
  times: number,
): Promise<void> {
  await page.getByTestId('pasteboard-scroll').evaluate(
    (el, input) => {
      const rect = el.getBoundingClientRect()
      for (let index = 0; index < input.times; index += 1) {
        el.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: input.deltaY,
            ctrlKey: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            bubbles: true,
            cancelable: true,
          }),
        )
      }
    },
    { deltaY, times },
  )
  await page.waitForTimeout(200)
}

async function dispatchPinch(page: Page): Promise<void> {
  await page.getByTestId('pasteboard-scroll').evaluate((el) => {
    const rect = el.getBoundingClientRect()
    const cy = rect.top + rect.height / 2
    const cx = rect.left + rect.width / 2
    const fire = (type: string, id: number, x: number): void => {
      el.dispatchEvent(
        new PointerEvent(type, {
          pointerId: id,
          clientX: x,
          clientY: cy,
          bubbles: true,
          cancelable: true,
          pointerType: 'touch',
        }),
      )
    }
    fire('pointerdown', 1, cx - 30)
    fire('pointerdown', 2, cx + 30)
    fire('pointermove', 1, cx - 90)
    fire('pointermove', 2, cx + 90)
    fire('pointerup', 1, cx - 90)
    fire('pointerup', 2, cx + 90)
  })
  await page.waitForTimeout(200)
}
