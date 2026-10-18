import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { openSessionEditor } from './fixtures/openSessionEditor'

test('branded editor shell shows Photobooks', async ({ page }) => {
  await openSessionEditor(page)
  await expect(page.getByText('Photobooks')).toBeVisible()
  await expect(page.getByTestId('editor-shell')).toBeVisible()
  await expect(page.getByTestId('filmstrip')).toBeVisible()
  // Scratch Done-when: exercises src/lib/e2eCoverageProbe.ts (e2e-only).
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          (window as Window & { __photobooksE2eCoverageProbe?: string })
            .__photobooksE2eCoverageProbe,
      ),
    )
    .toBe('e2e-coverage-probe-v1')
  await assertDocumentFitsViewport(page)
})
