import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { dropAssetOnFrame } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import { PERF_BUDGETS } from './perf/budgets'
import {
  browserAssertNoLoaf,
  browserBeginLoafScenarioWindow,
  browserStartLoafScripts,
  browserTakeLoafScripts,
  clearPerfScenario,
  collectFrameStatsArtifact,
  enablePerfScenario,
} from './perf/perfFixture'

// Designer live-captions (item 3, prod UI): a text frame's Live block reads
// the EXIF of the photo in its anchor frame (real import + head pass).

test.beforeAll(() => {
  ensurePhotoFixtures({ includeLargeJpeg: false })
})

test.beforeEach(async ({ page }) => {
  await installPhotoDirectoryPickerStub(page)
})

/** The n-th painted spread (session editor: page 1 alone, then 2–3). */
const spreadView = (page: Page, n = 0) => page.getByTestId('spread-view').nth(n)
const imageFrames = (page: Page, n = 0) =>
  spreadView(page, n).locator('button.spread-frame:not([data-kind="text"])')
const imageFrame = (page: Page, n = 0) => imageFrames(page, n).first()
/** Each test makes one text frame in the whole book. */
const textFrame = (page: Page) =>
  page
    .getByTestId('spread-view')
    .locator('button.spread-frame[data-kind="text"]')
const canvasText = (page: Page) => textFrame(page).getByTestId('frame-text')
const liveSwitch = (page: Page) => page.getByTestId('live-caption-switch')

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) {
    throw new Error('not visible')
  }
  return box
}

async function assetId(page: Page, name: string): Promise<string> {
  const row = page.getByRole('row', { name })
  await expect(row).toHaveAttribute('data-asset-id', /.+/)
  return (await row.getAttribute('data-asset-id')) ?? ''
}

async function openInspector(page: Page) {
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
}

/**
 * Import both EXIF photos, put the lake on the first image frame and write
 * `text` in a new text frame over its lower part (so it anchors there).
 */
async function captionUnderLake(page: Page, text: string, spread = 0) {
  await openSessionEditor(page)
  await page.bringToFront()
  await choosePhotoFolder(page, [
    photoFixturePaths.metaLake,
    photoFixturePaths.metaHill,
  ])
  await expect(page.getByTestId('filmstrip-item')).toHaveCount(2, {
    timeout: 30_000,
  })
  const lake = await assetId(page, 'meta-lake.jpg')
  const hill = await assetId(page, 'meta-hill.jpg')
  await dropAssetOnFrame(page, lake, imageFrame(page, spread))
  const box = await boxOf(imageFrame(page, spread))
  await page.keyboard.press('t')
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.8)
  await expect(page.getByTestId('text-edit')).toBeFocused()
  await page.keyboard.type(text)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('text-edit')).toHaveCount(0)
  await openInspector(page)
  await expect(page.getByTestId('inspector-context')).toHaveText('Text')
  // The head pass stored the lake's EXIF: the chips read it.
  await expect(page.getByTestId('live-token-date')).toHaveAttribute(
    'title',
    '12 Jul 2025',
    { timeout: 15_000 },
  )
  return { lake, hill }
}

/** Select the text frame again (a drop selects the photo). */
async function selectText(page: Page) {
  await textFrame(page).click()
  await expect(page.getByTestId('inspector-context')).toHaveText('Text')
}

test('chip date makes the caption live; a new photo updates it; Make static freezes it', async ({
  page,
}) => {
  const { lake, hill } = await captionUnderLake(page, 'Lake')
  await expect(liveSwitch(page)).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByTestId('live-caption-anchor')).toHaveCount(0)
  await expect(page.getByTestId('live-token-title')).toHaveAttribute(
    'title',
    'Morning on the lake',
  )

  await page.getByTestId('live-token-date').click()
  await expect(liveSwitch(page)).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('text-input')).toHaveValue('Lake · {date}')
  await expect(canvasText(page)).toHaveText('Lake · 12 Jul 2025')
  const anchor = page.getByTestId('live-caption-anchor')
  await expect(anchor.locator('option:checked')).toHaveText(
    'Frame 1 · meta-lake.jpg',
  )

  await dropAssetOnFrame(page, hill, imageFrame(page))
  await expect(canvasText(page)).toHaveText('Lake · 5 Mar 2024')

  await selectText(page)
  await liveSwitch(page).click()
  await expect(liveSwitch(page)).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByTestId('text-input')).toHaveValue('Lake · 5 Mar 2024')
  await dropAssetOnFrame(page, lake, imageFrame(page))
  await expect(canvasText(page)).toHaveText('Lake · 5 Mar 2024')
})

test('deleting the anchor frame makes the caption static; undo restores Live', async ({
  page,
}) => {
  await captionUnderLake(page, 'Shot on')
  await page.getByTestId('live-token-camera').click()
  await expect(canvasText(page)).toHaveText('Shot on · Canon EOS R5')

  const box = await boxOf(imageFrame(page))
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.2)
  await expect(page.getByTestId('inspector-context')).toHaveText('Photo')
  await page.getByTestId('frame-delete').scrollIntoViewIfNeeded()
  await page.getByTestId('frame-delete').click()
  await expect(canvasText(page)).toHaveText('Shot on · Canon EOS R5')
  await selectText(page)
  await expect(liveSwitch(page)).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByTestId('text-input')).toHaveValue(
    'Shot on · Canon EOS R5',
  )

  await page.keyboard.press('Control+z')
  await expect(liveSwitch(page)).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('text-input')).toHaveValue('Shot on · {camera}')
})

/**
 * Top / bottom (px, rel. the inspector panel) of each Live block part that
 * is rendered, and how many rows the chips take.
 */
async function liveLayout(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-testid="panel-r"]')
    const box = (selector: string) => {
      const el = document.querySelector(selector)
      if (panel === null || el === null) {
        return null
      }
      const top = panel.getBoundingClientRect().top
      const r = el.getBoundingClientRect()
      return [r.top - top, r.bottom - top].map((v) => Math.round(v * 10) / 10)
    }
    const chips = [
      ...document.querySelectorAll('[data-testid^="live-token-"]'),
    ].map((chip) => chip.getBoundingClientRect().top)
    return {
      textarea: box('[data-testid="text-input"]'),
      row: box('.live-caption-row'),
      select: box('[data-testid="live-caption-anchor"]'),
      chips: box('[data-testid="live-tokens"]'),
      hint: box('[data-testid="live-caption-hint"]'),
      section: box('[data-testid="inspector-text"]')?.[1],
      chipRows: new Set(chips).size,
    }
  })
}

/** Within 1 px of the Designer spec numbers. */
function near(got: number[] | null | undefined, want: number[]) {
  expect(got?.length).toBe(want.length)
  want.forEach((value, index) => {
    expect(Math.abs((got?.[index] ?? NaN) - value)).toBeLessThanOrEqual(1)
  })
}

test('Live block layout matches the kit: one chip row, Designer y positions off and on', async ({
  page,
}) => {
  await captionUnderLake(page, 'Morning on the lake, 6:40')
  const off = await liveLayout(page)
  near(off.textarea, [158, 222])
  near(off.row, [246, 266])
  expect(off.select).toBeNull()
  near(off.chips, [274, 298])
  near([off.section ?? NaN], [310])
  expect(off.chipRows).toBe(1)

  await page.getByTestId('live-token-date').click()
  await expect(page.getByTestId('live-caption-anchor')).toBeVisible()
  const on = await liveLayout(page)
  near(on.textarea, [158, 222])
  near(on.row, [246, 266])
  near(on.select, [296.8, 328.8])
  near(on.chips, [336.8, 360.8])
  near([on.section ?? NaN], [372.8])
  expect(on.chipRows).toBe(1)
  await assertDocumentFitsViewport(page)
})

test('a chip lands at the Text caret; Anchored to switches the photo it reads', async ({
  page,
}) => {
  const { hill } = await captionUnderLake(page, 'At , ok', 1)
  await dropAssetOnFrame(page, hill, imageFrames(page, 1).nth(1))
  await selectText(page)
  const field = page.getByTestId('text-input')
  await field.focus()
  await field.evaluate((el) => {
    if (el instanceof HTMLTextAreaElement) {
      el.setSelectionRange(3, 3)
    }
  })
  await page.getByTestId('live-token-date').click()
  await expect(field).toHaveValue('At {date}, ok')
  await expect(canvasText(page)).toHaveText('At 12 Jul 2025, ok')

  await page
    .getByTestId('live-caption-anchor')
    .selectOption({ label: 'Frame 2 · meta-hill.jpg' })
  await expect(canvasText(page)).toHaveText('At 5 Mar 2024, ok')
  await expect(page.getByTestId('live-token-camera')).toHaveAttribute(
    'title',
    'Apple iPhone 15 Pro',
  )
})

test('a spread with no image frame: disabled switch and the hint, no chips', async ({
  page,
}) => {
  await page.goto('/?fixture=painter')
  await expect(spreadView(page)).toBeVisible()
  await openInspector(page)
  // Delete the first spread's photo frames one by one.
  while ((await imageFrames(page).count()) > 0) {
    const box = await boxOf(imageFrames(page).first())
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.getByTestId('frame-delete').click()
  }
  const box = await boxOf(spreadView(page))
  await page.keyboard.press('t')
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.4)
  await page.keyboard.type('Morning on the lake, 6:40')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('inspector-context')).toHaveText('Text')

  await expect(liveSwitch(page)).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByTestId('live-caption-hint')).toHaveText(
    'Add a photo frame to this spread to use its metadata.',
  )
  await expect(page.getByTestId('live-tokens')).toHaveCount(0)
  // aria-disabled fails Playwright's enabled check: click it as a user would.
  await liveSwitch(page).dispatchEvent('click')
  await expect(liveSwitch(page)).toHaveAttribute('aria-checked', 'false')
  const layout = await liveLayout(page)
  near(layout.row, [246, 266])
  near(layout.hint, [274, 302])
  near([layout.section ?? NaN], [314])
})

// Perf: `&captions=4` puts a live caption (`{title} · {date}`) on each of
// spread 2's four photos; frame drags swap the photos across the spread.
const CAPTION_SPREAD = 'painter-spread-1'
const FRAME_DRAG_MIME = 'application/x-photobooks-frame'

const captionTexts = (page: Page) =>
  page
    .locator(`[data-spread-id="${CAPTION_SPREAD}"] [data-testid="frame-text"]`)
    .allTextContents()

async function openCaptionSpread(page: Page): Promise<string[]> {
  await page.getByTestId(`spread-list-item-${CAPTION_SPREAD}`).click()
  await expect.poll(async () => (await captionTexts(page)).length).toBe(4)
  return captionTexts(page)
}

/** Drag the photo of image frame `from` onto image frame `to` (a swap). */
async function swapFrames(page: Page, from: number, to: number) {
  await page.evaluate(
    ({ mime, spreadId, from: a, to: b }) => {
      const frames = [
        ...document.querySelectorAll<HTMLElement>(
          `[data-spread-id="${spreadId}"] button.spread-frame:not([data-kind="text"])`,
        ),
      ]
      const source = frames[a]
      const target = frames[b]?.getBoundingClientRect()
      const scroll = document.querySelector('[data-testid="pasteboard-scroll"]')
      if (source === undefined || target === undefined || scroll === null) {
        throw new Error('missing frames')
      }
      const dataTransfer = new DataTransfer()
      dataTransfer.setData(
        mime,
        `${spreadId}\n${source.getAttribute('data-frame-id') ?? ''}`,
      )
      const point = {
        clientX: target.left + target.width / 2,
        clientY: target.top + target.height / 4,
      }
      document.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, dataTransfer }),
      )
      for (const type of ['dragover', 'drop']) {
        scroll.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            ...point,
          }),
        )
      }
      document.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
    },
    { mime: FRAME_DRAG_MIME, spreadId: CAPTION_SPREAD, from, to },
  )
}

test('swapping photos across a spread updates only the live captions of the swapped frames', async ({
  page,
}) => {
  await page.goto(`/?fixture=painter&captions=4`)
  const before = await openCaptionSpread(page)
  expect(before).toEqual([
    'Photo painter-a · 10 Jul 2025',
    'Photo painter-b · 11 Jul 2025',
    'Photo painter-c · 12 Jul 2025',
    'Photo painter-d · 13 Jul 2025',
  ])
  await swapFrames(page, 0, 1)
  await expect
    .poll(() => captionTexts(page))
    .toEqual([before[1], before[0], before[2], before[3]])
})

test.describe('frame-budget gates', () => {
  test('swaps across a spread with 4 live captions stay LoAF-free', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000)
    await enablePerfScenario(page, '/?fixture=painter&perf=1&captions=4')
    const before = await openCaptionSpread(page)
    await clearPerfScenario(page)
    // Attribution first, so every entry the gate counts is also logged.
    await page.evaluate(browserStartLoafScripts)
    await page.evaluate(browserBeginLoafScenarioWindow)
    await swapFrames(page, 0, 3)
    await expect.poll(() => captionTexts(page)).not.toEqual(before)
    await swapFrames(page, 1, 2)
    await expect
      .poll(() => captionTexts(page))
      .toEqual([before[3], before[2], before[1], before[0]])
    const rows = await page.evaluate(browserTakeLoafScripts)
    console.log(
      `live-captions-perf swap: ${String(rows.length)} LoAF ${JSON.stringify(rows)}`,
    )
    await page.evaluate(browserAssertNoLoaf, PERF_BUDGETS.loafEntriesMax)
    await collectFrameStatsArtifact(page, testInfo)
  })
})
