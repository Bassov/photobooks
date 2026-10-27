import type { Locator } from '@playwright/test'

/** Viewport point `dy` px below the locator's bottom edge (or its centre when omitted). */
export async function pointOf(
  locator: Locator,
  below?: number,
): Promise<{ clientX: number; clientY: number }> {
  const box = await locator.boundingBox()
  if (box === null) {
    throw new Error('locator has no box')
  }
  return {
    clientX: box.x + box.width / 2,
    clientY:
      below === undefined ? box.y + box.height / 2 : box.y + box.height + below,
  }
}
