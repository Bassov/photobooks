import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { openSessionEditor } from './fixtures/openSessionEditor'

const rows = (page: import('@playwright/test').Page) =>
  page.locator('[data-testid^="spread-list-item-"]')

test('spread list follows kit v0.10 structure and tokens', async ({ page }) => {
  await openSessionEditor(page)
  const panel = page.getByTestId('spreads-panel')
  await expect(panel).toBeVisible()
  await expect(panel).toHaveCSS('background-color', 'rgb(225, 225, 225)')
  const width = await panel.evaluate((el) => el.getBoundingClientRect().width)
  expect(Math.round(width)).toBe(212)

  // Pages switch segment uses the field tone.
  await expect(page.getByTestId('mode-seg')).toContainText('Pages')
  // Masters are not wired yet: hidden, not stubbed. The cover row is wired
  // (kit10-cover): one pinned row above the pages. Endpaper rows (front, back)
  // show while the book has endpapers: uikit/src/sandbox/chrome.tsx:275,278
  // (covered in design-inspector-book-cover.spec.ts).
  await expect(page.getByRole('button', { name: 'Masters' })).toHaveCount(0)
  await expect(page.getByText('Cover', { exact: true })).toHaveCount(1)
  await expect(page.getByText('Endpaper', { exact: true })).toHaveCount(2)

  // Selection is the list tone #CACACA, no blue / teal ring.
  const selected = rows(page).filter({ has: page.locator('[data-label]') })
  await rows(page).nth(1).click()
  await expect(rows(page).nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(rows(page).nth(1)).toHaveCSS(
    'background-color',
    'rgb(202, 202, 202)',
  )
  expect(await selected.count()).toBeGreaterThan(0)

  await expect(page.getByTestId('add-spread')).toContainText('Add spread')
  await assertDocumentFitsViewport(page)
})

test('row menu keeps Add after / Duplicate / Delete with Undo toast', async ({
  page,
}) => {
  await openSessionEditor(page)
  await expect(rows(page)).toHaveCount(3)
  await rows(page).nth(0).hover()
  const trigger = page.getByTestId(/^spread-menu-/).first()
  await expect(trigger).toHaveCSS('opacity', '1')
  await trigger.click()
  await expect(page.getByTestId('spread-menu-add')).toBeVisible()
  await expect(page.getByTestId('spread-menu-duplicate')).toBeVisible()
  await page.getByTestId('spread-menu-delete').click()
  await expect(rows(page)).toHaveCount(2)
  await page.getByTestId('spread-deleted-toast').getByText('Undo').click()
  await expect(rows(page)).toHaveCount(3)
})

test('a spread with a missing photo shows the kit missing badge', async ({
  page,
}) => {
  await page.goto('/?fixture=painter')
  await expect(page.getByTestId('editor-shell')).toBeVisible()
  await expect(rows(page).first()).toBeVisible()
  await expect(page.getByTestId('spread-row-missing')).toHaveCount(0)

  await page.waitForFunction(
    () =>
      (window as unknown as { __photobooksRelink?: unknown })
        .__photobooksRelink !== undefined,
  )
  await page.evaluate(() => {
    const api = (
      window as unknown as {
        __photobooksRelink: {
          replaceRelinkStatuses: (next: Iterable<[string, 'missing']>) => void
        }
      }
    ).__photobooksRelink
    const ids = new Set<string>()
    document
      .querySelectorAll('[data-testid="pasteboard-scroll"] [data-asset-id]')
      .forEach((el) => {
        const id = el.getAttribute('data-asset-id')
        if (id) ids.add(id)
      })
    api.replaceRelinkStatuses([...ids].map((id) => [id, 'missing']))
  })

  const badge = page.getByTestId('spread-row-missing').first()
  await expect(badge).toBeVisible()
  await expect(badge).toHaveText('missing')
  await expect(badge).toHaveCSS('color', /rgb\(/)
  await assertDocumentFitsViewport(page)
})
