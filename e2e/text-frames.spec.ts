import type { Locator, Page } from '@playwright/test'
import { createBookViaLibrary } from './fixtures/createBookViaLibrary'
import { expect, test } from './fixtures/coverage'
import { applyContactSheet } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { PERF_BUDGETS } from './perf/budgets'
import { clearPerfScenario, enablePerfScenario } from './perf/perfFixture'

// text-frames-editor (Designer text-frames, Items 3): the Text tool, the edit
// overlay, the Overflow chip and the Text inspector.

const spreadView = (page: Page) => page.getByTestId('spread-view').first()
const textFrames = (page: Page) =>
  spreadView(page).locator('button.spread-frame[data-kind="text"]')
const editBox = (page: Page) => page.getByTestId('text-edit')

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) {
    throw new Error('not visible')
  }
  return box
}

async function openInspector(page: Page) {
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
}

/** Text tool click at a fraction of the spread box. */
async function clickText(page: Page, fx: number, fy: number) {
  const box = await boxOf(spreadView(page))
  await page.keyboard.press('t')
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy)
}

/** Click-create a text frame, type, leave with Esc. */
async function addText(page: Page, text: string) {
  await clickText(page, 0.55, 0.3)
  await expect(editBox(page)).toBeFocused()
  await page.keyboard.type(text)
  await page.keyboard.press('Escape')
  await expect(editBox(page)).toHaveCount(0)
}

/**
 * How a painted text node sets its text, relative to its frame width (layout
 * px, so the camera zoom and the thumbnail scale both cancel out).
 */
async function textLook(text: Locator) {
  return text.evaluate((el) => {
    if (!(el instanceof HTMLElement)) {
      throw new Error('not an element')
    }
    const frame = el.closest('.spread-frame')
    if (!(frame instanceof HTMLElement)) {
      throw new Error('no frame')
    }
    const s = getComputedStyle(el)
    const range = document.createRange()
    range.selectNodeContents(el)
    const tops = new Set(
      // Hundredths of a px: thumbnail lines sit about 1 px apart.
      [...range.getClientRects()].map((rect) => Math.round(rect.top * 100)),
    )
    return {
      family: s.fontFamily,
      weight: s.fontWeight,
      color: s.color,
      align: s.textAlign,
      lines: tops.size,
      sizePerWidth: parseFloat(s.fontSize) / frame.offsetWidth,
      heightPerWidth: el.offsetHeight / frame.offsetWidth,
    }
  })
}

test.describe('text frames', () => {
  test('a Text click makes a 60 × 14 mm frame, typing lands, Esc keeps then drops the selection', async ({
    page,
  }) => {
    await openSessionEditor(page)
    const images = await spreadView(page).getByTestId('spread-frame').count()
    await clickText(page, 0.55, 0.3)
    await expect(editBox(page)).toBeFocused()
    await expect(editBox(page)).toHaveAttribute('placeholder', 'Type text')
    await expect(page.getByTestId('tool-select')).toBeChecked()
    const frame = textFrames(page)
    await expect(frame).toHaveCount(1)
    await expect(frame).toHaveAttribute('data-editing', 'true')
    await expect(frame.getByTestId('sel-handle')).toHaveCount(0)
    const box = await boxOf(frame)
    expect(box.width / box.height).toBeCloseTo(60 / 14, 1)

    await page.keyboard.type('Morning on the lake')
    await page.keyboard.press('Escape')
    await expect(editBox(page)).toHaveCount(0)
    await expect(frame.getByTestId('frame-text')).toHaveText(
      'Morning on the lake',
    )
    await expect(frame).toHaveAttribute('aria-pressed', 'true')
    await expect(frame.getByTestId('sel-handle')).toHaveCount(8)
    await page.keyboard.press('Escape')
    await expect(frame).not.toHaveAttribute('aria-pressed', 'true')
    await expect(spreadView(page).getByTestId('spread-frame')).toHaveCount(
      images + 1,
    )
  })

  test('a Text drag over a photo frame draws the frame draft and makes a text frame there', async ({
    page,
  }) => {
    await openSessionEditor(page)
    const image = spreadView(page)
      .locator('button.spread-frame:not([data-kind="text"])')
      .first()
    const box = await boxOf(image)
    await page.keyboard.press('t')
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.6)
    await page.mouse.down()
    await page.mouse.move(
      box.x + box.width * 0.2 + 160,
      box.y + box.height * 0.6 + 40,
      {
        steps: 4,
      },
    )
    await expect(page.getByTestId('frame-draft')).toBeVisible()
    await page.mouse.up()
    await expect(editBox(page)).toBeFocused()
    const text = await boxOf(textFrames(page))
    expect(text.width).toBeGreaterThan(150)
    expect(text.x).toBeGreaterThanOrEqual(box.x)
    await page.keyboard.type('On the photo')
    await page.keyboard.press('Control+Enter')
    await expect(textFrames(page).getByTestId('frame-text')).toHaveText(
      'On the photo',
    )
  })

  test('an empty new frame is removed; Enter and double-click edit with the caret at the end', async ({
    page,
  }) => {
    await openSessionEditor(page)
    const count = await spreadView(page).getByTestId('spread-frame').count()
    await clickText(page, 0.55, 0.3)
    await expect(editBox(page)).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(textFrames(page)).toHaveCount(0)
    await expect(spreadView(page).getByTestId('spread-frame')).toHaveCount(
      count,
    )
    await expect(page.getByTestId('undo')).toBeDisabled()

    await addText(page, 'Lake')
    await page.keyboard.press('Enter')
    await expect(editBox(page)).toBeFocused()
    await expect(editBox(page)).toHaveValue('Lake')
    const caret = await editBox(page).evaluate(
      (node) => (node as HTMLTextAreaElement).selectionStart,
    )
    expect(caret).toBe(4)
    await page.keyboard.type(' at dawn')
    await page.keyboard.press('Escape')
    await textFrames(page).dblclick()
    await expect(editBox(page)).toHaveValue('Lake at dawn')
    await page.keyboard.press('Escape')

    // One step per edit session, "Add text" for create + first typing.
    await page.keyboard.press('Control+z')
    await expect(textFrames(page).getByTestId('frame-text')).toHaveText('Lake')
    await page.keyboard.press('Control+z')
    await expect(textFrames(page)).toHaveCount(0)
  })

  test('Title restyle shows the Overflow chip and the inspector meta; Preview shows none', async ({
    page,
  }) => {
    await openSessionEditor(page)
    await addText(page, 'Morning on the lake, 6:40')
    await openInspector(page)
    await expect(page.getByTestId('inspector-context')).toHaveText('Text')
    await expect(page.getByTestId('text-overflow-chip')).toHaveCount(0)
    await page
      .getByTestId('inspector-text')
      .getByRole('radio', { name: 'Title' })
      .check({ force: true })
    const chip = page.getByTestId('text-overflow-chip')
    await expect(chip).toBeVisible()
    await expect(chip).toHaveText('Overflow')
    await expect(page.getByTestId('inspector-meta')).toHaveText(
      'Text overflows the frame',
    )
    const frame = await boxOf(textFrames(page))
    const chipBox = await boxOf(chip)
    expect(
      Math.abs(chipBox.x + chipBox.width - (frame.x + frame.width)),
    ).toBeLessThan(1)
    expect(Math.abs(chipBox.y - (frame.y + frame.height + 4))).toBeLessThan(1)
    expect(chipBox.height).toBeCloseTo(14, 0)
    // Kit TextSection: the Live block off (12 + 12 px, switch 20, gap 8,
    // chips 24 — Designer live-captions "Live-off: bottom 310"), then 12 px
    // section + 16 px disclosure + 1 px divider; meta line 14 px tall.
    const input = await boxOf(page.getByTestId('text-input'))
    const geometry = await boxOf(
      page.getByTestId('inspector-geometry-disclosure'),
    )
    expect(geometry.y - (input.y + input.height)).toBeCloseTo(29 + 76, 1)
    expect((await boxOf(page.getByTestId('inspector-meta'))).height).toBe(14)

    // Editing hides the chip; Preview never paints it.
    await textFrames(page).dblclick()
    await expect(editBox(page)).toBeFocused()
    await expect(chip).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(chip).toBeVisible()
    await page.getByTestId('present').click()
    const preview = page.getByTestId('site-preview')
    await expect(preview.getByTestId('site-label')).toHaveText('Cover')
    await page.keyboard.press('ArrowRight')
    const slide = preview.getByTestId('ps-reader')
    await expect(slide.getByTestId('frame-text')).not.toHaveCount(0)
    await expect(preview.getByTestId('text-overflow-chip')).toHaveCount(0)
  })

  test('a layout keeps the text and the list thumbnail paints it', async ({
    page,
  }) => {
    await openSessionEditor(page)
    await addText(page, 'Kept')
    // Deselect: the Spread inspector holds the Layout section.
    await page.keyboard.press('Escape')
    await applyContactSheet(page, 2, 1)
    await expect(textFrames(page).getByTestId('frame-text')).toHaveText('Kept')
    await expect(
      page
        .getByTestId('spreads-list')
        .locator('.spread-view--thumb .spread-frame-text')
        .filter({ hasText: 'Kept' }),
    ).toHaveCount(1)
  })

  test('a caption renders the same in the workspace and the spread thumbnail', async ({
    page,
  }) => {
    await openSessionEditor(page)
    const caption = 'Morning on the lake at 6:40, mist over the water'
    await addText(page, caption)
    await page.keyboard.press('Escape')
    const canvas = textFrames(page).getByTestId('frame-text')
    const thumb = page
      .getByTestId('spreads-list')
      .locator('.spread-view--thumb .spread-frame-text')
      .filter({ hasText: caption })
    await expect(canvas).toHaveText(caption)
    await expect(thumb).toHaveCount(1)
    const [onCanvas, inThumb] = await Promise.all([
      textLook(canvas),
      textLook(thumb),
    ])
    expect(onCanvas.lines).toBe(2)
    expect(inThumb).toEqual({
      ...onCanvas,
      sizePerWidth: expect.closeTo(onCanvas.sizePerWidth, 3),
      heightPerWidth: expect.closeTo(onCanvas.heightPerWidth, 2),
    })
  })

  test('text frames are not drop targets: the text box selects, never swaps', async ({
    page,
  }) => {
    await openSessionEditor(page)
    await addText(page, 'Label')
    await openInspector(page)
    await expect(page.getByTestId('inspector-text')).toBeVisible()
    await expect(page.getByTestId('inspector-fit-crop')).toHaveCount(0)
    await expect(page.getByTestId('inspector-caption-disclosure')).toHaveCount(
      0,
    )
    await expect(page.getByTestId('frame-delete')).toBeVisible()
  })

  test('reload keeps the text', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/?testLibrary=1')
    await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
      timeout: 15_000,
    })
    page.once('dialog', (dialog) => {
      void dialog.accept('Text reload')
    })
    await createBookViaLibrary(page)
    await expect(page.getByTestId('editor-status')).toHaveText('Book created')
    await addText(page, 'Saved caption')
    await page.keyboard.press('Control+s')
    await expect(page.getByTestId('editor-status')).toHaveText('Book saved', {
      timeout: 15_000,
    })
    await page.reload()
    await expect(page.getByTestId('editor-status')).toHaveText(
      'Book restored',
      {
        timeout: 20_000,
      },
    )
    await expect(textFrames(page).getByTestId('frame-text')).toHaveText(
      'Saved caption',
    )
  })
})

test.describe('frame-budget gates', () => {
  test('typing 200 characters in a text frame keeps INP within budget', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await enablePerfScenario(page, '/?perf=1')
    await clickText(page, 0.55, 0.3)
    await expect(editBox(page)).toBeFocused()
    await clearPerfScenario(page)
    const text = 'Morning on the lake at 6:40, mist over the water. '.repeat(4)
    await page.keyboard.type(text.slice(0, 200))
    await page.keyboard.press('Escape')
    await expect(textFrames(page).getByTestId('frame-text')).toContainText(
      'Morning on the lake',
    )
    const budget = PERF_BUDGETS.inpMs * PERF_BUDGETS.cpuThrottleRate
    await page.evaluate((inpBudgetMs) => {
      window.__photobooksPerf?.assertInpWithinBudget(inpBudgetMs)
    }, budget)
  })
})
