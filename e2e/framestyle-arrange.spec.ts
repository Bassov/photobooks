import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { installPhotoDirectoryPickerStub } from './fixtures/photoDirectoryPicker'
import {
  browserAssertNoLoafThenClear,
  browserBeginLoafScenarioWindow,
  clearPerfScenario,
  enablePerfScenario,
} from './perf/perfFixture'

// framestyle-arrange-unhide (M78): one book-level style restyles every frame
// that uses it; Arrange restacks through `reorderFrame` (src/core/ops/arrange.ts).

const canvas = (page: Page) => page.getByTestId('pasteboard-scroll')
const styled = (page: Page) => canvas(page).locator('[data-frame-style]')

async function openInspector(page: Page) {
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
}

async function openSection(page: Page, id: 'style' | 'arrange') {
  const trigger = page
    .getByTestId(`inspector-${id}-disclosure`)
    .locator('.pb-disclosure__trigger')
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
    await trigger.click()
  }
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
}

async function selectPhotoFrame(page: Page, frame: Locator) {
  await frame.click()
  await expect(page.getByTestId('inspector-context')).toHaveText('Photo')
}

/**
 * White mat on the first frame, then Ctrl+D on its spread row `copies` times:
 * every copy carries the same book-level style.
 */
async function styleAndDuplicate(page: Page, copies: number) {
  await openInspector(page)
  const frame = canvas(page).getByTestId('spread-frame').first()
  await selectPhotoFrame(page, frame)
  const spreadId = await frame.evaluate(
    (el) =>
      el.closest('[data-spread-id]')?.getAttribute('data-spread-id') ?? '',
  )
  await openSection(page, 'style')
  await page.getByRole('button', { name: 'White mat', exact: true }).click()
  await expect(styled(page)).toHaveCount(1)
  const row = page.locator(`[data-item="${spreadId}"]`)
  await row.focus()
  for (let at = 0; at < copies; at += 1) {
    await row.press('Control+d')
  }
  await expect(page.locator('[data-item]')).not.toHaveCount(0)
  await selectPhotoFrame(page, styled(page).first())
  await openSection(page, 'style')
  await expect(page.getByTestId('style-uses')).toContainText(
    `updates all ${String(copies + 1)} frames`,
  )
}

async function shadows(page: Page) {
  return styled(page).evaluateAll((els) =>
    els.map((el) => getComputedStyle(el).boxShadow),
  )
}

/** Bare spread: the Frame tool draws only on empty paper. */
async function clearSpread(page: Page, frames: Locator) {
  for (let guard = 0; guard < 8 && (await frames.count()) > 0; guard++) {
    if ((await page.getByTestId('frame-delete').count()) === 0) {
      await frames.first().click()
    }
    await page.getByTestId('frame-delete').click()
  }
  await expect(frames).toHaveCount(0)
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('spread not visible')
  return box
}

async function stepMat(page: Page, key: 'ArrowRight' | 'ArrowLeft') {
  const slider = page.getByTestId('style-mat').getByRole('slider')
  await slider.focus()
  // Mat steps 0.5 mm: four steps move 3 mm ↔ 5 mm.
  for (let at = 0; at < 4; at += 1) {
    await slider.press(key)
  }
}

test.describe('Frame style and Arrange', () => {
  test.beforeEach(async ({ page }) => {
    await installPhotoDirectoryPickerStub(page)
    await openSessionEditor(page)
  })

  test('a style edit restyles every frame that uses it', async ({ page }) => {
    test.setTimeout(90_000)
    await styleAndDuplicate(page, 2)
    await expect(styled(page)).toHaveCount(3)
    const threeMm = await shadows(page)
    expect(new Set(threeMm).size).toBe(1)

    await stepMat(page, 'ArrowRight')
    await expect(page.getByTestId('style-mat').locator('output')).toHaveText(
      '5 mm',
    )
    await expect.poll(async () => new Set(await shadows(page)).size).toBe(1)
    const fiveMm = await shadows(page)
    expect(fiveMm[0]).not.toBe(threeMm[0])

    await stepMat(page, 'ArrowLeft')
    await expect.poll(() => shadows(page)).toEqual(threeMm)
    await expect(styled(page)).toHaveCount(3)
  })

  test('Send to back puts the top frame behind the one it overlaps', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await openInspector(page)
    const view = page.getByTestId('spread-view').first()
    const frames = view.getByTestId('spread-frame')
    await clearSpread(page, frames)
    const box = await boxOf(view)
    // Two overlapping frames drawn with the Frame tool; the later one is on top.
    // The second drag starts on bare paper and ends inside the first frame.
    for (const [x0, y0, x1, y1] of [
      [0.1, 0.2, 0.6, 0.6],
      [0.9, 0.8, 0.4, 0.4],
    ] as const) {
      await page.keyboard.press('f')
      await page.mouse.move(box.x + box.width * x0, box.y + box.height * y0)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width * x1, box.y + box.height * y1, {
        steps: 6,
      })
      await page.mouse.up()
    }
    await expect(frames).toHaveCount(2)
    const drawn = await frames.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-frame-id') ?? ''),
    )
    const topAt = () =>
      page.evaluate(
        ({ x, y }) =>
          document
            .elementFromPoint(x, y)
            ?.closest('[data-testid="spread-frame"]')
            ?.getAttribute('data-frame-id'),
        { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 },
      )
    expect(await topAt()).toBe(drawn[1])

    await expect(page.getByTestId('inspector-context')).toHaveText('Photo')
    await openSection(page, 'arrange')
    const layer = page.getByTestId('frame-layer')
    const before = (await layer.textContent()) ?? ''
    await page.getByTestId('z-back').click()
    await expect(layer).not.toHaveText(before)
    await expect(layer).toHaveText(/^layer 1 of /)
    await expect.poll(topAt).toBe(drawn[0])

    await page.getByTestId('z-front').click()
    await expect.poll(topAt).toBe(drawn[1])
  })
})

test.describe('Frame style frame-budget gates', () => {
  test('editing a style used on 40 spreads logs no LoAF', async ({ page }) => {
    test.setTimeout(240_000)
    await enablePerfScenario(page)
    await styleAndDuplicate(page, 39)
    const slider = page.getByTestId('style-mat').getByRole('slider')
    await slider.focus()

    await page.evaluate(browserBeginLoafScenarioWindow)
    await clearPerfScenario(page)
    for (let at = 0; at < 4; at += 1) {
      await slider.press('ArrowRight')
      await page.waitForTimeout(120)
    }
    await expect(page.getByTestId('style-mat').locator('output')).toHaveText(
      '5 mm',
    )
    await page.waitForTimeout(300)
    await page.evaluate(browserAssertNoLoafThenClear)
  })
})
