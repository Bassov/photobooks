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
  await expect(page.getByTestId('specimen-tw-bridge')).toBeVisible()
  await expect(page.getByTestId('tw-bg-chrome')).toBeVisible()
  await expect(page.getByTestId('tw-bg-sel')).toBeVisible()
  await expect(page.getByTestId('tw-text-muted')).toBeVisible()
  const twColors = await page.evaluate(() => {
    const chrome = document.querySelector('[data-testid="tw-bg-chrome"]')
    const sel = document.querySelector('[data-testid="tw-bg-sel"]')
    const muted = document.querySelector('[data-testid="tw-text-muted"]')
    const bg = (el: Element | null) =>
      el ? getComputedStyle(el).backgroundColor : ''
    const fg = (el: Element | null) => (el ? getComputedStyle(el).color : '')
    return { chrome: bg(chrome), sel: bg(sel), muted: fg(muted) }
  })
  // Kit v0.9.3: --chrome #E1E1E1, --color-sel #CACACA, --muted-foreground #535152
  expect(twColors.chrome).toMatch(/225,\s*225,\s*225/)
  expect(twColors.sel).toMatch(/202,\s*202,\s*202/)
  expect(twColors.muted).toMatch(/83,\s*81,\s*82/)
  await expect(page.getByText('Semantic colour roles')).toBeVisible()
  await expect(page.getByText('Type scale', { exact: false })).toBeVisible()
  await expect(page.getByTestId('specimen-icons')).toBeVisible()
  await expect(
    page.locator('[data-testid="specimen-icons"] .specimen-swatch-name', {
      hasText: 'undo',
    }),
  ).toBeVisible()
  await expect(
    page
      .locator('[data-testid="specimen-icons"] .specimen-swatch-name')
      .filter({ hasText: /^folder$/ }),
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
  await feedback.getByRole('button', { name: 'Choose photo folder…' }).click()
  await expect(page.getByTestId('specimen-status-polite')).toHaveText(
    'Choose photo folder…',
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

test('empty home and painter editor use Theme B chrome tokens', async ({
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
  await expect(page.getByTestId('app-theme-toggle')).toHaveCount(0)
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

test('book paper and canvas use light Theme B tokens', async ({ page }) => {
  await page.goto('/?fixture=painter')
  await expect(page.getByTestId('editor-shell')).toBeVisible()

  const colors = await page.evaluate(() => {
    const root = document.documentElement
    const paper = getComputedStyle(root).getPropertyValue('--paper').trim()
    const canvas = getComputedStyle(root).getPropertyValue('--canvas').trim()
    const chrome = getComputedStyle(root).getPropertyValue('--chrome').trim()
    const spread = document.querySelector('.spread-view')
    const spreadBg = spread ? getComputedStyle(spread).backgroundColor : ''
    return { paper, canvas, chrome, spreadBg }
  })

  expect(['#ffffff', '#fff']).toContain(colors.paper.toLowerCase())
  // Kit v0.9.3 Procreate-light surfaces
  expect(colors.canvas.toLowerCase()).toBe('#c8cacb')
  expect(colors.chrome.toLowerCase()).toBe('#e1e1e1')
  // rgb(255, 255, 255) == #fff / #ffffff
  expect(colors.spreadBg).toMatch(/255,\s*255,\s*255/)
  await assertDocumentFitsViewport(page)
})

test('editor top bar follows kit v0.10 structure and tokens', async ({
  page,
}) => {
  await page.goto('/?fixture=painter')
  const bar = page.getByTestId('editor-bar')
  await expect(bar).toBeVisible()
  await expect(bar).toHaveCSS('background-color', 'rgb(225, 225, 225)')
  await expect(page.getByTestId('go-library')).toContainText('Library')
  await expect(page.getByTestId('book-title')).toBeVisible()
  await expect(page.getByTestId('undo')).toBeVisible()
  await expect(page.getByTestId('redo')).toBeVisible()
  await expect(page.getByTestId('zoom-menu')).toBeVisible()
  const present = page.getByTestId('present')
  await expect(present).toHaveText('Preview')
  await expect(present).toHaveCSS('background-color', 'rgb(215, 215, 215)')
  // Print / Publish are not wired in the editor: hidden, not stubbed.
  for (const name of ['Print', 'Publish']) {
    await expect(bar.getByRole('button', { name })).toHaveCount(0)
  }
  // Kit toolbar ends with Preview · Settings (uikit/src/demo-parts/editor.tsx:97).
  await expect(
    bar.getByRole('button', { name: 'Settings', exact: true }),
  ).toBeVisible()
  await assertDocumentFitsViewport(page)
})
