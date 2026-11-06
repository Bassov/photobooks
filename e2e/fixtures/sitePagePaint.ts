import type { Locator } from '@playwright/test'
import { pixelsAt } from './paintProbe'

/**
 * Site kit reader: RGBA at the centre of the photo on each page (`.sd-pg`)
 * whose centre is inside `cam` (the page centre when a photo covers it, else
 * its largest photo's centre). Pages without a photo are skipped.
 */
export async function visibleCentres(cam: Locator): Promise<number[][]> {
  const pts = await cam.evaluate((el) => {
    const o = el.getBoundingClientRect()
    return [...el.querySelectorAll('.sd-pg')].flatMap((pg) => {
      const p = pg.getBoundingClientRect()
      const [cx, cy] = [p.left + p.width / 2, p.top + p.height / 2]
      if (cx < o.left || cx > o.right) return []
      const cut = [...pg.querySelectorAll<HTMLElement>('*')]
        .filter((n) => /^url\((?!"?data:)/.test(n.style.backgroundImage))
        .map((n) => n.getBoundingClientRect())
        .filter((r) => r.width * r.height > 0)
        .sort((a, b) => b.width * b.height - a.width * a.height)
      const [big] = cut
      if (!big) return []
      const on = cut.some(
        (r) => cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom,
      )
      const c = on
        ? { x: cx, y: cy }
        : { x: big.left + big.width / 2, y: big.top + big.height / 2 }
      return [{ x: c.x - o.left, y: c.y - o.top }]
    })
  })
  return pts.length ? pixelsAt(cam, pts) : []
}

export const white = ([r, g, b]: number[]) =>
  r === 255 && g === 255 && b === 255
