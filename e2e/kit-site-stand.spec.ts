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
    // Spec site-stand S5 / S7: one page at a time, the camera box full bleed
    const reader = await box(
      page.getByTestId('sfc-stage').getByTestId('ps-pager'),
    )
    expect(lead.width).toBeGreaterThanOrEqual(300)
    expect(reader.x).toBe(0)
    expect(reader.width).toBe(390)
    // the open book sits between the lead and the title, overlapping neither
    expect(reader.y).toBeGreaterThanOrEqual(lead.y + lead.height)
    expect(title.y).toBeGreaterThanOrEqual(reader.y + reader.height)
    expect(await paintedAt(leadEl)).toBe(true)
    expect(await paintedAt(titleEl)).toBe(true)
    const menu = await box(page.getByTestId('sfc-menu-btn'))
    expect(menu.x + menu.width).toBeLessThanOrEqual(390)

    // the portrait book's page fills about half the screen height
    await page.goto('/uikit/#/full/site-fresh-c?b=lake-trip&gl=0')
    // the closed cover opens on page 1
    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('sfc-player')).toHaveAttribute(
      'data-view',
      '1',
    )
    await expect(page.getByTestId('ps-leaf')).toHaveCount(0)
    const pg = await box(
      page.getByTestId('sfc-stage').locator('.sd-pg').first(),
    )
    expect(pg.height).toBeGreaterThanOrEqual(0.45 * 844)
    // stage = tallest page of the programme + 40, so it never jumps between books
    const stage = await box(page.getByTestId('sfc-stage'))
    expect(stage.height).toBeGreaterThanOrEqual(pg.height + 39)
    expect(stage.height).toBeLessThanOrEqual(pg.height + 48)
  })
})

// Spec site-stand S2–S4: the open book shows its thickness (side edges from the
// read fraction, tail strip, gutter), every page is photo paper, interior
// leaves curl (paper leaf), perspective 2 × the reader width.

/** opens the first book's CSS reader (`?gl=0`) on view 1 (endpaper | title page) */
async function openReader(page: Page, slug: string) {
  if (slug === 'site-fresh-c') {
    // the first book's page (a list click rewrites the hash and drops `gl=0`)
    await page.goto(`/uikit/#/full/${slug}?b=lake-trip&gl=0`)
    await page.getByTestId('sfc-open').click()
    // Read the book opens the reading room on view 1
    const reader = page.getByTestId('ss-reader-page').getByTestId('ps-reader')
    await expect(reader).toHaveAttribute('data-view', '1')
    return reader
  } else {
    await page.goto(`/uikit/#/full/${slug}?gl=0`)
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
async function pageCentres(reader: Locator, clip: Locator = reader) {
  const pts = await reader.evaluate(
    (el, cl) => {
      // the single-page camera (`clip`) shows only the pages inside it
      const o = cl.getBoundingClientRect()
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
        if (c.x < o.left || c.x > o.right) return []
        return [{ x: c.x - o.left, y: c.y - o.top }]
      })
    },
    await clip.elementHandle(),
  )
  return pts.length ? pixelsAt(clip, pts) : []
}

const white = ([r, g, b]: number[]) => r === 255 && g === 255 && b === 255

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

// Spec site-stand S6 / S7 (fresh C): Read opens the reading room over the
// site under the header; opening pauses the programme on the shown view;
// Esc closes once and focus returns to the trigger. The room steps through
// every view of Lake trip and Coast with each photo page painted (the 21:xx
// stand capture had a blank right page).

/** room: the portrait book's width and height range (desktop the spread,
   1157 × 723; phone the camera box and one page ≥ 0.45 × 844) */
const VIEWPORTS = [
  {
    name: 'desktop 1440×900',
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false,
    room: { w: 1157, hMin: 722, hMax: 724 },
  },
  {
    name: 'phone 390×844',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    room: { w: 390, hMin: 0.45 * 844, hMax: 844 },
  },
]

async function roomBook(room: Locator, phone: boolean) {
  const reader = await box(room.locator('.sd-reader'))
  if (!phone)
    return { w: Math.round(reader.width), h: Math.round(reader.height) }
  const cam = await box(room.getByTestId('ps-pager'))
  const pg = await box(room.locator('.sd-pg').first())
  return { w: Math.round(cam.width), h: Math.round(pg.height) }
}

/** Next through the room to the back cover; at each rest the RGB at the
   centre of every visible photo page */
async function walkRoom(room: Locator, phone: boolean) {
  const reader = room.getByTestId('ps-reader')
  const pager = room.getByTestId('ps-pager')
  const next = room.getByTestId('ss-next')
  const seen: { label: string; centres: number[][] }[] = []
  // the room opens on view 1 (the pager's step 1)
  for (let k = 1; ; k++) {
    // at rest: the pager landed on step k / the reader on view k
    await expect(phone ? pager : reader).toHaveAttribute(
      phone ? 'data-step' : 'data-view',
      String(k),
    )
    await expect(reader.getByTestId('ps-leaf')).toHaveCount(0)
    seen.push({
      label: (await room.getByTestId('ss-label').textContent()) ?? '',
      centres: await pageCentres(reader, phone ? pager : reader),
    })
    if (await next.isDisabled()) return seen
    await next.click()
  }
}

function consoleErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return errors
}

for (const vp of VIEWPORTS)
  test.describe(`fresh C ${vp.name}: the reading room`, () => {
    test.use({
      viewport: vp.viewport,
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
    })
    const phone = vp.viewport.width < 768

    test('Read opens the room paused on the shown view; Esc closes, focus returns, Play resumes', async ({
      page,
    }) => {
      const errors = consoleErrors(page)
      // one book: Lake trip (portrait) owns every minute
      // the CSS reader (`?gl=0`): the room book is measured off its page boxes
      await page.goto('/uikit/#/full/site-fresh-c?books=1&gl=0')
      const actions = page.getByTestId('sfc-now').locator('.sfc-actions > *')
      await expect(actions).toHaveText(['Pause', 'Read', 'About this book'])
      const read = page.getByTestId('sfc-read-room')
      await read.click()
      const room = page.getByTestId('ss-reader-page')
      await expect(room).toBeVisible()
      await expect(page.getByTestId('sfc-status')).toHaveText('Paused')
      const layer = await room.evaluate((el) => {
        const cs = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        return { pos: cs.position, z: cs.zIndex, x: r.x, y: r.y, w: r.width }
      })
      expect(layer).toEqual({
        pos: 'fixed',
        z: '20',
        x: 0,
        y: 0,
        w: vp.viewport.width,
      })
      // the header stays on top of the room
      expect(await paintedAt(page.locator('.sfc-name'))).toBe(true)
      // the room opens on the view the stage showed (a closed cover opens)
      const shown = Number(
        await page.getByTestId('sfc-player').getAttribute('data-view'),
      )
      await expect(room.getByTestId('ss-reader')).toHaveAttribute(
        'data-view',
        String(Math.max(1, shown)),
      )
      const rb = await roomBook(room, phone)
      expect(rb.w).toBe(vp.room.w)
      expect(rb.h).toBeGreaterThanOrEqual(vp.room.hMin)
      expect(rb.h).toBeLessThanOrEqual(vp.room.hMax)
      await room.getByTestId('ss-next').click()
      const kept = await room.getByTestId('ss-reader').getAttribute('data-view')

      await page.keyboard.press('Escape')
      await expect(room).toHaveCount(0)
      await expect(read).toBeFocused()
      await expect(page.getByTestId('sfc-player')).toHaveAttribute(
        'data-view',
        kept ?? '',
      )
      await expect(page.getByTestId('sfc-status')).toHaveText('Paused')
      await page.getByTestId('sfc-toggle').click()
      await expect(page.getByTestId('sfc-status')).toHaveText(/^Now/)
      expect(errors).toEqual([])
    })

    test('book page: Read the book opens the closed book on view 1; Esc closes the room only', async ({
      page,
    }) => {
      const errors = consoleErrors(page)
      await page.goto('/uikit/#/full/site-fresh-c?b=coast')
      const open = page.getByTestId('sfc-open')
      await expect(open).toHaveText('Read the book')
      await open.click()
      const room = page.getByTestId('ss-reader-page')
      await expect(room.getByTestId('ss-reader')).toHaveAttribute(
        'data-view',
        '1',
      )
      await page.keyboard.press('Escape')
      await expect(room).toHaveCount(0)
      await expect(open).toBeFocused()
      await expect(page.getByTestId('sfc')).toHaveAttribute('data-page', 'book')
      expect(errors).toEqual([])
    })

    for (const id of ['lake-trip', 'coast'])
      test(`paint: every view of ${id} shows its photo pages`, async ({
        page,
      }) => {
        const errors = consoleErrors(page)
        await page.goto(`/uikit/#/full/site-fresh-c?b=${id}&gl=0`)
        await page.getByTestId('sfc-open').click()
        const seen = await walkRoom(page.getByTestId('ss-reader-page'), phone)
        expect(seen.at(-1)?.label).toBe('Back cover')
        // no photo page paints as #FFFFFF
        expect(seen.flatMap((s) => s.centres).filter(white)).toEqual([])
        // every view between the covers was sampled; most hold a photo
        const photos = seen.reduce((s, x) => s + x.centres.length, 0)
        expect(photos).toBeGreaterThanOrEqual(seen.length / 2)
        test.info().annotations.push({
          type: 'paint',
          description: JSON.stringify({ id, views: seen.length, photos }),
        })
        expect(errors).toEqual([])
      })
  })
