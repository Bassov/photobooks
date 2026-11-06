import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit `#/demo` A5 portrait (14.8 × 21 cm) at Fit, measured on 2026-11-06:
// root vite (`/uikit/?theme=procreate-light#/demo`), `__demo.reset()`, create
// library, New book → Page size A5 → Create, click `[data-item="p1"]`, then
// getBoundingClientRect of `[data-stack-item="1"] [data-testid="spread"]` and
// of the `.canvas-dots` port. The Designer's 848 × 601.61 is the 920 px tall
// window; at 900 px both kit and prod are height-limited at 828.8 × 588.
const KIT = [
  {
    height: 900,
    port: { width: 928, height: 692 },
    spread: { width: 828.8, height: 588 },
  },
  {
    height: 920,
    port: { width: 928, height: 712 },
    spread: { width: 848, height: 601.61 },
  },
]

const rows = (page: Page) => page.locator('[data-testid^="spread-list-item-"]')

async function openA5Portrait(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('welcome-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.evaluate(async () => {
    const api = window.__photobooksProject
    if (!api) throw new Error('missing api')
    await api.attachMemoryLibraryForTests()
    await api.createBookInLibrary('Lake trip', {
      trim: { widthMm: 148, heightMm: 210 },
    })
  })
  await expect(page.getByTestId('book-size')).toContainText('14.8 × 21 cm', {
    timeout: 15_000,
  })
}

/** Port and drawn spread sizes of the active pasteboard slot `index`. */
async function fitRects(
  page: Page,
  index: number,
): Promise<{ port: DOMRectReadOnly; view: DOMRectReadOnly } | null> {
  return page.getByTestId('pasteboard-scroll').evaluate((port, slotIndex) => {
    const slot = port.querySelector(`[data-slot-index="${String(slotIndex)}"]`)
    const view = slot?.querySelector('[data-testid="spread-view"]')
    if (!(slot instanceof HTMLElement) || !(view instanceof HTMLElement)) {
      return null
    }
    if (slot.dataset.active !== 'true') return null
    return {
      port: port.getBoundingClientRect().toJSON() as DOMRectReadOnly,
      view: view.getBoundingClientRect().toJSON() as DOMRectReadOnly,
    }
  }, index)
}

async function activeFitRects(
  page: Page,
  index: number,
): Promise<{ port: DOMRectReadOnly; view: DOMRectReadOnly }> {
  const rects = await fitRects(page, index)
  if (!rects) throw new Error(`slot ${String(index)} is not active`)
  return rects
}

test.describe('a5-fit-parity: A5 portrait Fit spread matches the kit', () => {
  for (const kit of KIT) {
    test(`spread 2–3 at Fit is the kit #/demo size (1440 × ${String(kit.height)})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: kit.height })
      await openA5Portrait(page)
      await rows(page).nth(1).click()
      await expect
        .poll(() => fitRects(page, 1), { timeout: 10_000 })
        .not.toBeNull()
      await expect(page.getByTestId('zoom-label')).toHaveText('Fit')

      const rects = await activeFitRects(page, 1)
      expect(rects.port.width).toBe(kit.port.width)
      expect(rects.port.height).toBe(kit.port.height)
      expect(Math.abs(rects.view.width - kit.spread.width)).toBeLessThanOrEqual(
        0.5,
      )
      expect(
        Math.abs(rects.view.height - kit.spread.height),
      ).toBeLessThanOrEqual(0.5)
    })
  }
})
