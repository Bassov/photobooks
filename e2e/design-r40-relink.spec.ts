import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { ensurePhotoFixtures } from './fixtures/ensurePhotoFixtures'
import { pixelsAt } from './fixtures/paintProbe'

// design-r40-relink-prod (Designer walkthrough-ux-review p5, Must M150): the
// Relink dialog matches the kit RelinkDialog (uikit/src/demo-parts/dialogs.tsx,
// p5/out/check3.json). design-r44-relink-border-prod (p6, Must M154): the panel
// is borderless like the kit's, so offsets are read from its outer box.

test.use({ viewport: { width: 1440, height: 900 } })

interface RelinkTestApi {
  resetRelinkStore: () => void
  setRelinkDialogOpen: (open: boolean) => void
  replaceRelinkStatuses: (
    next: Iterable<[string, 'missing' | 'modified' | 'ok']>,
  ) => void
}

async function openRelinkWithMissing(page: Page): Promise<void> {
  ensurePhotoFixtures({ includeLargeJpeg: false })
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('editor-shell')).toBeVisible({
    timeout: 15_000,
  })
  await page.waitForFunction(
    () =>
      (window as unknown as { __photobooksRelink?: RelinkTestApi })
        .__photobooksRelink !== undefined,
    { timeout: 15_000 },
  )
  await page.evaluate(() => {
    const api = (window as unknown as { __photobooksRelink?: RelinkTestApi })
      .__photobooksRelink
    if (!api) throw new Error('relink API missing')
    api.resetRelinkStore()
    api.replaceRelinkStatuses([
      ['asset-a', 'missing'],
      ['asset-b', 'missing'],
    ])
    api.setRelinkDialogOpen(true)
  })
  await expect(page.getByTestId('relink-row')).toHaveCount(2)
}

interface Geometry {
  width: number
  panelBorder: string
  title: { x: number; y: number; size: number; lh: number; ls: number }
  sub: { lh: number; h: number }
  list: {
    x: number
    right: number
    top: number
    border: string
    bg: string
    mt: number
  }
  rows: { h: number; pad: string; border: string }[]
  nameLh: number
  badge: { pad: string }
  dot: { w: number; h: number } | null
  foot: { border: string; bottom: number; right: number }
}

/** Panel, title, list, row, badge and footer geometry, outer-box relative. */
function readGeometry(page: Page): Promise<Geometry> {
  return page.getByTestId('relink-dialog').evaluate((panel): Geometry => {
    const p = panel.getBoundingClientRect()
    const x0 = p.left
    const y0 = p.top
    const right0 = p.right
    const bottom0 = p.bottom
    const q = (sel: string): HTMLElement => {
      const el = panel.querySelector<HTMLElement>(sel)
      if (el === null) throw new Error(`missing ${sel}`)
      return el
    }
    const title = q('.pb-dialog-title')
    const range = document.createRange()
    range.selectNodeContents(title)
    const t = range.getBoundingClientRect()
    const tcs = getComputedStyle(title)
    const list = q('[data-testid="relink-list"]')
    const lr = list.getBoundingClientRect()
    const lcs = getComputedStyle(list)
    const header = q('header').getBoundingClientRect()
    const sub = q('header p')
    const rows = [
      ...panel.querySelectorAll<HTMLElement>('[data-testid="relink-row"]'),
    ]
    const firstRow = rows[0]
    if (firstRow === undefined) throw new Error('no rows')
    const badge = firstRow.querySelector<HTMLElement>('.pb-badge')
    if (badge === null) throw new Error('no badge')
    const dot = badge.querySelector('.pb-badge-dot')
    const name = firstRow.firstElementChild
    if (name === null) throw new Error('no name')
    const foot = q('footer')
    const buttons = [...foot.querySelectorAll('button')].map((b) =>
      b.getBoundingClientRect(),
    )
    return {
      width: p.width,
      panelBorder: getComputedStyle(panel).borderTopWidth,
      sub: {
        lh: Number.parseFloat(getComputedStyle(sub).lineHeight),
        h: sub.getBoundingClientRect().height,
      },
      title: {
        x: t.left - x0,
        y: title.getBoundingClientRect().top - y0,
        size: Number.parseFloat(tcs.fontSize),
        lh: Number.parseFloat(tcs.lineHeight),
        ls: Number.parseFloat(tcs.letterSpacing),
      },
      list: {
        x: lr.left - x0,
        right: right0 - lr.right,
        top: lr.top - y0,
        border: lcs.borderTopWidth,
        bg: lcs.backgroundColor,
        mt: lr.top - header.bottom,
      },
      rows: rows.map((r) => {
        const cs = getComputedStyle(r)
        return {
          h: r.getBoundingClientRect().height,
          pad: cs.padding,
          border: cs.borderBottomWidth,
        }
      }),
      nameLh: Number.parseFloat(getComputedStyle(name).lineHeight),
      badge: { pad: getComputedStyle(badge).padding },
      dot:
        dot === null
          ? null
          : {
              w: dot.getBoundingClientRect().width,
              h: dot.getBoundingClientRect().height,
            },
      foot: {
        border: getComputedStyle(foot).borderTopWidth,
        bottom: Math.min(...buttons.map((b) => bottom0 - b.bottom)),
        right: Math.min(...buttons.map((b) => right0 - b.right)),
      },
    }
  })
}

const near = (actual: number, kit: number, tol = 1): void => {
  expect(Math.abs(actual - kit)).toBeLessThanOrEqual(tol)
}

test('the Relink dialog matches the kit RelinkDialog geometry', async ({
  page,
}) => {
  await openRelinkWithMissing(page)

  const g = await readGeometry(page)

  near(g.width, 560)
  // M154: borderless panel, kit offsets from the outer box (±0.5).
  expect(g.panelBorder).toBe('0px')
  near(g.title.x, 24, 0.5)
  near(g.title.y, 20, 0.5)
  near(g.sub.lh, 18.85, 0.01)
  near(g.sub.h, 37.69, 0.5)
  near(g.list.top, 103.94, 0.5)
  expect(g.title.size).toBe(21)
  near(g.title.lh, 26.25, 0.01)
  near(g.title.ls, -0.105, 0.001)
  near(g.list.x, 24)
  near(g.list.right, 24)
  near(g.list.mt, 8)
  expect(g.list.border).toBe('0px')
  expect(g.list.bg).toBe('rgb(216, 214, 210)')
  for (const row of g.rows) {
    near(row.h, 36, 0.01)
    expect(row.pad).toBe('8px 12px')
    expect(row.border).toBe('0px')
  }
  near(g.nameLh, 18.85, 0.01)
  expect(g.badge.pad).toBe('0px 6px 0px 4px')
  expect(g.dot).toEqual({ w: 5, h: 5 })
  expect(g.foot.border).toBe('0px')
  near(g.foot.bottom, 20, 0.5)
  near(g.foot.right, 24, 0.5)
})

test('the Missing badge paints its status dot', async ({ page }) => {
  await openRelinkWithMissing(page)
  const badge = page.getByTestId('relink-row').first().locator('.pb-badge')
  await expect(badge).toHaveText('Missing')
  const box = await badge.evaluate((el) => ({
    w: el.getBoundingClientRect().width,
    h: el.getBoundingClientRect().height,
  }))

  // Dot centre (4 px left pad + 2.5) vs the badge fill in the right pad.
  const [dot = [], fill = []] = await pixelsAt(badge, [
    { x: 6.5, y: box.h / 2 },
    { x: box.w - 3, y: box.h / 2 },
  ])

  const diff = Math.max(...[0, 1, 2].map((k) => (fill[k] ?? 0) - (dot[k] ?? 0)))
  expect(diff).toBeGreaterThan(40)
})
