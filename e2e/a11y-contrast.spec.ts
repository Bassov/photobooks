import { readFileSync } from 'node:fs'
import { expect, test } from './fixtures/coverage'
import { expectNoAxeViolations, resolveAxeCorePath } from './fixtures/axe'
import { openSessionEditor } from './fixtures/openSessionEditor'

test('axe fixture detects deliberate low-contrast text', async ({ page }) => {
  const axePath = resolveAxeCorePath()
  expect(axePath).toMatch(/axe-core/)
  expect(readFileSync(axePath, 'utf8')).toContain('axe')

  await page.setContent(
    '<main><p style="color:#eee;background:#fff">low contrast probe</p></main>',
  )
  await page.addScriptTag({ path: axePath })
  const violations = await page.evaluate(async () => {
    const axe = (
      window as Window & {
        axe?: {
          run: (
            ctx?: unknown,
            opts?: Record<string, unknown>,
          ) => Promise<{ violations: { id: string }[] }>
        }
      }
    ).axe
    if (!axe) throw new Error('axe-core failed to load')
    const results = await axe.run(document, {
      runOnly: { type: 'rule', values: ['color-contrast'] },
    })
    return results.violations.map((v) => v.id)
  })
  expect(violations).toContain('color-contrast')
})

test('specimen page passes color-contrast AA and name/role axe rules', async ({
  page,
}) => {
  await page.goto('/?specimen')
  await expect(page.getByTestId('specimen')).toBeVisible()
  await expectNoAxeViolations(page, '?specimen')
})

test('empty editor passes color-contrast AA and name/role axe rules', async ({
  page,
}) => {
  await openSessionEditor(page)
  await expect(page.getByTestId('editor-shell')).toBeVisible()
  await expect(page.getByTestId('filmstrip')).toBeVisible()
  await expectNoAxeViolations(page, 'editor empty')
})

test('happy editor passes color-contrast AA and name/role axe rules', async ({
  page,
}) => {
  await page.goto('/?fixture=painter')
  await expect(page.getByTestId('editor-shell')).toBeVisible()
  await expect(page.getByTestId('pasteboard-scroll')).toBeVisible()
  await expectNoAxeViolations(page, 'editor happy')
})
