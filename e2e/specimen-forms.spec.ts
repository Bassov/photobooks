import { expect, test } from './fixtures/coverage'

test('specimen forms: grayscale field, ink focus ring, keyboard step', async ({
  page,
}) => {
  await page.goto('/?specimen')
  const forms = page.getByTestId('specimen-forms')
  await expect(forms).toBeVisible()

  const text = page.getByTestId('specimen-text')
  await expect(text).toHaveCSS('background-color', 'rgb(215, 215, 215)')
  await text.focus()
  await expect(text).toHaveCSS('outline-color', 'rgb(83, 81, 82)')

  const mm = page.getByTestId('specimen-mm')
  await mm.focus()
  await page.keyboard.press('Shift+ArrowUp')
  await expect(mm).toHaveValue('15')
  await mm.fill('99')
  await page.keyboard.press('Enter')
  await expect(mm).toHaveValue('20')
  await expect(page.locator('.pb-field__unit-wrap:focus-within')).toHaveCSS(
    'outline-color',
    'rgb(83, 81, 82)',
  )

  await expect(forms).toHaveScreenshot('specimen-forms.png', {
    maxDiffPixelRatio: 0.01,
  })
})
