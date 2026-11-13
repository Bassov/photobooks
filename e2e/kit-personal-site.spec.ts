import type { Locator, Page } from '@playwright/test'
import { animationsSettled } from './fixtures/animationsSettled'
import { expect, test } from './fixtures/coverage'
import { pixelsAt, topAt } from './fixtures/paintProbe'

// personal-site (kit page, port of the site stand's demo 9): the bookcase home and the open book. Two states (D3): a
// click opens the reading room, `&book=<id>` is pushed, Back / Esc / "All books" close it and focus returns to the
// book.

const SITE = '/uikit/#/full/personal-site'

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

const near = (a: number, b: number, d = 0.5) => {
  expect(Math.abs(a - b), `${String(a)} ≈ ${String(b)}`).toBeLessThanOrEqual(d)
}

function consoleErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return errors
}

// Spec site-stand S2–S4: the open book shows its thickness (side edges from the
// read fraction, tail strip, gutter), every page is photo paper, interior
// leaves curl (paper leaf), perspective 2 × the reader width.

/** opens the first book's CSS reader (`?gl=0`) on view 1 (endpaper | title page) */
async function openReader(page: Page) {
  await page.goto(`${SITE}?gl=0`)
  // the click opens the room at the cover, which turns to view 1 at once
  await page.getByTestId('ss9-book').first().click()
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
        .filter((n) => /^url\((?!"?data:)/.test(n.style.backgroundImage))
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
  })
  return pts.length ? pixelsAt(reader, pts) : []
}

test.describe('desktop 1440×900: the open book', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('perspective 2 × W, a paper leaf turns, thickness and photo paper paint', async ({
    page,
  }) => {
    const errors = consoleErrors(page)
    const reader = await openReader(page)
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

// Spec site-stand-v2 S: the open flow, the header, the counts.

const VIEWPORTS = [
  {
    name: 'desktop 1440×900',
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false,
  },
  {
    name: 'phone 390×844',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  },
]

/** a room just opened by a click rests on view 1; a phone portrait on the cover (site-stand-v5 D23) */
async function expectOpened(room: Locator, phone: boolean) {
  if (phone) await expect(room.getByTestId('site-label')).toHaveText('Cover')
  else
    await expect(room.getByTestId('site-room')).toHaveAttribute(
      'data-view',
      '1',
    )
}

for (const vp of VIEWPORTS)
  test.describe(`${vp.name}: two states`, () => {
    test.use({
      viewport: vp.viewport,
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
    })

    test('a click opens the room with book= in the URL; Back, Esc and All books close it, focus returns', async ({
      page,
    }) => {
      const errors = consoleErrors(page)
      await page.goto(SITE)
      const room = page.getByTestId('ss-reader-page')
      const all = page.getByTestId('site-all-books')
      // home: no About / Contact / Books nav, no All books, no Menu
      await expect(
        page.getByRole('button', { name: /^(About|Contact|Books|Menu)$/ }),
      ).toHaveCount(0)
      await expect(
        page.getByRole('link', { name: /^(About|Contact)$/ }),
      ).toHaveCount(0)
      await expect(all).toHaveCount(0)

      const book = page.getByTestId('ss9-book').locator('visible=true').first()
      const id = await book.getAttribute('data-id')
      const close = [
        () => page.goBack(),
        () => page.keyboard.press('Escape'),
        () => all.click(),
      ]
      for (const shut of close) {
        await book.click()
        await expect(room).toBeVisible()
        expect(page.url()).toContain(`book=${id ?? ''}`)
        await expectOpened(room, vp.isMobile)
        await expect(all).toBeVisible()
        await shut()
        await expect(room).toHaveCount(0)
        expect(page.url()).not.toContain('book=')
        await expect(book).toBeFocused()
        await expect(all).toHaveCount(0)
      }
      expect(errors).toEqual([])
    })

    for (const n of [1, 6, 30])
      test(`books=${String(n)}: ${String(n)} books, no horizontal page scroll`, async ({
        page,
      }) => {
        const errors = consoleErrors(page)
        await page.goto(`${SITE}?books=${String(n)}`)
        // the count comes from the hash only: no site-wide Books switch
        await expect(page.getByTestId('ss-switch')).toHaveCount(0)
        const root = page.locator('[data-books]')
        await expect(root).toHaveAttribute('data-books', String(n))
        const ids = await page
          .getByTestId('ss9-book')
          .evaluateAll(
            (els) => new Set(els.map((e) => e.getAttribute('data-id'))).size,
          )
        expect(ids).toBe(n)
        const sw = await page.evaluate(() => [
          document.documentElement.scrollWidth,
          innerWidth,
        ])
        expect(sw[0]).toBe(sw[1])
        expect(errors).toEqual([])
      })
  })

// site-stand-v3 B / v4 D17 / v7 D30: one bookcase, one shelf per 12 books or
// more at 12, as many as 30 books need; the page scrolls down to every book.

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const rgbDiff = (a: number[], b: number[]) =>
  Math.max(...[0, 1, 2].map((i) => Math.abs((a[i] ?? 0) - (b[i] ?? 0))))

for (const vp of VIEWPORTS)
  test.describe(`${vp.name}: bookcase`, () => {
    test.use({
      viewport: vp.viewport,
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
    })
    const phone = vp.viewport.width < 768

    if (!phone)
      test('books=6 → one shelf, books=30 → two or more', async ({ page }) => {
        const bays = page.getByTestId('site-bay')
        await page.goto(`${SITE}?books=6`)
        await expect(page.getByTestId('ss9-book')).toHaveCount(6)
        await expect(bays).toHaveCount(1)
        // 6 books: one face-out, five spines
        await expect(bays.locator('[data-kind="face"]')).toHaveCount(1)
        await page.goto(`${SITE}?books=30`)
        await expect(page.getByTestId('ss9-book')).toHaveCount(30)
        expect(await bays.count()).toBeGreaterThanOrEqual(2)
        // every shelf starts with a face-out book
        expect(await bays.locator('[data-kind="face"]').count()).toBe(
          await bays.count(),
        )
        // site-stand-v4 D17 / v7 D30: no side column or caption; the lead 104 from the top on the case's left
        // edge, the case 40 below it, centred in the scroller, min(span 10, 1430) wide (1157.33 at 1440)
        await expect(page.getByTestId('ss9-caption')).toHaveCount(0)
        const c = await box(page.getByTestId('site-case'))
        const lead = await box(page.getByTestId('site-lead'))
        expect(Math.abs(lead.y - 104)).toBeLessThanOrEqual(0.5)
        expect(Math.abs(lead.x - c.x)).toBeLessThanOrEqual(0.5)
        expect(Math.abs(c.y - (lead.y + lead.height + 40))).toBeLessThanOrEqual(
          0.5,
        )
        const cw = await page
          .getByTestId('site-home')
          .evaluate((el) => el.clientWidth)
        expect(Math.abs(c.x + c.width / 2 - cw / 2)).toBeLessThanOrEqual(0.5)
        expect(Math.abs(c.width - 1157.33)).toBeLessThanOrEqual(0.5)
      })

    // Designer Spec checkpoints (1440×900, books=6): the lead, the case and the first bay
    if (!phone)
      test('books=6: lead, case and bay boxes match the Designer Spec', async ({
        page,
      }) => {
        await page.goto(`${SITE}?books=6`)
        await expect(page.getByTestId('ss9-book')).toHaveCount(6)
        const lead = await box(page.getByTestId('site-lead'))
        near(lead.x, 141.33)
        near(lead.y, 104)
        near(lead.width, 640)
        const c = await box(page.getByTestId('site-case'))
        near(c.x, 141.33)
        near(c.y, 206.38)
        near(c.width, 1157.33)
        near(c.height, 572.44)
        const bay = await box(page.getByTestId('site-bay').first())
        near(bay.x, 169.33)
        near(bay.y, 234.38)
        near(bay.width, 1101.33)
        near(bay.height, 482.22)
      })

    if (!phone)
      test('the case is as wide at books 1, 3, 6 and 12', async ({ page }) => {
        const widths: number[] = []
        for (const n of [1, 3, 6, 12]) {
          await page.goto(`${SITE}?books=${String(n)}`)
          await expect(page.getByTestId('ss9-book')).toHaveCount(n)
          widths.push((await box(page.getByTestId('site-case'))).width)
        }
        for (const w of widths) near(w, widths[0] ?? 0)
      })

    // site-stand-v7 D30: one case width min(span 10, 1430) and one scale z for any count
    // (z = clamp((h − 104 − 62.4 − 40 − 72) / H1, Z, 14/9), H1 = one 30 cm shelf at z 1)
    if (!phone)
      for (const [n, w, h, z, width] of [
        [6, 1440, 900, 14 / 9, 1157.33],
        [12, 1440, 900, 14 / 9, 1157.33],
        [100, 1440, 900, 14 / 9, 1157.33],
        [100, 1920, 1080, 14 / 9, 1430],
      ] as const)
        test(`books=${String(n)} at ${String(w)}×${String(h)}: z ${z.toFixed(4)}, case ${String(width)} wide`, async ({
          page,
        }) => {
          await page.setViewportSize({ width: w, height: h })
          await page.goto(`${SITE}?books=${String(n)}`)
          await expect(page.getByTestId('ss9-book')).toHaveCount(n)
          const cs = page.getByTestId('site-case')
          const zz = await cs.evaluate((el) =>
            Number(el.style.getPropertyValue('--z')),
          )
          expect(Math.abs(zz - z)).toBeLessThanOrEqual(0.0001)
          const c = await box(cs)
          expect(Math.abs(c.width - width)).toBeLessThanOrEqual(0.5)
        })

    // site-stand-v7 D30: every shelf row keeps its natural width, centred in its bay (unrotated items)
    if (!phone)
      for (const n of [1, 6, 100] as const)
        test(`books=${String(n)}: each bay's books are centred`, async ({
          page,
        }) => {
          await page.goto(`${SITE}?books=${String(n)}`)
          await expect(page.getByTestId('ss9-book')).toHaveCount(n)
          const gaps = await page.getByTestId('site-bay').evaluateAll((bays) =>
            bays.map((bay) => {
              const pad =
                12 *
                Number(
                  bay
                    .closest<HTMLElement>('[data-testid="site-case"]')
                    ?.style.getPropertyValue('--z'),
                )
              // the painted extent at rest (nothing hovered): a leaning spine counts by its rotated box
              const b = bay.getBoundingClientRect()
              const items = [
                ...bay.querySelectorAll<HTMLElement>(
                  '[data-testid="ss9-book"]',
                ),
              ].map((el) => el.getBoundingClientRect())
              const l = Math.min(...items.map((it) => it.left))
              const r = Math.max(...items.map((it) => it.right))
              return { l: l - b.left - pad, r: b.right - pad - r }
            }),
          )
          expect(gaps.length).toBeGreaterThan(0)
          for (const { l, r } of gaps)
            expect(
              Math.abs(l - r),
              `gaps ${String(l)} / ${String(r)}`,
            ).toBeLessThanOrEqual(1)
        })

    // site-stand-v7 D32: the phone home is the name, the lead and the case; one tap opens a book
    if (phone)
      test('phone: no caption or Books switch, one tap opens, the name scrolls away', async ({
        page,
      }) => {
        const errors = consoleErrors(page)
        await page.goto(`${SITE}?books=30`)
        await expect(page.getByTestId('ss9-book')).toHaveCount(30)
        await expect(page.getByTestId('ss9-caption')).toHaveCount(0)
        await expect(page.getByTestId('ss-switch')).toHaveCount(0)
        await expect(
          page.getByRole('button', { name: 'Open the book' }),
        ).toHaveCount(0)
        await expect(page.locator('.ss-head')).toHaveCount(0)
        const name = page.getByTestId('site-name')
        await expect(name).toHaveText('Aleksandr Basov')
        expect(Math.abs((await box(name)).y - 16)).toBeLessThanOrEqual(1)
        await page.getByTestId('site-home').evaluate((el) => {
          el.scrollTop = 300
        })
        await expect.poll(async () => (await box(name)).y).toBeCloseTo(-284, 0)
        const first = page.getByTestId('ss9-book').first()
        const id = await first.getAttribute('data-id')
        await page.getByTestId('site-home').evaluate((el) => {
          el.scrollTop = 0
        })
        await first.tap()
        await expect(page.locator('[data-books]')).toHaveAttribute(
          'data-open',
          id ?? '',
        )
        expect(errors).toEqual([])
      })

    // site-stand-v7 F: the site paints the browser bars paper (html, body, theme-color); leaving the route restores them
    test('paper browser bars on the site, restored after leaving', async ({
      page,
    }) => {
      const bars = () =>
        page.evaluate(() => [
          getComputedStyle(document.documentElement).backgroundColor,
          getComputedStyle(document.body).backgroundColor,
          document
            .querySelector('meta[name="theme-color"]')
            ?.getAttribute('content') ?? null,
        ])
      // a kit page that is not the site (since personal-site K2 the site viewer is the personal site)
      const kit = page.getByTestId('index-toolbar')
      await page.goto('/uikit/#/')
      await expect(kit).toBeVisible()
      await expect(page.locator('[data-books]')).toHaveCount(0)
      const before = await bars()
      await page.evaluate(() => {
        location.hash = '#/full/personal-site?books=6'
      })
      await expect(page.getByTestId('ss9-book').first()).toBeVisible()
      const paper = 'rgb(244, 243, 240)'
      expect(await bars()).toEqual([paper, paper, paper])
      await page.evaluate(() => {
        location.hash = '#/'
      })
      await expect(kit).toBeVisible()
      await expect(page.locator('[data-books]')).toHaveCount(0)
      await expect.poll(bars).toEqual(before)
    })

    // personal-site: the site face carries Cyrillic (the latin, latin-ext and cyrillic Inter subsets)
    test('the site face renders Cyrillic', async ({ page }) => {
      await page.goto(SITE)
      await expect(page.getByTestId('ss9-book').first()).toBeVisible()
      expect(
        await page.evaluate(() =>
          document.fonts
            .load('16px "Site Inter Display"', 'Озеро')
            .then(() =>
              document.fonts.check('16px "Site Inter Display"', 'Озеро'),
            ),
        ),
      ).toBe(true)
    })

    // site-stand-v4 D18–D19: the face-out comes off the shelf without tipping; the lower flat of a stack
    // slides out from its top edge and never runs into the book above
    if (!phone)
      test('books=30: face-out hover lifts without tipping, the lower flat stays under the upper', async ({
        page,
      }) => {
        await page.goto(`${SITE}?books=30`)
        await expect(page.getByTestId('ss9-book')).toHaveCount(30)
        const z = await page
          .getByTestId('site-case')
          .evaluate((el) => Number(el.style.getPropertyValue('--z')))
        const face = page.locator('.ss9-face').first()
        const lean = face.locator('.ss9-lean')
        const r0 = await box(lean)
        await face.hover()
        // the hover lift has started (m23 > 0), then every transition on the lean has ended
        await expect
          .poll(() =>
            lean.evaluate(
              (el) => new DOMMatrix(getComputedStyle(el).transform).m23,
            ),
          )
          .toBeGreaterThan(0)
        await animationsSettled(lean)
        const r1 = await box(lean)
        expect(r0.y - r1.y).toBeGreaterThanOrEqual((8 - 1) * z)
        expect(r1.width / r0.width).toBeGreaterThanOrEqual(1.03)

        const lower = page.locator('.ss9-flat[data-under]').first()
        const upper = lower.locator(
          'xpath=../button[contains(@class,"ss9-flat") and not(@data-under)]',
        )
        await expect(upper).toHaveCount(1)
        await lower.scrollIntoViewIfNeeded()
        const u0 = await box(upper)
        await lower.hover()
        await expect(lower).toHaveAttribute('data-up', '')
        await animationsSettled(lower)
        const [l1, u1] = [await box(lower), await box(upper)]
        expect(l1.y).toBeGreaterThanOrEqual(u1.y + u1.height - 0.5)
        expect(Math.abs(u1.y - u0.y)).toBeLessThanOrEqual(0.5)
        expect(Math.abs(u1.x - u0.x)).toBeLessThanOrEqual(0.5)
      })

    // site-stand-v3 B2 / v4 D17 / v7 D30: every count is at 14 px/cm; one shelf (≤ 12 books) fits, no scroll
    if (!phone)
      for (const n of [1, 3, 6, 12, 100] as const)
        test(`books=${String(n)}: the case scales to z 1.556`, async ({
          page,
        }) => {
          await page.goto(`${SITE}?books=${String(n)}`)
          await expect(page.getByTestId('ss9-book')).toHaveCount(n)
          const cs = page.getByTestId('site-case')
          const z = await cs.evaluate((el) =>
            Number(el.style.getPropertyValue('--z')),
          )
          expect(Math.abs(z - 14 / 9)).toBeLessThanOrEqual(0.01)
          const [sh, ch] = await page
            .getByTestId('site-home')
            .evaluate((el) => [el.scrollHeight, el.clientHeight])
          expect(sh > ch).toBe(n > 12)
          await expect(page.getByTestId('ss9-caption')).toHaveCount(0)
          expect(Math.abs((await box(cs)).width - 1157.33)).toBeLessThanOrEqual(
            0.5,
          )
        })

    // site-stand-v3 B2 / D12–D14: per-shelf patterns, leans rest on their neighbour, years on the spines
    test('books=30: shelf patterns differ, every lean touches its neighbour, spines carry the year', async ({
      page,
    }) => {
      await page.goto(`${SITE}?books=30`)
      await expect(page.getByTestId('ss9-book')).toHaveCount(30)
      const bays = await page.getByTestId('site-bay').evaluateAll((els) =>
        els.map((bay) => {
          const kids = [
            ...bay.querySelectorAll<HTMLElement>('[data-testid="ss9-book"]'),
          ]
          const n = (el: HTMLElement, k: 'left' | 'width' | 'height') =>
            parseFloat(el.style[k])
          const leans = kids.flatMap((el, i) => {
            const lean = parseFloat(el.style.getPropertyValue('--lean') || '0')
            const nb = kids[lean < 0 ? i - 1 : i + 1]
            if (!lean) return []
            // a lean with nothing to rest on fails below
            if (!nb) return [{ off: Infinity, deg: 0, nb: '', z: '' }]
            const th = (Math.abs(lean) * Math.PI) / 180
            const [w, h] = [n(el, 'width'), n(el, 'height')]
            const yc =
              Math.min(n(nb, 'height'), h * Math.cos(th)) * Math.tan(th)
            const want =
              lean < 0
                ? n(nb, 'left') + n(nb, 'width') - 2 + yc
                : n(nb, 'left') + 2 - yc - w
            return [
              {
                off: Math.abs(n(el, 'left') - want),
                deg: Math.abs(lean),
                nb: nb.dataset.kind,
                z: getComputedStyle(el).zIndex,
              },
            ]
          })
          return {
            p: bay.dataset.p,
            face: kids.findIndex((el) => el.dataset.kind === 'face'),
            leans,
          }
        }),
      )
      expect(bays.length).toBeGreaterThanOrEqual(3)
      for (let i = 1; i < bays.length; i++)
        expect(bays[i]?.p).not.toBe(bays[i - 1]?.p)
      expect(new Set(bays.map((b) => b.face)).size).toBeGreaterThan(1)
      const leans = bays.flatMap((b) => b.leans)
      expect(leans.length).toBeGreaterThan(0)
      for (const l of leans) {
        expect(l.off).toBeLessThanOrEqual(0.5)
        expect(l.deg).toBeGreaterThanOrEqual(10)
        expect(l.deg).toBeLessThanOrEqual(14)
        expect(l.nb).toBe('spine')
        expect(l.z).toBe('1')
      }
      const years = await page
        .locator('.ss9-spine em, .ss9-flat em')
        .allTextContents()
      // every book but the face-outs (one per shelf)
      expect(years.length).toBe(30 - bays.length)
      for (const y of years) expect(y).toMatch(/^\d{4}$/)
    })

    test('books=30: 30 books, every one reachable by scrolling the case', async ({
      page,
    }) => {
      const errors = consoleErrors(page)
      await page.goto(`${SITE}?books=30`)
      const books = page.getByTestId('ss9-book')
      await expect(books).toHaveCount(30)
      expect(await page.getByTestId('site-bay').count()).toBeGreaterThan(2)
      const ids = await books.evaluateAll((els) =>
        els.map((e) => e.getAttribute('data-id') ?? ''),
      )
      expect(new Set(ids).size).toBe(30)
      // each book scrolled to the centre is the topmost hit at its centre
      const hits: string[] = []
      for (const id of ids)
        hits.push(
          await page
            .locator(`[data-testid="ss9-book"][data-id="${id}"]`)
            .evaluate((el) => {
              el.scrollIntoView({ block: 'center' })
              const r = el.getBoundingClientRect()
              const top = document.elementFromPoint(
                r.x + r.width / 2,
                r.y + r.height / 2,
              )
              return (
                top
                  ?.closest('[data-testid="ss9-book"]')
                  ?.getAttribute('data-id') ?? ''
              )
            }),
        )
      expect(hits).toEqual(ids)
      // the case scrolled: the last book sits below the first screen
      const scrolled = await page
        .getByTestId('site-home')
        .evaluate((el) => el.scrollTop)
      expect(scrolled).toBeGreaterThan(0)
      expect(errors).toEqual([])
    })

    test('books=6: the case, a spine and the face-out book paint', async ({
      page,
    }) => {
      const errors = consoleErrors(page)
      await page.goto(`${SITE}?books=6`)
      const bay = page.getByTestId('site-bay').first()
      const spine = bay.locator('[data-kind="spine"]').first()
      const face = bay.locator('[data-kind="face"]')
      // the GL book has drawn into its canvas
      await expect(face.getByTestId('book3d-gl')).toBeVisible()
      const book = face.getByTestId('book3d')
      await expect(book).toHaveAttribute('data-gl', 'ready')
      await expect(book).not.toHaveAttribute('data-pose', 'moving')
      await animationsSettled(bay)
      const [b, sp, fb] = [await box(bay), await box(spine), await box(face)]
      // the case scale: frame lengths (AO, plinth bands) grow with it
      const z = await page
        .getByTestId('site-case')
        .evaluate((el) => Number(el.style.getPropertyValue('--z')))
      const ink = await spine.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      )
      const spineRgb = ink.match(/\d+/g)?.map(Number) ?? []
      const grid = [0.3, 0.5, 0.7].flatMap((u) =>
        [0.3, 0.5, 0.7].map((v) => ({
          x: fb.x - b.x + fb.width * u,
          y: fb.y - b.y + fb.height * v,
        })),
      )
      const px = await pixelsAt(bay, [
        // the back wall above the spine, under the top shadow
        { x: sp.x - b.x + sp.width / 2, y: Math.ceil(32 * z) },
        // the spine's head: mid-width (no shading), above the title (10 %)
        { x: sp.x - b.x + sp.width * 0.5, y: sp.y - b.y + sp.height * 0.05 },
        ...grid,
      ])
      const wall = rgbDiff(px[0] ?? [], hex('#cec6b7'))
      const spineD = rgbDiff(px[1] ?? [], spineRgb)
      const faceD = Math.max(
        ...px.slice(2).map((c) => rgbDiff(c, hex('#cec6b7'))),
      )
      const plinth = page.locator('.ss9-plinth')
      const pb = await box(plinth)
      const pp = await pixelsAt(plinth, [
        { x: pb.width / 2, y: Math.round(10 * z) },
        { x: pb.width / 2, y: Math.round(33 * z) },
      ])
      const front = rgbDiff(pp[0] ?? [], hex('#e4ded3'))
      const foot = rgbDiff(pp[1] ?? [], hex('#d3ccbf'))
      test.info().annotations.push({
        type: 'paint',
        description: JSON.stringify({
          vp: vp.viewport.width,
          wall,
          spine: spineD,
          face: faceD,
          front,
          foot,
        }),
      })
      expect(wall).toBeLessThanOrEqual(8)
      expect(spineD).toBeLessThanOrEqual(40)
      expect(faceD).toBeGreaterThan(20)
      expect(front).toBeLessThanOrEqual(3)
      expect(foot).toBeLessThanOrEqual(3)
      expect(errors).toEqual([])
    })
  })

// design-r24-site-kit M108 (spec D41 / D42, prod site-final): a book loaded
// straight from its URL opens on the Cover and rests there (no cover turn).
for (const vp of VIEWPORTS)
  test.describe(`${vp.name}: direct book link`, () => {
    test.use({
      viewport: vp.viewport,
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
    })

    test('opens on the Cover and stays there', async ({ page }) => {
      const errors = consoleErrors(page)
      await page.goto(`${SITE}?book=lake-trip`)
      const room = page.getByTestId('ss-reader-page')
      const label = room.getByTestId('site-label')
      await expect(label).toHaveText('Cover')
      // past the fade + cover delay (360 ms) nothing turns the cover
      await page.evaluate(() => new Promise((r) => setTimeout(r, 800)))
      await expect(label).toHaveText('Cover')
      // the label is the topmost paint at its centre
      expect((await topAt(label))[0]).toContain('site-label')
      expect(errors).toEqual([])
    })
  })

test('a kit page state naming a page still opens that page (site-preview-mode Spread 2)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/uikit/#/feature/site-preview-mode')
  await page
    .getByTestId('scenarios')
    .getByRole('tab', { name: 'Spread 2', exact: true })
    .click()
  const room = page.getByTestId('site-room')
  await expect(room).toHaveAttribute('data-view', '3')
  await expect(page.getByTestId('site-label')).not.toHaveText('Cover')
})
