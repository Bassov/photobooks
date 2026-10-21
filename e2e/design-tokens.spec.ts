import { expect, test } from './fixtures/coverage'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import { openSessionEditor } from './fixtures/openSessionEditor'
import './perf/perfFixture'

test('specimen page shows token swatches without third-party fonts', async ({
  page,
}) => {
  const thirdPartyFonts: string[] = []
  page.on('request', (req) => {
    if (/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(req.url())) {
      thirdPartyFonts.push(req.url())
    }
  })

  await page.goto('/?specimen')
  await expect(page.getByTestId('specimen')).toBeVisible()
  await expect(page.getByRole('heading', { name: '?specimen' })).toBeVisible()
  await expect(page.getByText('Semantic colour roles')).toBeVisible()
  await expect(page.getByText('Type scale', { exact: false })).toBeVisible()
  await expect(page.getByTestId('specimen-icons')).toBeVisible()
  await expect(
    page.locator('[data-testid="specimen-icons"] .specimen-swatch-name', {
      hasText: 'undo',
    }),
  ).toBeVisible()
  await expect(
    page.locator('[data-testid="specimen-icons"] .specimen-swatch-name', {
      hasText: 'folder',
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Icon size 20' }).click()
  await expect(
    page.locator('[data-testid="specimen-icons"] svg[data-icon="undo"]'),
  ).toHaveAttribute('data-size', '20')

  const actions = page.getByTestId('specimen-actions')
  await expect(actions).toBeVisible()
  await actions.getByRole('button', { name: 'Save', exact: true }).click()
  await actions.getByRole('radio', { name: 'Fit' }).click()
  await expect(page.getByTestId('specimen-fit-value')).toHaveText('fit=fit')
  await expect(
    actions.getByRole('toolbar', { name: 'Editor tools' }),
  ).toBeVisible()
  await page
    .getByTestId('specimen-icon-buttons')
    .getByRole('button', { name: 'Undo (Ctrl+Z)' })
    .hover()
  await expect(
    page.getByRole('tooltip', { name: 'Undo (Ctrl+Z)' }),
  ).toBeVisible()

  const feedback = page.getByTestId('specimen-feedback')
  await expect(feedback).toBeVisible()
  await feedback.getByRole('button', { name: 'Announce polite' }).click()
  await expect(page.getByTestId('specimen-status-polite')).toHaveText('Saved')
  await feedback.getByRole('button', { name: 'Show error toast' }).click()
  await expect(page.getByText('3 files skipped')).toBeVisible()
  await page.getByRole('button', { name: 'Show files' }).click()
  await expect(page.getByTestId('specimen-status-polite')).toHaveText(
    'Opened import-errors panel (grouped by reason; dismiss / Clear all)',
  )
  await expect(
    page.getByRole('progressbar', { name: 'Import progress' }),
  ).toBeVisible()
  await feedback.getByRole('button', { name: 'Add folder…' }).click()
  await expect(page.getByTestId('specimen-status-polite')).toHaveText(
    'Add folder…',
  )

  const overlays = page.getByTestId('specimen-overlays')
  await expect(overlays).toBeVisible()
  await overlays.getByRole('button', { name: 'Open dialog' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await overlays.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await expect(page.getByTestId('specimen-menu-choice')).toHaveText(
    'menu=delete',
  )

  const theme = await page.evaluate(
    () => document.documentElement.dataset.theme,
  )
  expect(theme === 'b' || theme === 'b-dark').toBe(true)

  const chrome = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--chrome')
      .trim(),
  )
  expect(chrome.length).toBeGreaterThan(0)

  const iconSize = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--icon-size-16')
      .trim(),
  )
  expect(iconSize).toBe('16px')

  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'specimen', {
    axis: 'vertical',
    nudgeHorizontal: false,
  })
  expect(thirdPartyFonts).toEqual([])
})

test('empty home and painter editor use themed chrome tokens', async ({
  page,
}) => {
  const thirdPartyFonts: string[] = []
  page.on('request', (req) => {
    if (/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(req.url())) {
      thirdPartyFonts.push(req.url())
    }
  })

  await page.goto('/')
  await expect(page.getByText('Photobooks').first()).toBeVisible()
  await assertDocumentFitsViewport(page)

  await openSessionEditor(page)
  await expect(page.getByTestId('editor-shell')).toBeVisible()
  await expect(page.getByTestId('filmstrip')).toBeVisible()
  await assertDocumentFitsViewport(page)
  expect(thirdPartyFonts).toEqual([])
})

test('painter pasteboard scrolls inside the named scrollport', async ({
  page,
}) => {
  await page.goto('/?fixture=painter')
  await expect(page.getByTestId('editor-shell')).toBeVisible()
  await expect(page.getByTestId('pasteboard-scroll')).toBeVisible()
  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'pasteboard-scroll', {
    axis: 'vertical',
    nudgeHorizontal: false,
  })
})

test('book paper stays light under b-dark', async ({ page }) => {
  await page.goto('/?fixture=painter')
  await expect(page.getByTestId('editor-shell')).toBeVisible()
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'b-dark'
  })

  const colors = await page.evaluate(() => {
    const root = document.documentElement
    const paper = getComputedStyle(root).getPropertyValue('--paper').trim()
    const canvas = getComputedStyle(root).getPropertyValue('--canvas').trim()
    const spread = document.querySelector('.spread-view')
    const spreadBg = spread ? getComputedStyle(spread).backgroundColor : ''
    return { paper, canvas, spreadBg }
  })

  expect(colors.paper.toLowerCase()).toBe('#f4f3f1')
  expect(colors.canvas.toLowerCase()).toBe('#121212')
  // rgb(244, 243, 241) == #f4f3f1
  expect(colors.spreadBg).toMatch(/244,\s*243,\s*241/)
  await assertDocumentFitsViewport(page)
})

test('theme toggle flips chrome, keeps paper, and persists across reload', async ({
  page,
}) => {
  await page.goto('/?fixture=painter')
  await expect(page.getByTestId('editor-shell')).toBeVisible()
  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'pasteboard-scroll', {
    axis: 'vertical',
    nudgeHorizontal: false,
  })

  await expect(page.getByTestId('app-theme-toggle')).toBeVisible()

  // Force light first so the toggle path is deterministic (b → b-dark).
  await page.evaluate(() => {
    localStorage.setItem('photobooks-theme', 'b')
  })
  await page.reload()
  await expect(page.getByTestId('editor-shell')).toBeVisible()
  await expect
    .poll(async () =>
      page.evaluate(() => document.documentElement.dataset.theme),
    )
    .toBe('b')

  await page.getByTestId('app-theme-toggle').click()
  const afterToggle = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    paper: getComputedStyle(document.documentElement)
      .getPropertyValue('--paper')
      .trim()
      .toLowerCase(),
    canvas: getComputedStyle(document.documentElement)
      .getPropertyValue('--canvas')
      .trim()
      .toLowerCase(),
    stored: localStorage.getItem('photobooks-theme'),
  }))
  expect(afterToggle.theme).toBe('b-dark')
  expect(afterToggle.stored).toBe('b-dark')
  expect(afterToggle.paper).toBe('#f4f3f1')
  expect(afterToggle.canvas).toBe('#121212')

  await page.reload()
  await expect(page.getByTestId('editor-shell')).toBeVisible()
  await expect
    .poll(async () =>
      page.evaluate(() => document.documentElement.dataset.theme),
    )
    .toBe('b-dark')
})

test('theme toggle mid-pasteboard scroll records zero LoAF', async ({
  page,
}) => {
  await page.goto('/?fixture=painter&perf=1')
  await expect(page.getByTestId('editor-shell')).toBeVisible()
  await page.waitForFunction(() => window.__photobooksPerf !== undefined)

  const scroll = page.getByTestId('pasteboard-scroll')
  await expect(scroll).toBeVisible()
  await scroll.evaluate((el) => {
    el.scrollTop = Math.max(40, Math.floor(el.scrollHeight / 3))
  })

  await page.evaluate(() => {
    window.__photobooksPerf?.clearLoafEntries()
  })
  await page.getByTestId('app-theme-toggle').click()
  await page.waitForTimeout(50)
  const loafCount = await page.evaluate(
    () => window.__photobooksPerf?.getLoafEntries().length ?? -1,
  )
  expect(loafCount).toBe(0)
})
