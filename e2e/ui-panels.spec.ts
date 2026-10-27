import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { openSessionEditor } from './fixtures/openSessionEditor'

test('left panel resizes by keyboard, persists across reload, collapses on Enter', async ({
  page,
}) => {
  await openSessionEditor(page)
  const panel = page.getByTestId('panel-l')
  const before = (await panel.boundingBox())?.width ?? 0
  expect(Math.round(before)).toBe(212)

  const splitter = page.getByTestId('resize-left')
  await splitter.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Shift+ArrowRight')
  await expect
    .poll(async () => Math.round((await panel.boundingBox())?.width ?? 0))
    .toBe(252)
  await assertDocumentFitsViewport(page)

  await page.reload()
  await openSessionEditor(page)
  await expect
    .poll(async () =>
      Math.round((await page.getByTestId('panel-l').boundingBox())?.width ?? 0),
    )
    .toBe(252)

  await page.getByTestId('resize-left').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('panel-l')).toHaveAttribute(
    'data-open',
    'false',
  )
})

test('inspector header collapses the right panel', async ({ page }) => {
  await openSessionEditor(page)
  await page.getByTestId('toggle-r').click()
  await expect(page.getByTestId('panel-r')).toHaveAttribute('data-open', 'true')
  await page.getByTestId('panel-collapse-right').click()
  await expect(page.getByTestId('panel-r')).toHaveAttribute(
    'data-open',
    'false',
  )
})
