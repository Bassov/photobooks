import { expect, type Page } from '@playwright/test'

/** Kit `#/demo` at 1440 × 900: 44 px gap under the 588 px Fit spread. */
export const KIT_GAP_RATIO = 44 / 588

export interface SpreadBox {
  x: number
  y: number
  width: number
  height: number
}

/** Painted spreads of the mounted stack, top to bottom, read in one frame. */
export async function spreadBoxes(page: Page): Promise<SpreadBox[]> {
  return page
    .getByTestId('pasteboard-scroll')
    .locator('[data-pasteboard-slot] [data-testid="spread-view"]')
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height }
      }),
    )
}

/** Gap (spread i bottom → spread i+1 top) over spread i's height. */
export function gapRatios(boxes: readonly SpreadBox[]): number[] {
  const ratios: number[] = []
  for (let i = 1; i < boxes.length; i += 1) {
    const prev = boxes[i - 1]
    const next = boxes[i]
    if (prev === undefined || next === undefined) continue
    ratios.push((next.y - (prev.y + prev.height)) / prev.height)
  }
  return ratios
}

/** Gap ratios once at least two spreads are mounted. */
export async function readGapRatios(page: Page): Promise<number[]> {
  await expect
    .poll(async () => (await spreadBoxes(page)).length)
    .toBeGreaterThanOrEqual(2)
  return gapRatios(await spreadBoxes(page))
}

/** Every gap is the kit ratio of its spread height, within `tolerance`. */
export async function expectKitGapRatio(
  page: Page,
  tolerance = 0.02,
): Promise<void> {
  for (const ratio of await readGapRatios(page)) {
    expect(Math.abs(ratio / KIT_GAP_RATIO - 1)).toBeLessThanOrEqual(tolerance)
  }
}

async function firstSpreadHeight(page: Page): Promise<number> {
  return (await spreadBoxes(page))[0]?.height ?? 0
}

/**
 * Zoom out with the toolbar until the painted spread stops shrinking (the
 * rounded zoom percent can stall above the floor).
 */
export async function zoomOutToFloor(page: Page): Promise<void> {
  for (let guard = 0; guard < 40; guard += 1) {
    const before = await firstSpreadHeight(page)
    await page.getByTestId('zoom-out').click()
    const changed = await expect
      .poll(() => firstSpreadHeight(page), { timeout: 1_000 })
      .not.toBe(before)
      .then(
        () => true,
        () => false,
      )
    if (!changed) return
  }
  throw new Error('zoom-out never reached the floor')
}
