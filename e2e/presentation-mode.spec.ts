import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  browserAssertNoLoaf,
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
    const add = page.getByTestId('template-add-spread')
    for (let i = 0; i < 37; i += 1) {
      await add.click()
    }
    await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
      'data-spread-count',
      '40',
    )
    await page.getByTestId('present').click()
    await expect(page.getByTestId('pager-position')).toHaveText('40 / 40')
    await clearPerfScenario(page)

    for (let i = 0; i < 39; i += 1) {
      await page.keyboard.press('ArrowLeft')
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              resolve()
            })
          }),
      )
    }
    await expect(page.getByTestId('pager-position')).toHaveText('1 / 40')

    await page.evaluate(browserAssertNoLoaf, 0)
    await collectFrameStatsArtifact(page, testInfo)
  })
})
