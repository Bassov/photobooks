import type { Page } from '@playwright/test'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { expect, test } from './fixtures/coverage'
import { addSpreads } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  masterOptions,
  masterSelect,
  pickMaster,
  shownMaster,
} from './fixtures/spreadMaster'

// default-master (Owner Q-9 2026-11-04): every book has an empty default
// "Master A" used by all spreads, new ones too. Owner amendment: the spread
// Master control is always a select. A fresh book + one spread = 6 pages
// (1 · 2–3 · 4–5 · 6).
test.use({ viewport: { width: 1440, height: 900 } })

const spreadRow = (page: Page, index: number) =>
  page.getByTestId(/^spread-list-item-/).nth(index)
const status = (page: Page) => page.getByTestId('spread-master-status')
const masterRows = (page: Page) =>
  page.getByRole('listbox', { name: 'Masters' }).getByRole('option')
const usage = (page: Page) => page.getByTestId('master-usage')

async function showSpread(page: Page, index: number) {
  await page.getByTestId('left-tab-pages').click()
  await spreadRow(page, index).click()
  await expect(masterSelect(page)).toBeVisible()
}

test('a fresh book uses Master A by default; Make default, None and Edit master', async ({
  page,
}) => {
  await openSessionEditor(page)
  await addSpreads(page, 1)

  // Happy: spread 2–3 shows the default in the select and "Book default".
  await showSpread(page, 1)
  expect(await masterOptions(page)).toEqual(['Master A · default', 'None'])
  expect(await shownMaster(page)).toBe('Master A')
  await expect(page.getByRole('radiogroup', { name: 'Master' })).toHaveCount(0)
  await expect(status(page)).toHaveText('Book defaultEdit master')
  const select = await masterSelect(page).boundingBox()
  expect(Math.abs((select?.width ?? 0) - 268)).toBeLessThanOrEqual(0.5)
  const line = await status(page).evaluate((el) => {
    const s = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return [r.height, s.fontSize, s.fontWeight, s.color]
  })
  expect(line[0]).toBeCloseTo(16.8, 1)
  expect(line.slice(1)).toEqual(['12px', '400', 'rgb(83, 81, 82)'])
  await expect(page.getByTestId('spread-master-edit')).toHaveCSS(
    'font-weight',
    '500',
  )
  await assertDocumentFitsViewport(page)

  // Masters: the new spread follows the default too (C6).
  await page.getByTestId('left-tab-masters').click()
  await expect(usage(page)).toHaveText('Default · all 6 pages')
  await expect(page.getByTestId('master-make-default')).toHaveCount(0)

  // New master B: not the default, unused, offers Make default.
  await page.getByTestId('new-master').click()
  await expect(masterRows(page)).toHaveText(['Master ADefault', 'Master B'])
  await expect(usage(page)).toHaveText('Not used yet')
  await expect(page.getByTestId('master-hint')).toHaveText(
    'Pick it for a spread under Master & spacing, or make it the default.',
  )
  const make = page.getByTestId('master-make-default')
  await expect(make).toHaveText('Make default')
  const makeBox = await make.boundingBox()
  expect(makeBox?.height).toBe(28)
  await expect(make).toHaveCSS('background-color', 'rgb(215, 215, 215)')
  await make.click()

  // B is the default: tagged, named in the note, list order unchanged.
  await expect(masterRows(page)).toHaveText(['Master A', 'Master BDefault'])
  await expect(page.getByTestId('masters-intro')).toContainText(
    'Spreads use the default, Master B, unless they pick another.',
  )
  await expect(make).toHaveCount(0)
  await expect(usage(page)).toHaveText('Default · all 6 pages')
  // The default's row menu: no Make default, Delete disabled.
  const rowB = masterRows(page).nth(1)
  const idB = await rowB.getAttribute('data-item')
  await rowB.hover()
  await page.getByTestId(`master-menu-${String(idB)}`).click()
  await expect(page.getByTestId('master-menu-rename')).toBeVisible()
  await expect(page.getByTestId('master-menu-make-default')).toHaveCount(0)
  await expect(page.getByTestId('master-menu-delete')).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  await page.keyboard.press('Escape')

  // Spreads follow B.
  await showSpread(page, 1)
  expect(await masterOptions(page)).toEqual([
    'Master A',
    'Master B · default',
    'None',
  ])
  expect(await shownMaster(page)).toBe('Master B')
  await expect(status(page)).toHaveText('Book defaultEdit master')

  // None on spread 2–3: no master, no Edit master; B covers 4 of 6 pages.
  await pickMaster(page, 'None')
  await expect(status(page)).toHaveText('No master on this spread')
  await expect(page.getByTestId('spread-master-edit')).toHaveCount(0)
  await page.getByTestId('left-tab-masters').click()
  await masterRows(page).nth(1).click()
  await expect(usage(page)).toHaveText('Default · 4 of 6 pages')

  // Spread 4–5 picks A instead; Edit master opens Masters on it.
  await showSpread(page, 2)
  await pickMaster(page, 'Master A')
  await expect(status(page)).toHaveText('Instead of Master BEdit master')
  await page.getByTestId('spread-master-edit').click()
  await expect(page.getByTestId('masters-panel')).toBeVisible()
  await expect(masterRows(page).first()).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(
    page.getByTestId('insp-master').getByTestId('inspector-context'),
  ).toHaveText('Master A')
  await expect(usage(page)).toHaveText('Used by 2 pages')
  await assertDocumentFitsViewport(page)
})
