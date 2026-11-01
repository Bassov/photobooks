import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { addSpreads } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  browserAssertNoLoaf,
  browserBeginLoafScenarioWindow,
  clearPerfScenario,
  collectFrameStatsArtifact,
  enablePerfScenario,
} from './perf/perfFixture'

test('present opens fullscreen without editor chrome; keys, click and Esc work', async ({
  page,
}) => {
  await openSessionEditor(page)
  await expect(page.getByTestId('present')).toBeEnabled()
  await page.getByTestId('present').click()

  const stage = page.getByTestId('presentation')
  await expect(stage).toBeVisible()
  // Owner design change (round 7, M53): Preview opens on the cover.
  await expect(page.getByTestId('pager-position')).toHaveText('Cover')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('pager-position')).toHaveText('1 / 3')
  const barCovered = await page.getByTestId('editor-bar').evaluate((bar) => {
    const r = bar.getBoundingClientRect()
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return top?.closest('[data-testid="presentation"]') !== null
  })
  expect(barCovered).toBe(true)
  // Pager mounts only the current spread and its neighbours (first of 3 → 2).
  await expect(page.getByTestId('spread-view')).toHaveCount(2)
  await assertDocumentFitsViewport(page)

  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('pager-position')).toHaveText('2 / 3')
  const width = await stage.evaluate((el) => el.clientWidth)
  await stage.click({ position: { x: width - 20, y: 200 } })
  await expect(page.getByTestId('pager-position')).toHaveText('3 / 3')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('pager-position')).toHaveText('3 / 3')
  await stage.click({ position: { x: 20, y: 200 } })
  await expect(page.getByTestId('pager-position')).toHaveText('2 / 3')

  await page.keyboard.press('Escape')
  await expect(stage).toHaveCount(0)
  await expect(page.getByTestId('editor-bar')).toBeVisible()
  await expect(page.getByTestId('pasteboard-scroll')).toBeVisible()
})

test.describe('frame-budget gates', () => {
  test('flipping through 40 spreads in presentation stays within frame-budget gates', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000)
    await enablePerfScenario(page, '/?perf=1')
    await addSpreads(page, 37)
    await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
      'data-spread-count',
      '40',
    )
    // Row Add after selects the new spread; start the show from spread 1.
    const firstRow = page.getByTestId(/^spread-list-item-/).first()
    await firstRow.click()
    await expect(firstRow).toHaveAttribute('aria-selected', 'true')
    await page.getByTestId('present').click()
    // Owner design change (round 7, M53): Preview opens on the cover.
    await expect(page.getByTestId('pager-position')).toHaveText('Cover')
    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('pager-position')).toHaveText('1 / 40')
    const flip = async (key: 'ArrowLeft' | 'ArrowRight'): Promise<void> => {
      await page.keyboard.press(key)
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              resolve()
            })
          }),
      )
    }
    // Warm the first neighbour mounts and let the 200 ms slide transitions
    // settle, so the measured window covers steady-state flips (budget stays
    // zero entries).
    for (const key of [
      'ArrowRight',
      'ArrowRight',
      'ArrowLeft',
      'ArrowLeft',
    ] as const) {
      await flip(key)
    }
    await expect(page.getByTestId('pager-position')).toHaveText('1 / 40')
    await page.waitForTimeout(250)
    await clearPerfScenario(page)
    await page.evaluate(browserBeginLoafScenarioWindow)

    for (let i = 0; i < 39; i += 1) {
      await flip('ArrowRight')
    }
    await expect(page.getByTestId('pager-position')).toHaveText('40 / 40')

    await page.evaluate(browserAssertNoLoaf, 0)
    await collectFrameStatsArtifact(page, testInfo)
  })
})
