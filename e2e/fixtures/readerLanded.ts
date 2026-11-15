import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * The site book reader (`ps-reader`) rests on `view` and its canvas holds that
 * pose: rest-pose GL draws land a frame or more after `data-view` changes, and
 * `ps-reader-gl` drops `data-faces` until the latest draw lands. Without WebGL
 * (the CSS fallback) there is no GL layer and the DOM pages are the pixels.
 */
export async function readerLanded(
  reader: Locator,
  view: number,
): Promise<void> {
  await expect(reader).toHaveAttribute('data-view', String(view))
  await expect(reader).toHaveAttribute('data-turn', 'rest')
  await expect
    .poll(() =>
      reader.evaluate((el) => {
        const gl = el.querySelector('[data-testid="ps-reader-gl"]')
        return gl === null || gl.getAttribute('data-faces') === 'done'
      }),
    )
    .toBe(true)
}
