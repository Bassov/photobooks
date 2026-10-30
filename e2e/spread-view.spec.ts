import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import { dispatchCtrlWheel } from './fixtures/dispatchCtrlWheel'
import {
  browserAssertNoLoaf,
  browserAssertNoLoafAndHandlerP95,
  browserAssertNoLoafThenClear,
  browserBeginLoafScenarioWindow,
  clearPerfScenario,
  collectFrameStatsArtifact,
  enablePerfScenario,
} from './perf/perfFixture'
import { PERF_BUDGETS } from './perf/budgets'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import {
  addSpreadAfterLast,
  applyLayout,
  layoutTile,
  openSpreadTab,
} from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { chooseZoom, readZoomPercent } from './fixtures/zoomMenu'

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

test('editor chrome bars wrap without page scroll at 320px and 4K', async ({
  page,
}) => {
  await openSessionEditor(page)
  for (const size of [
    { width: 320, height: 640 },
    { width: 3840, height: 2160 },
  ] as const) {
    await page.setViewportSize(size)
    await expect(page.getByRole('toolbar', { name: 'Editor' })).toBeVisible()
    await expect(page.getByTestId('zoom-menu')).toBeVisible()
    await expect(page.getByTestId('add-spread')).toBeVisible()
    await assertDocumentFitsViewport(page)
  }
})

test('normal visit paints three empty spreads on the pasteboard', async ({
  page,
}) => {
  await openSessionEditor(page)

  await expect(page.getByText(/Pasteboard workspace arrives/)).toHaveCount(0)
  await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
    'data-spread-count',
    '3',
  )
  await expect(page.getByTestId('add-spread')).toBeVisible()
  await expect(page.getByTestId('template-add-spread')).toHaveCount(0)
  // Opens fitted on the selected spread: the window mounts the first spreads,
  // not every spread as stacked tiles.
  const slots = await readSpreadSlots(page)
  expect(slots.length).toBeGreaterThanOrEqual(2)
  expect(slots.map((slot) => slot.placeholders)).toEqual(
    [1, 2, 1].slice(0, slots.length),
  )
  expect(slots[0]?.active).toBe(true)
  // Widths keep the 1:2:1 page ratio at whatever zoom Fit chose.
  const unit = (slots[0]?.widthPx ?? 0) / 150
  expect(unit).toBeGreaterThan(0)
  expect(slots.map((slot) => Math.round(slot.widthPx / unit))).toEqual(
    [150, 300, 150].slice(0, slots.length),
  )
  const placeholder = page.getByTestId('spread-frame-placeholder').first()
  await expect(placeholder).toBeVisible()
  const box = await placeholder.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(40)
  expect(box?.height ?? 0).toBeGreaterThan(40)
  await expect(page.getByRole('region', { name: 'Spreads' })).toBeVisible()
  await expect(page.getByTestId('zoom-label')).toHaveText('Fit')
  await assertDocumentFitsViewport(page)
})

test('choosing 4-grid paints four placeholders on the active spread only', async ({
  page,
}) => {
  await openSessionEditor(page)
  const before = await readSpreadSlots(page)
  const activeIndex = before.findIndex((slot) => slot.active)
  expect(activeIndex).toBe(0)
  await openSpreadTab(page)
  const tile = layoutTile(page, '4-grid')
  await tile.focus()
  await page.keyboard.press('Enter')
  await expect(tile).toHaveAttribute('aria-pressed', 'true')
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

test('a spread added from the row menu is revealed and a later template change leaves it alone', async ({
  page,
}) => {
  // Tall viewport keeps the new spread partly visible at scrollTop 0 so the
  // active-pin release path is exercised (not only full leave-viewport).
  await page.setViewportSize({ width: 1280, height: 800 })
  await openSessionEditor(page)
  await applyLayout(page, '4-grid')
  const tile = layoutTile(page, '4-grid')
  await addSpreadAfterLast(page)
  await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
    'data-spread-count',
    '4',
  )
  const addedPlaceholders = (await readSpreadSlotAt(page, 3))?.placeholders
  await expect
    .poll(async () => {
      const added = await readSpreadSlotAt(page, 3)
      return added !== null && added.inScrollport && added.active
    })
    .toBe(true)
  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'pasteboard-scroll', {
    axis: 'vertical',
    nudgeHorizontal: false,
  })

  await scrollToStackStart(page)
  await expect
    .poll(async () => {
      const first = await readSpreadSlotAt(page, 0)
      const added = await readSpreadSlotAt(page, 3)
      const checked = (await tile.getAttribute('aria-pressed')) === 'true'
      // Kit dock shortens the pasteboard vs pre-chrome: the new spread may leave
      // the port at scrollTop 0 while the active pin still releases to spread 0.
      return (
        first !== null &&
        first.active &&
        first.placeholders === 4 &&
        checked &&
        // Fitted on one spread, the added spread may be windowed out (kit demo
        // shows a single spread); either way it is not the active one.
        !added?.active
      )
    })
    .toBe(true)
  await assertNamedScrollport(page, 'pasteboard-scroll', {
    axis: 'vertical',
    nudgeHorizontal: false,
  })

  await applyLayout(page, '2-up')
  await expect
    .poll(async () => {
      const first = await readSpreadSlotAt(page, 0)
      return first !== null && first.active && first.placeholders === 2
    })
    .toBe(true)
  // Windowed out at Fit: bring the added spread into the window to read it.
  await page.getByTestId('pasteboard-scroll').evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await expect
    .poll(async () => (await readSpreadSlotAt(page, 3))?.placeholders ?? null)
    .toBe(addedPlaceholders)
  await assertDocumentFitsViewport(page)
})

test('add spread keeps the new spread inside the pasteboard', async ({
  page,
}) => {
  await openSessionEditor(page)
  await addSpreadAfterLast(page)
  await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
    'data-spread-count',
    '4',
  )
  await expect
    .poll(async () => (await readSpreadSlotAt(page, 3))?.inScrollport === true)
    .toBe(true)
  const slots = await readSpreadSlots(page)
  const mounted = [1, 2, 2, 1].slice(-slots.length)
  expect(slots.map((slot) => slot.placeholders)).toEqual(mounted)
  // Spread widths keep the 2:1 page ratio at whatever zoom Fit chose.
  expect(
    (slots.at(-2)?.widthPx ?? 0) / (slots.at(-1)?.widthPx ?? 1),
  ).toBeCloseTo(2, 1)
  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'pasteboard-scroll', {
    axis: 'vertical',
    nudgeHorizontal: false,
  })
})

test('add spread keeps the fitted zoom and reveals the new spread', async ({
  page,
}) => {
  await openSessionEditor(page)
  await fitSpreadUntilFilled(page)
  const fittedPercent = await readZoomPercent(page)
  const fitted = await readSpreadView(page, 0)
  expect(fitted).not.toBeNull()
  expect(fittedPercent).not.toBe('')

  await addSpreadAfterLast(page)

  await expect(page.getByTestId('zoom-label')).toHaveAttribute(
    'data-zoom-percent',
    fittedPercent,
  )
  await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
    'data-spread-count',
    '4',
  )
  await expect.poll(async () => readSpreadView(page, 2)).not.toBeNull()
  const previous = await readSpreadView(page, 2)
  expect(previous?.heightPx).toBeCloseTo(fitted?.heightPx ?? 0, 0)
  expect(previous?.widthPx).toBeCloseTo((fitted?.widthPx ?? 0) * 2, 0)
  expect(previous?.placeholders).toBe(2)
  await expect
    .poll(async () => spreadViewContained(page, 3), { timeout: 15_000 })
    .toBe(true)
  const added = await readSpreadView(page, 3)
  expect(added?.placeholders).toBe(1)
  expect(added?.widthPx).toBeCloseTo(fitted?.widthPx ?? 0, 0)
  expect(added?.heightPx).toBeCloseTo(fitted?.heightPx ?? 0, 0)
  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'pasteboard-scroll', {
    axis: 'vertical',
    nudgeHorizontal: false,
  })
})

test('narrow fitted add spread keeps the new spread contained', async ({
  page,
}) => {
  // The template bar no longer eats canvas height, so a shorter viewport keeps
  // the width-limited fit filling the pasteboard.
  await page.setViewportSize({ width: 400, height: 480 })
  await openSessionEditor(page)
  await assertDocumentFitsViewport(page)
  await fitSpreadUntilFilled(page)
  const fittedPercent = await readZoomPercent(page)

  await addSpreadAfterLast(page)

  await expect(page.getByTestId('zoom-label')).toHaveAttribute(
    'data-zoom-percent',
    fittedPercent,
  )
  await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
    'data-spread-count',
    '4',
  )
  await expect
    .poll(async () => spreadViewContained(page, 3), { timeout: 15_000 })
    .toBe(true)
  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'pasteboard-scroll', {
    axis: 'vertical',
    nudgeHorizontal: false,
  })
})

test('mid-scroll fitted add spread keeps the new spread contained', async ({
  page,
}) => {
  // Short enough that the tight dock still leaves the pasteboard scrolling.
  await page.setViewportSize({ width: 1280, height: 600 })
  await openSessionEditor(page)
  const scroll = page.getByTestId('pasteboard-scroll')
  await scroll.evaluate((el) => {
    el.scrollTop = el.scrollHeight / 2
  })
  await expect
    .poll(async () => scroll.evaluate((el) => el.scrollTop > 0))
    .toBe(true)
  await fitSpreadUntilFilled(page)
  const fittedPercent = await readZoomPercent(page)

  await addSpreadAfterLast(page)

  await expect(page.getByTestId('zoom-label')).toHaveAttribute(
    'data-zoom-percent',
    fittedPercent,
  )
  await expect(scroll).toHaveAttribute('data-spread-count', '4')
  await expect
    .poll(async () => spreadViewContained(page, 3), { timeout: 15_000 })
    .toBe(true)
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
  const metrics = await page.getByTestId('pasteboard-scroll').evaluate((el) => {
    const slot = el.querySelector('[data-pasteboard-slot]')
    const world = el.querySelector('[data-testid="pasteboard-world"]')
    return {
      scrollHeight: el.scrollHeight,
      slotHeight: slot?.getBoundingClientRect().height ?? 0,
      inset: Number(world?.getAttribute('data-stack-inset') ?? 0),
    }
  })
  // 40 slots of one stride each, between the world's top and bottom margins.
  expect(metrics.slotHeight).toBeGreaterThan(0)
  expect(metrics.scrollHeight).toBeCloseTo(
    2 * metrics.inset + 40 * metrics.slotHeight,
    0,
  )
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
  expect(pasteboardSlotHasContainment(containment.contain)).toBe(true)
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
  await openSessionEditor(page)
  await expect(page.getByTestId('zoom-label')).toHaveText('Fit')

  await chooseZoom(page, '100%')
  await expect(page.getByTestId('zoom-label')).toHaveAttribute(
    'data-zoom-percent',
    '100%',
  )
  const physical = await readSpreadSlots(page)
  expect(physical[0]?.widthPx).toBeCloseTo(300 * (96 / 25.4), 0)
  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'pasteboard-scroll', {
    axis: 'horizontal',
  })

  await chooseZoom(page, 'Fit width')
  const portWidth = await page
    .getByTestId('pasteboard-scroll')
    .evaluate((el) => el.clientWidth)
  const fittedWidth = await readSpreadSlots(page)
  const activeWidth = fittedWidth.find((slot) => slot.active)
  expect(activeWidth?.widthPx).toBeCloseTo(portWidth, 0)

  await chooseZoom(page, 'Fit spread')
  await expect
    .poll(async () => {
      const port = await page
        .getByTestId('pasteboard-scroll')
        .evaluate((el) => ({
          width: el.clientWidth,
          height: el.clientHeight,
        }))
      const box = await page.getByTestId('spread-view').first().boundingBox()
      if (box === null) {
        return false
      }
      return box.width <= port.width + 1 && box.height <= port.height + 1
    })
    .toBe(true)
  await assertDocumentFitsViewport(page)
})

test('wheel, keys, pinch, and space-drag stay inside the pasteboard', async ({
  page,
}) => {
  await openSessionEditor(page)
  await chooseZoom(page, '100%')
  const beforeKey = await readCenterAnchor(page)
  await page.keyboard.press('+')
  expectAnchorHeld(beforeKey, await readCenterAnchor(page))

  const beforeWheel = await readCenterAnchor(page)
  await dispatchCtrlWheel(page, -240, 2)
  expectAnchorHeld(beforeWheel, await readCenterAnchor(page))

  const beforePinch = await readCenterAnchor(page)
  await dispatchPinch(page)
  expectAnchorHeld(beforePinch, await readCenterAnchor(page))

  await chooseZoom(page, '100%')
  const scroll = page.getByTestId('pasteboard-scroll')
  await scroll.focus()
  const topBefore = await scroll.evaluate((el) => el.scrollTop)
  const box = await scroll.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + 120,
  )
  await page.keyboard.down('Space')
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

test('space-drag pans after filmstrip tile focus (PB-04)', async ({ page }) => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
  await openSessionEditor(page)
  await choosePhotoFolder(page, [photoFixturePaths.samplePng])
  const tile = page.getByTestId('filmstrip-item').first()
  await expect(tile).toBeVisible({ timeout: 30_000 })

  await chooseZoom(page, '100%')
  await tile.click()
  await expect(tile).toHaveAttribute('aria-selected', 'true')

  const scroll = page.getByTestId('pasteboard-scroll')
  const topBefore = await scroll.evaluate((el) => el.scrollTop)
  const box = await scroll.boundingBox()
  expect(box).not.toBeNull()
  // Pointer over pasteboard while focus remains on the filmstrip row.
  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + 120,
  )
  await page.keyboard.down('Space')
  await page.mouse.down()
  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + 30,
  )
  await page.mouse.up()
  await page.keyboard.up('Space')
  expect(await scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(topBefore)
  // Space must not toggle filmstrip selection while pan is armed over pasteboard.
  await expect(tile).toHaveAttribute('aria-selected', 'true')
  await assertDocumentFitsViewport(page)
})

test('Space activates focused filmstrip tile with pointer over pasteboard (PB-04b)', async ({
  page,
}) => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
  await openSessionEditor(page)
  await choosePhotoFolder(page, [photoFixturePaths.samplePng])
  const tile = page.getByTestId('filmstrip-item').first()
  await expect(tile).toBeVisible({ timeout: 30_000 })
  await expect(tile).toHaveAttribute('aria-selected', 'false')

  const scroll = page.getByTestId('pasteboard-scroll')
  const topBefore = await scroll.evaluate((el) => el.scrollTop)
  const box = await scroll.boundingBox()
  expect(box).not.toBeNull()
  // Pointer over pasteboard while keyboard focus is on the filmstrip row.
  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + 120,
  )
  await page.bringToFront()
  await tile.focus()
  await expect(tile).toBeFocused()
  await page.keyboard.press('Space')
  await expect(tile).toHaveAttribute('aria-selected', 'true')
  expect(await scroll.evaluate((el) => el.scrollTop)).toBe(topBefore)
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

    await page.evaluate(browserAssertNoLoaf, 0)
    await collectFrameStatsArtifact(page, testInfo)
  })

  test('template switch and add spread stay within frame-budget gates', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    await enablePerfScenario(page, '/?perf=1')
    await openSpreadTab(page)
    await expect(layoutTile(page, '4-grid')).toBeVisible()
    await clearPerfScenario(page)

    await layoutTile(page, '4-grid').click()
    await addSpreadAfterLast(page)
    await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
      'data-spread-count',
      '4',
    )

    await page.evaluate(browserAssertNoLoaf, 0)
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
      .poll(async () => percentOf(await readZoomPercent(page)))
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

  test.describe('continuous zoom settle remount (stabilized)', () => {
    // Zoom-out burst + default settle; gesture ends, then paced remount of
    // newly visible spreads completes with zero LoAF (mounts may finish after
    // gesture end).
    test('continuous zoom-out burst + settle remount stays within frame-budget gates (main parity)', async ({
      page,
    }, testInfo) => {
      test.setTimeout(120_000)
      await enablePerfScenario(page, '/?fixture=painter&perf=1')
      await expect(page.getByTestId('spread-view').first()).toBeVisible()
      await dispatchCtrlWheel(page, 500, 24)
      await expect(page.getByTestId('pasteboard-slot')).toHaveCount(40)
      await clearPerfScenario(page)

      await dispatchCtrlWheel(page, -300, 28)
      await expect
        .poll(async () => percentOf(await readZoomPercent(page)))
        .toBeGreaterThanOrEqual(400)
      await expect.poll(async () => gestureLabel(page)).toBe('')
      await expect
        .poll(
          async () => {
            const sample = await readFilledTier(page)
            return (
              sample.tier === 1280 &&
              sample.src.length > 0 &&
              tierCovers(sample)
            )
          },
          { timeout: 30_000 },
        )
        .toBe(true)
      // 1280 decode paint can land right at the clear; open the window on a
      // quiet frame so it only covers the zoom-out burst (budget stays zero).
      await page.evaluate(browserBeginLoafScenarioWindow)

      await dispatchCtrlWheel(page, 300, 36)
      await expect.poll(async () => gestureLabel(page)).toBe('')
      await expect(page.getByTestId('pasteboard-slot')).toHaveCount(40)
      await page.evaluate(browserAssertNoLoaf, 0)
      // Fit-all after zoom-out may not overflow the pasteboard port vertically.
      await assertDocumentFitsViewport(page)
      await collectFrameStatsArtifact(page, testInfo)
    })
  })

  test.describe('continuous zoom (stabilized)', () => {
    test('continuous zoom stays within frame-budget gates', async ({
      page,
    }, testInfo) => {
      test.setTimeout(120_000)
      await enablePerfScenario(page, '/?fixture=painter&perf=1')
      await expect(page.getByTestId('spread-view').first()).toBeVisible()
      await dispatchCtrlWheel(page, 500, 24)
      await expect(page.getByTestId('pasteboard-slot')).toHaveCount(40)
      await clearPerfScenario(page)

      // Phase 1: continuous zoom-in gesture (exclude async preview decode waits).
      await dispatchCtrlWheel(page, -300, 28)
      await expect
        .poll(async () => percentOf(await readZoomPercent(page)))
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
      await page.evaluate(browserAssertNoLoafThenClear)

      // Phase 2: working preview (1280) after settle — no multi-step ladder.
      await expect
        .poll(
          async () => {
            const sample = await readFilledTier(page)
            return (
              sample.tier === 1280 &&
              sample.src.length > 0 &&
              tierCovers(sample)
            )
          },
          { timeout: 30_000 },
        )
        .toBe(true)
      await page.evaluate(browserAssertNoLoafThenClear)

      // Phase 3: continuous zoom-out burst+paint only. Full gesture-end remount
      // LoAF is the sibling under continuous zoom settle remount (stabilized).
      await dispatchCtrlWheel(page, 300, 36, { settleMs: 0 })
      await page.evaluate(browserAssertNoLoafAndHandlerP95, {
        label: 'wheel-zoom',
        budgetMs: PERF_BUDGETS.handlerP95Ms * PERF_BUDGETS.cpuThrottleRate,
      })
      await page.waitForTimeout(200)
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
      await collectFrameStatsArtifact(page, testInfo)
    })
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

async function readSpreadSlotAt(
  page: Page,
  slotIndex: number,
): Promise<SpreadSlotSnapshot | null> {
  return page.getByTestId('pasteboard-scroll').evaluate((el, index) => {
    const port = el.getBoundingClientRect()
    const slot = el.querySelector(`[data-slot-index="${String(index)}"]`)
    if (!(slot instanceof HTMLElement)) {
      return null
    }
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
  }, slotIndex)
}

interface SpreadViewMetrics {
  widthPx: number
  heightPx: number
  placeholders: number
}

async function readSpreadView(
  page: Page,
  slotIndex: number,
): Promise<SpreadViewMetrics | null> {
  return page.getByTestId('pasteboard-scroll').evaluate((el, index) => {
    const slot = el.querySelector(`[data-slot-index="${String(index)}"]`)
    const view = slot?.querySelector('[data-testid="spread-view"]')
    if (!(slot instanceof HTMLElement) || !(view instanceof HTMLElement)) {
      return null
    }
    const box = view.getBoundingClientRect()
    const styleHeight = Number.parseFloat(view.style.height)
    const styleWidth = Number.parseFloat(view.style.width)
    return {
      widthPx: styleWidth,
      heightPx: box.height > 1 ? box.height : styleHeight,
      placeholders: slot.querySelectorAll(
        '[data-testid="spread-frame-placeholder"]',
      ).length,
    }
  }, slotIndex)
}

async function fitSpreadUntilFilled(page: Page): Promise<void> {
  // Side/bottom chrome eats pasteboard; close spreads + filmstrip for fit geometry.
  for (const testId of ['toggle-l', 'toggle-b'] as const) {
    const toggle = page.getByTestId(testId)
    if ((await toggle.getAttribute('aria-expanded')) === 'true') {
      await toggle.click()
    }
  }
  await chooseZoom(page, 'Fit spread')
  await expect
    .poll(
      async () => {
        const filled = await page
          .getByTestId('pasteboard-scroll')
          .evaluate((el) => {
            const active = el.querySelector('[data-active="true"]')
            const view =
              active?.querySelector('[data-testid="spread-view"]') ??
              el.querySelector(
                '[data-slot-index="0"] [data-testid="spread-view"]',
              )
            if (!(view instanceof HTMLElement)) {
              return false
            }
            const port = el.getBoundingClientRect()
            const box = view.getBoundingClientRect()
            return (
              // Kit fit band: `H − FIT_TOP − FIT_BOTTOM` (viewport.tsx L126).
              box.height >= port.height - 56 - 48 - 2 &&
              box.width >= 1 &&
              box.top >= port.top - 1 &&
              box.bottom <= port.bottom + 1 &&
              box.left >= port.left - 1 &&
              box.right <= port.right + 1
            )
          })
        return filled
      },
      { timeout: 15_000 },
    )
    .toBe(true)
  // Delayed fit may zoom out one more double-rAF after the first contain.
  let previousKey: string | null = null
  await expect
    .poll(
      async () => {
        const key = await page.evaluate(() => {
          const zoom =
            document
              .querySelector('[data-testid="zoom-label"]')
              ?.getAttribute('data-zoom-percent') ?? ''
          const scroll = document.querySelector(
            '[data-testid="pasteboard-scroll"]',
          )
          if (!(scroll instanceof HTMLElement) || zoom === '') {
            return null
          }
          const active = scroll.querySelector('[data-active="true"]')
          const view =
            active?.querySelector('[data-testid="spread-view"]') ??
            scroll.querySelector(
              '[data-slot-index="0"] [data-testid="spread-view"]',
            )
          if (!(view instanceof HTMLElement)) {
            return null
          }
          const box = view.getBoundingClientRect()
          if (box.width < 1 || box.height < 1) {
            return null
          }
          return [zoom, box.width.toFixed(2), box.height.toFixed(2)].join('|')
        })
        if (key === null) {
          previousKey = null
          return false
        }
        if (previousKey !== null && previousKey === key) {
          return true
        }
        previousKey = key
        return false
      },
      { timeout: 15_000 },
    )
    .toBe(true)
}

async function spreadViewContained(
  page: Page,
  slotIndex: number,
): Promise<boolean> {
  return page.getByTestId('pasteboard-scroll').evaluate((el, index) => {
    const slot = el.querySelector(`[data-slot-index="${String(index)}"]`)
    const view = slot?.querySelector('[data-testid="spread-view"]')
    if (!(view instanceof HTMLElement)) {
      return false
    }
    const port = el.getBoundingClientRect()
    const box = view.getBoundingClientRect()
    if (box.width < 1 || box.height < 1) {
      return false
    }
    return (
      box.top >= port.top - 1 &&
      box.bottom <= port.bottom + 1 &&
      box.left >= port.left - 1 &&
      box.right <= port.right + 1
    )
  }, slotIndex)
}

function pasteboardSlotHasContainment(contain: string): boolean {
  return (
    contain === 'content' ||
    (contain.includes('layout') &&
      contain.includes('paint') &&
      contain.includes('style'))
  )
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
  return sample.tier >= sample.longEdge || sample.tier === 1280
}

interface AnchorSample {
  /** Viewport centre in spread-relative units (kit: the point under the anchor). */
  u: number
  v: number
  width: number
  height: number
  anchorX: number
  anchorY: number
  boxLeft: number
  boxTop: number
}

async function readCenterAnchor(page: Page): Promise<AnchorSample> {
  return page.getByTestId('pasteboard-scroll').evaluate((el) => {
    const port = el.getBoundingClientRect()
    const view = el.querySelector('[data-testid="spread-view"]')
    const box =
      view instanceof HTMLElement
        ? view.getBoundingClientRect()
        : new DOMRect(0, 0, 0, 0)
    const anchorX = port.left + port.width / 2
    const anchorY = port.top + port.height / 2
    return {
      u: (anchorX - box.left) / box.width,
      v: (anchorY - box.top) / box.height,
      width: box.width,
      height: box.height,
      anchorX,
      anchorY,
      boxLeft: box.left,
      boxTop: box.top,
    }
  })
}

/** The content point under the viewport centre stays under it (within 1px). */
function expectAnchorHeld(before: AnchorSample, after: AnchorSample): void {
  expect(before.width).toBeGreaterThan(0)
  expect(after.width / before.width).toBeGreaterThan(1)
  const heldX = after.boxLeft + before.u * after.width
  const heldY = after.boxTop + before.v * after.height
  // Subpixel scroll/layout on CI can land ~0.8px off; keep within 1 CSS px.
  expect(Math.abs(heldX - before.anchorX)).toBeLessThan(1)
  expect(Math.abs(heldY - before.anchorY)).toBeLessThan(1)
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

/** First spread's top-left lead at the scrollport: past the world's top margin. */
async function scrollToStackStart(page: Page): Promise<void> {
  await page.getByTestId('pasteboard-scroll').evaluate((el) => {
    const world = el.querySelector('[data-testid="pasteboard-world"]')
    el.scrollTop = Number(world?.getAttribute('data-stack-inset') ?? 0)
  })
}
