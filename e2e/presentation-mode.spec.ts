import { expect, test } from './fixtures/coverage'
import { openSessionEditor } from './fixtures/openSessionEditor'

// The black presentation overlay is gone (site-preview-mode): the Preview
// pill opens the site preview over the still-mounted editor. Behaviour of the
// preview itself: e2e/site-preview-mode.spec.ts.
test('the Preview pill opens the site preview, never the presentation overlay', async ({
  page,
}) => {
  await openSessionEditor(page)
  const pill = page.getByTestId('present')
  await expect(pill).toHaveAccessibleName('Preview')
  await pill.click()
  const preview = page.getByTestId('site-preview')
  await expect(preview.getByTestId('site-label')).toHaveText('Cover')
  await expect(page.getByTestId('presentation')).toHaveCount(0)
  await expect(page.getByTestId('presentation-cover')).toHaveCount(0)
  // The editor stays mounted under it, not replaced.
  await expect(page.getByTestId('editor-shell')).toHaveAttribute('inert', '')
  await expect(page.getByTestId('pasteboard-scroll')).toBeAttached()
  await page.keyboard.press('Escape')
  await expect(preview).toHaveCount(0)
  await expect(pill).toBeFocused()
})
