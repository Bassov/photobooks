import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'

// site-stand (DEMO branch): the kit site stand holds demo 6, demo 7 and fresh C.
// On a phone the kit body's 1280 min-width made fresh C read innerWidth 1280 at
// first render and keep the desktop grid: the open book covered the lead and
// the title, the lead wrapped in a ~100 px column, the nav did not fit.

const SLUGS = ['site-demo-6', 'site-demo-7', 'site-fresh-c']

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

/** whether the element itself is painted at the centre of its box (not covered) */
function paintedAt(l: Locator) {
  return l.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return !!hit && el.contains(hit)
  })
}

test('the site-demos entry lists exactly the three stand demos', async ({
  page,
}) => {
  await page.goto('/uikit/#/full/site-demos')
  const links = page.getByTestId('site-demo-link')
  await expect(links).toHaveText(SLUGS)
  await expect(links.first()).toHaveAttribute('href', '#/full/site-demo-6')
})

test.describe('phone 390×844', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })

  test('fresh C takes the phone layout: full-width lead, book below it, Menu in the header', async ({
    page,
  }) => {
    await page.goto('/uikit/#/full/site-fresh-c')
    await expect(page.getByTestId('sfc')).toHaveClass(/sfc-phone/)
    const leadEl = page.locator('.sfc-lead').first()
    const titleEl = page.locator('.sfc-now .sfc-title')
    const lead = await box(leadEl)
    const title = await box(titleEl)
    const reader = await box(page.locator('.sd-reader'))
    expect(lead.width).toBeGreaterThanOrEqual(300)
    // the open book sits between the lead and the title, overlapping neither
    expect(reader.y).toBeGreaterThanOrEqual(lead.y + lead.height)
    expect(title.y).toBeGreaterThanOrEqual(reader.y + reader.height)
    expect(await paintedAt(leadEl)).toBe(true)
    expect(await paintedAt(titleEl)).toBe(true)
    const menu = await box(page.getByTestId('sfc-menu-btn'))
    expect(menu.x + menu.width).toBeLessThanOrEqual(390)
  })
})

// Spec site-stand S2–S4: the open book shows its thickness (side edges from the
// read fraction, tail strip, gutter), every page is photo paper, interior
// leaves curl (paper leaf), perspective 2 × the reader width.

/** opens the first book's reader on view 1 (endpaper | title page) */
async function openReader(page: Page, slug: string) {
  await page.goto(`/uikit/#/full/${slug}`)
  if (slug === 'site-fresh-c') {
    await page.getByTestId('sfc-item').first().click()
    await page.getByTestId('sfc-open').click()
  } else {
    await page
      .getByTestId(slug === 'site-demo-6' ? 'ss6-book' : 'ss7-book')
      .first()
      .click()
    await page.getByTestId('ss-open').click()
  }
  const reader = page.getByTestId('ps-reader')
  await expect(reader).toHaveAttribute('data-view', '1')
  return reader
}

/** one click on the right page; resolves once the reader rests on `view` */
async function turnTo(reader: Locator, view: number, paper = false) {
  const b = await box(reader)
  await reader.click({ position: { x: b.width * 0.75, y: b.height / 2 } })
  if (paper)
    await expect(
      reader.locator('[data-testid="ps-leaf"][data-leaf="paper"]'),
    ).toBeAttached()
  await expect(reader).toHaveAttribute('data-view', String(view))
  await expect(reader.getByTestId('ps-leaf')).toHaveCount(0)
}

/** the open book's thickness parts: edge widths, and whether each part is the
   topmost paint at its centre (nothing covers it) */
function thickness(reader: Locator) {
  return reader.evaluate((el) => {
    const css = document.head.appendChild(document.createElement('style'))
    css.textContent = '.sd-reader * { pointer-events: auto !important }'
    const top = (sel: string) =>
      [...el.querySelectorAll(sel)].map((n) => {
        const r = n.getBoundingClientRect()
        const hit = document.elementFromPoint(
          r.x + r.width / 2,
          r.y + r.height / 2,
        )
        return {
          w: Math.round(r.width * 10) / 10,
          // a 1 px edge (nothing read yet) is below the hit-test resolution
          top:
            r.width < 2 || hit === n
              ? true
              : `${sel} under ${hit?.parentElement?.className ?? 'nothing'}`,
        }
      })
    const out = {
      edges: top('.sd-edge'),
      tail: top('.sd-tail'),
      gutter: top('.sd-gutter'),
    }
    css.remove()
    return out
  })
}

/** RGBA at the centre of each page that holds a photo: the page centre when a
   photo covers it, else the centre of the page's largest photo (art.tsx paints
   photos as background images; the paper grain is a data: URL) */
async function pageCentres(reader: Locator) {
  const pts = await reader.evaluate((el) => {
    const o = el.getBoundingClientRect()
    return [...el.querySelectorAll('.sd-pg')].flatMap((pg) => {
      const p = pg.getBoundingClientRect()
      const cut = [...pg.querySelectorAll<HTMLElement>('*')]
        .filter((n) => /url\("?(?!data:)/.test(n.style.backgroundImage))
        .map((n) => {
          const r = n.getBoundingClientRect()
          const [x0, y0] = [Math.max(r.left, p.left), Math.max(r.top, p.top)]
          const [x1, y1] = [
            Math.min(r.right, p.right),
            Math.min(r.bottom, p.bottom),
          ]
          return {
            x0,
            y0,
            x1,
            y1,
            a: Math.max(0, x1 - x0) * Math.max(0, y1 - y0),
          }
        })
        .filter((c) => c.a > 0)
        .sort((a, b) => b.a - a.a)
      const [big] = cut
      if (!big) return []
      const [cx, cy] = [p.left + p.width / 2, p.top + p.height / 2]
      const on = cut.find(
        (c) => cx >= c.x0 && cx <= c.x1 && cy >= c.y0 && cy <= c.y1,
      )
      const c = on
        ? { x: cx, y: cy }
        : { x: (big.x0 + big.x1) / 2, y: (big.y0 + big.y1) / 2 }
      return [{ x: c.x - o.left, y: c.y - o.top }]
    })
  })
  return pts.length ? pixelsAt(reader, pts) : []
}

test.describe('desktop 1440×900: the open book', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  for (const slug of SLUGS)
    test(`${slug}: perspective 2 × W, a paper leaf turns, thickness and photo paper paint`, async ({
      page,
    }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text())
      })
      const reader = await openReader(page, slug)
      const { w, persp, origin } = await reader.evaluate((el) => {
        const cs = getComputedStyle(el)
        return {
          w: el.getBoundingClientRect().width,
          persp: parseFloat(cs.perspective),
          origin: cs.perspectiveOrigin,
        }
      })
      expect(Math.abs(persp - 2 * w)).toBeLessThanOrEqual(1)
      // the spine centre
      const [ox = 0, oy = 0] = origin.split(' ').map(parseFloat)
      expect(Math.abs(ox - w / 2)).toBeLessThan(0.5)
      expect(Math.abs(oy - (await box(reader)).height / 2)).toBeLessThan(0.5)

      // view 1 → 2 is an interior leaf: paper, not the rigid board
      await turnTo(reader, 2, true)
      const t1 = await thickness(reader)
      expect(t1.edges).toHaveLength(2)
      expect(t1.tail).toHaveLength(1)
      expect(t1.gutter).toHaveLength(1)
      for (const part of [...t1.edges, ...t1.tail, ...t1.gutter]) {
        expect(part.top).toBe(true)
        expect(part.w).toBeGreaterThan(0)
      }
      // spread 1: few pages read, the right block is the thicker one
      const [eL1 = 0, eR1 = 0] = t1.edges.map((e) => e.w)
      expect(eR1).toBeGreaterThan(eL1)

      const centres = await pageCentres(reader)
      expect(centres.length).toBeGreaterThan(0)
      for (const [r, g, b] of centres)
        expect(r === 255 && g === 255 && b === 255).toBe(false)

      // the middle of the book (read fraction ½): the edges even out
      const mid = Math.round(
        1 + (Number(await reader.getAttribute('data-views')) - 3) / 2,
      )
      for (let v = 3; v <= mid; v++) await turnTo(reader, v)
      const [eL2 = 0, eR2 = 0] = (await thickness(reader)).edges.map((e) => e.w)
      expect(eL2).toBeGreaterThan(eL1)
      expect(eR2).toBeLessThan(eR1)
      expect(Math.abs(eL2 - eR2)).toBeLessThanOrEqual(2)
      for (const [r, g, b] of await pageCentres(reader))
        expect(r === 255 && g === 255 && b === 255).toBe(false)
      test.info().annotations.push({
        type: 'paint',
        description: JSON.stringify({
          slug,
          w,
          persp,
          spread1: [eL1, eR1],
          mid: [mid, eL2, eR2],
          tail: t1.tail[0]?.w,
          gutter: t1.gutter[0]?.w,
        }),
      })
      expect(errors).toEqual([])
    })
})
