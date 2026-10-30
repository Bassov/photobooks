import { expect, test } from './fixtures/coverage'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
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
  await expect(page.getByTestId('toggle-l')).toBeFocused()
})

test('pointer drag clamps the left panel to 150–360 and persists', async ({
  page,
}) => {
  await openSessionEditor(page)
  const width = async () =>
    Math.round((await page.getByTestId('panel-l').boundingBox())?.width ?? 0)
  const box = await page.getByTestId('resize-left').boundingBox()
  expect(box).not.toBeNull()
  const x = (box?.x ?? 0) + (box?.width ?? 0) / 2
  const y = (box?.y ?? 0) + (box?.height ?? 0) / 2

  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x - 400, y, { steps: 4 })
  await expect.poll(width).toBe(150)
  await page.mouse.move(x + 400, y, { steps: 4 })
  await expect.poll(width).toBe(360)
  await page.mouse.up()
  await assertDocumentFitsViewport(page)

  await page.reload()
  await openSessionEditor(page)
  await expect.poll(width).toBe(360)
})

test('both panels at max keep the page fit; spreads-list stays the scrollport', async ({
  page,
}) => {
  await page.goto('/?fixture=painter')
  await expect(page.getByTestId('editor-shell')).toBeVisible()
  // Inspector is open by default (uikit/src/sandbox/chrome.tsx:139).
  await expect(page.getByTestId('panel-r')).toHaveAttribute('data-open', 'true')

  await page.getByTestId('resize-left').focus()
  for (let i = 0; i < 6; i += 1) await page.keyboard.press('Shift+ArrowRight')
  await page.getByTestId('resize-right').focus()
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Shift+ArrowLeft')

  for (const id of ['panel-l', 'panel-r']) {
    await expect
      .poll(async () =>
        Math.round((await page.getByTestId(id).boundingBox())?.width ?? 0),
      )
      .toBe(360)
  }
  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'spreads-list', { axis: 'vertical' })
})

test('specimen panels demo resizes, collapses and expands', async ({
  page,
}) => {
  await page.goto('/?specimen')
  const demo = page.getByTestId('specimen-panels')
  await expect(demo).toBeVisible()
  const splitter = demo.getByTestId('resize-left')
  await splitter.focus()
  await page.keyboard.press('ArrowRight')
  await expect(splitter).toHaveAttribute('aria-valuenow', '220')
  await expect(demo.locator('.specimen-panels-pane')).toHaveCSS(
    'width',
    '220px',
  )

  await demo.getByTestId('panel-collapse-left').click()
  await expect(demo.getByTestId('resize-left')).toHaveCount(0)
  await demo.getByRole('button', { name: 'Expand spreads' }).click()
  await expect(demo.getByTestId('resize-left')).toBeVisible()
  await assertDocumentFitsViewport(page)
})

test('inspector header collapses the right panel', async ({ page }) => {
  await openSessionEditor(page)
  await expect(page.getByTestId('panel-r')).toHaveAttribute('data-open', 'true')
  await page.getByTestId('panel-collapse-right').click()
  await expect(page.getByTestId('panel-r')).toHaveAttribute(
    'data-open',
    'false',
  )
  await expect(page.getByTestId('toggle-r')).toBeFocused()
})
