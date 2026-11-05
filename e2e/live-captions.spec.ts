import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
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

const spreadView = (page: Page) => page.getByTestId('spread-view').first()
const imageFrame = (page: Page) =>
  spreadView(page)
    .locator('button.spread-frame:not([data-kind="text"])')
    .first()
const textFrame = (page: Page) =>
  spreadView(page).locator('button.spread-frame[data-kind="text"]')
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

/**
 * Import both EXIF photos, put the lake on the first image frame and write
 * `text` in a new text frame over its lower part (so it anchors there).
 */
async function captionUnderLake(page: Page, text: string) {
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
  await dropAssetOnFrame(page, lake, imageFrame(page))
  const box = await boxOf(imageFrame(page))
  await page.keyboard.press('t')
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.8)
  await expect(page.getByTestId('text-edit')).toBeFocused()
  await page.keyboard.type(text)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('text-edit')).toHaveCount(0)
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
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

test('Live block layout matches the kit: one chip row, Designer y positions', async ({
  page,
}) => {
  await captionUnderLake(page, 'Morning on the lake, 6:40')
  await page.getByTestId('live-token-date').click()
  await expect(page.getByTestId('live-caption-anchor')).toBeVisible()
  const ys = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="panel-r"]')
    const box = (selector: string) => {
      const el = document.querySelector(selector)
      if (panel === null || el === null) {
        throw new Error(`missing ${selector}`)
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
      section: box('[data-testid="inspector-text"]'),
      chipRows: new Set(chips).size,
      scroll: [
        document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
        document.documentElement.scrollHeight -
          document.documentElement.clientHeight,
      ],
    }
  })
  const near = (got: number[] | undefined, want: number[]) => {
    expect(got?.length).toBe(want.length)
    want.forEach((value, index) => {
      expect(Math.abs((got?.[index] ?? NaN) - value)).toBeLessThanOrEqual(1)
    })
  }
  near(ys.textarea, [158, 222])
  near(ys.row, [246, 266])
  near(ys.select, [296.8, 328.8])
  near(ys.chips, [336.8, 360.8])
  expect(ys.section[1]).toBeCloseTo(372.8, 0)
  expect(ys.chipRows).toBe(1)
  expect(ys.scroll).toEqual([0, 0])
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
