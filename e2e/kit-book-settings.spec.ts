import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit Book settings (moved from uikit/scripts/qa.mjs v7 / v0.9.1 / kit-sync W3,
// uikit-qa-split-2): endpapers show in the spread list only when enabled,
// Binding / Material / Fill are read-only rows, and the Page size select draws
// prod's 16 px chevron. The smoke port also fails on a console error / warning,
// page error or failed request, like the qa.mjs smoke() helper.

test.use({ viewport: { width: 1440, height: 900 } })

const SRC = path.resolve(process.cwd(), 'uikit', 'src')
const demo = (page: Page) => page.getByTestId('demo')
const D = (page: Page, s: string) => page.locator(`[data-testid="demo"] ${s}`)
const E = (page: Page, s: string) => D(page, `[data-testid="editor7"] ${s}`)
const items = (page: Page) =>
  E(page, '[data-testid="panel-l"] [role=row]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-item')),
  )

function watchErrors(page: Page) {
  const errs: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning')
      errs.push(`${m.type()}: ${m.text().slice(0, 240)}`)
  })
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`))
  page.on('requestfailed', (r) => errs.push(`requestfailed: ${r.url()}`))
  return errs
}

/** kit-sync W3 walk opening: fresh #/demo, library, book "Lake trip", a photo folder, a photo on p1's first frame, that frame selected */
async function openW3(page: Page) {
  await page.goto('/uikit/#/demo')
  await expect(demo(page)).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: { reset: () => void } }).__demo.reset()
  })
  const c = (sel: string) => page.locator(sel).first().click()
  await c('[data-testid="create-library"]')
  await c('[data-testid="picker-select"]')
  await c('[data-testid="demo"] [data-testid="new-book"]')
  await page.locator('[role=dialog] input').first().fill('Lake trip')
  await c('[data-testid="create-book"]')
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await c('[data-testid="demo-add-folder"]')
  await page
    .locator('[role=dialog]')
    .getByRole('button', { name: /Choose|Select|Use|Add/i })
    .last()
    .click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await c('[data-item="p1"]')
  await page
    .locator('[data-testid="filmstrip"] [role="row"]')
    .nth(5)
    .dragTo(
      page.locator('[data-testid="canvas"] [data-testid="frame"]').first(),
    )
  await c('[data-testid="canvas"] [data-testid="frame"]')
}

test('v7 endpapers only when enabled in Book settings', async ({ page }) => {
  const errs = watchErrors(page)
  await page.goto('/uikit/#/screen/canvas')
  const title = E(page, '[data-testid="book-title"]')
  await title.click()
  await expect(title).toHaveAttribute('aria-pressed', 'true')
  await expect(E(page, '[data-testid="insp-book"]')).toHaveCount(1)
  await E(page, '[role=switch][aria-label="Endpapers"]').click()
  await expect.poll(() => items(page)).not.toContain('ef')
  const it = await items(page)
  expect(it).not.toContain('eb')
  expect(it.slice(0, 2), it.join(',')).toEqual(['cover', 'p0'])
  expect(errs).toEqual([])
})

test('v0.9.1 §5 Binding/Material/Fill demoted (no fake interactive SegC/Swatches)', () => {
  const v7src = fs.readFileSync(path.join(SRC, 'sandbox', 'v7.tsx'), 'utf8')
  expect(v7src).not.toMatch(/Sec title="Binding"><SegC/)
  expect(v7src).not.toMatch(/Sec title="Material"><SegC/)
  expect(v7src).not.toMatch(/title="Back"[\s\S]*?Swatches cs=/)
  expect(v7src).toMatch(/binding-readonly|material-readonly|fill-readonly/)
})

test('kit-sync KS15: Page size select shows a 16 px chevron-down #6b696a (prod .pb-select), not the triangle caret', async ({
  page,
}) => {
  await openW3(page)
  await page.locator('[data-testid="book-title"]').first().click()
  const chev = await D(page, '[data-testid="size-preset"]').evaluate((e) => {
    const s = getComputedStyle(e)
    return {
      svg:
        s.backgroundImage.includes('svg') &&
        s.backgroundImage.includes('m6 9 6 6 6-6') &&
        /%236b696a/i.test(s.backgroundImage),
      gradient: s.backgroundImage.includes('gradient'),
      size: s.backgroundSize,
      pos: s.backgroundPosition,
      pr: s.paddingRight,
    }
  })
  expect(chev).toEqual({
    svg: true,
    gradient: false,
    size: '16px 16px',
    pos: 'calc(100% - 8px) 50%',
    pr: '32px',
  })
})
