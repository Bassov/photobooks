import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'

// site-stand (DEMO branch): the kit site stand holds demo 6 and demo 7 (fresh C
// left it, site-stand-v2 D9). Two states (D3): home and the open book; a click
// opens the reading room, `&book=<id>` is pushed, Back / Esc / "All books"
// close it and focus returns to the book.

const SLUGS = ['site-demo-6', 'site-demo-7'] as const
const BOOK = { 'site-demo-6': 'ss6-book', 'site-demo-7': 'ss7-book' } as const

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

test('the site-demos entry lists exactly the stand demos', async ({ page }) => {
  await page.goto('/uikit/#/full/site-demos')
  const links = page.getByTestId('site-demo-link')
  await expect(links).toHaveText([...SLUGS])
  await expect(links.first()).toHaveAttribute('href', '#/full/site-demo-6')
})

// Spec site-stand S2–S4: the open book shows its thickness (side edges from the
// read fraction, tail strip, gutter), every page is photo paper, interior
// leaves curl (paper leaf), perspective 2 × the reader width.

/** opens the first book's reader on view 1 (endpaper | title page) */
async function openReader(page: Page, slug: keyof typeof BOOK) {
  await page.goto(`/uikit/#/full/${slug}`)
  // the click opens the room at the cover, which turns to view 1 at once
  await page.getByTestId(BOOK[slug]).first().click()
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

// Spec site-stand-v2 S: the open flow, Play, the header, the counts. The room
// steps through every view of Lake trip and Coast with each photo page
// painted (the 21:xx stand capture had a blank right page).

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

test.describe('desktop 1440×900: Play and the year rows', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('sd-play turns the page after 4000 + 820 ms; a key press pauses it', async ({
    page,
  }) => {
    const errors = consoleErrors(page)
    await page.clock.install()
    await page.goto('/uikit/#/full/site-demo-7?books=6&book=lake-trip')
    const reader = page.getByTestId('ps-reader')
    await page.clock.runFor(500)
    await expect(reader).toHaveAttribute('data-view', '1')
    const play = page.getByTestId('sd-play')
    await expect(play).toHaveText('Play')
    await play.click()
    await expect(play).toHaveAttribute('aria-pressed', 'true')
    await expect(play).toHaveText('Pause')
    // the 1 px progress line under the label
    const line = await box(page.getByTestId('sd-progress'))
    expect(line.height).toBe(1)
    await page.clock.runFor(3900)
    await expect(reader).toHaveAttribute('data-view', '1')
    await page.clock.runFor(100 + 820 + 50)
    await expect(reader).toHaveAttribute('data-view', '2')
    await expect(reader.getByTestId('ps-leaf')).toHaveCount(0)
    // still playing: a key press pauses it
    await expect(play).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Shift')
    await expect(play).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByTestId('sd-progress')).toHaveCount(0)
    await page.clock.runFor(4000 + 820 + 200)
    await expect(reader).toHaveAttribute('data-view', '2')
    expect(errors).toEqual([])
  })

  test('demo 7: year rows past 12 books over more than 2 years, none at 12', async ({
    page,
  }) => {
    await page.goto('/uikit/#/full/site-demo-7?books=30')
    const years = page.getByTestId('ss7-year')
    const ys = await years.allTextContents()
    expect(ys.length).toBeGreaterThan(2)
    expect(ys).toEqual([...ys].sort().reverse())
    // a year row is 40 high with a top hairline, numbering continues past it
    const y = await box(years.nth(1))
    expect(y.height).toBe(40)
    await expect(
      page.getByTestId('ss7-book').last().locator('.t13').first(),
    ).toHaveText('30')
    await page.goto('/uikit/#/full/site-demo-7?books=12')
    await expect(years).toHaveCount(0)
  })
})

for (const vp of VIEWPORTS)
  test.describe(`${vp.name}: two states`, () => {
    test.use({
      viewport: vp.viewport,
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
    })
    const phone = vp.viewport.width < 768

    for (const slug of SLUGS)
      test(`${slug}: a click opens the room with book= in the URL; Back, Esc and All books close it, focus returns`, async ({
        page,
      }) => {
        const errors = consoleErrors(page)
        await page.goto(`/uikit/#/full/${slug}`)
        const room = page.getByTestId('ss-reader-page')
        const all = page.getByTestId('ss-all')
        // home: no About / Contact / Books nav, no All books, no Menu
        await expect(
          page.getByRole('button', { name: /^(About|Contact|Books|Menu)$/ }),
        ).toHaveCount(0)
        await expect(
          page.getByRole('link', { name: /^(About|Contact)$/ }),
        ).toHaveCount(0)
        await expect(all).toHaveCount(0)

        const book = page
          .getByTestId(BOOK[slug])
          .locator('visible=true')
          .first()
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
          // the cover turns at once: the room rests on view 1
          await expect(room.getByTestId('ss-reader')).toHaveAttribute(
            'data-view',
            '1',
          )
          await expect(all).toBeVisible()
          await shut()
          await expect(room).toHaveCount(0)
          expect(page.url()).not.toContain('book=')
          await expect(book).toBeFocused()
          await expect(all).toHaveCount(0)
        }
        expect(errors).toEqual([])
      })

    test('a deep link opens at view 1; the name closes it and focus lands on the book', async ({
      page,
    }) => {
      await page.goto('/uikit/#/full/site-demo-7?books=6&book=coast')
      const room = page.getByTestId('ss-reader-page')
      await expect(room.getByTestId('ss-reader')).toHaveAttribute(
        'data-view',
        '1',
      )
      await page.locator('.ss-head > button').click()
      await expect(room).toHaveCount(0)
      expect(page.url()).not.toContain('book=')
      await expect(
        page
          .locator('[data-testid="ss7-book"][data-id="coast"]')
          .locator('visible=true'),
      ).toBeFocused()
    })

    for (const slug of SLUGS)
      for (const n of [1, 6, 30])
        test(`${slug} books=${String(n)}: ${String(n)} books, no horizontal page scroll`, async ({
          page,
        }) => {
          const errors = consoleErrors(page)
          await page.goto(`/uikit/#/full/${slug}?books=${String(n)}`)
          await expect(page.getByTestId('ss-switch').locator('a')).toHaveText([
            '1',
            '3',
            '6',
            '12',
            '30',
            '100',
          ])
          const root = page.locator('[data-books]')
          await expect(root).toHaveAttribute('data-books', String(n))
          const ids = await page
            .getByTestId(BOOK[slug])
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

    test('books=30: a placeholder past 12 opens and paints', async ({
      page,
    }) => {
      const errors = consoleErrors(page)
      await page.goto('/uikit/#/full/site-demo-7?books=30')
      await page
        .locator('[data-testid="ss7-book"][data-id="book-20"]')
        .locator('visible=true')
        .click()
      const room = page.getByTestId('ss-reader-page')
      await expect(room.getByTestId('ss-reader')).toHaveAttribute(
        'data-view',
        '1',
      )
      await room.getByTestId('ss-next').click()
      const reader = room.getByTestId('ps-reader')
      await expect(reader.getByTestId('ps-leaf')).toHaveCount(0)
      const centres = await pageCentres(
        reader,
        phone ? room.getByTestId('ps-pager') : reader,
      )
      expect(centres.length).toBeGreaterThan(0)
      expect(centres.filter(white)).toEqual([])
      expect(errors).toEqual([])
    })

    for (const id of ['lake-trip', 'coast'])
      test(`paint: every view of ${id} shows its photo pages`, async ({
        page,
      }) => {
        const errors = consoleErrors(page)
        await page.goto(`/uikit/#/full/site-demo-7?books=6&book=${id}`)
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

// site-stand-v2 W / D7: the demo 6 wall has no bottom titles list or "1 / 6";
// edge fades and a floor scrubber show the position; a row that fits is
// centred in columns 4–11 with neither.

const rgbDiff = (a: number[], b: number[]) =>
  Math.max(...[0, 1, 2].map((i) => Math.abs((a[i] ?? 0) - (b[i] ?? 0))))

test.describe('desktop 1440×900: demo 6 wall', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('books=6: no bottom nav; the scrubber drags, glides, keys and paints; fades follow', async ({
    page,
  }) => {
    const errors = consoleErrors(page)
    await page.goto('/uikit/#/full/site-demo-6?books=6')
    const wall = page.getByTestId('ss6-wall')
    await expect(wall.getByTestId('ss6-book')).toHaveCount(6)
    await expect(page.getByText(/^\s*\d+ \/ \d+\s*$/)).toHaveCount(0)
    await expect(page.getByTestId('ss6-count')).toHaveCount(0)
    const scrub = page.getByRole('scrollbar', { name: 'Books' })
    const thumb = scrub.getByTestId('ss6-thumb')
    const label = scrub.getByTestId('ss6-scrub-label')
    const fadeL = page.getByTestId('ss6-fade-l')
    const fadeR = page.getByTestId('ss6-fade-r')
    await expect(scrub).toHaveAttribute('aria-valuenow', '0')
    // from column 4 (x 493.3 at 1440), 96 px apart
    const e0 = await box(page.locator('.ss6-ex').nth(0))
    const e1 = await box(page.locator('.ss6-ex').nth(1))
    expect(e0.x).toBeCloseTo(24 + 4 * ((1440 - 48 - 11 * 16) / 12 + 16), 0)
    expect(e1.x - (e0.x + e0.width)).toBeCloseTo(96, 0)
    await expect(fadeR).toHaveCSS('opacity', '1')
    await expect(fadeL).toHaveCSS('opacity', '0')

    // geometry: track M..W−M, bottom 40; thumb ≥ 24 px
    const sb = await box(scrub)
    expect(sb.x).toBe(24)
    expect(sb.width).toBe(1440 - 48)
    expect(900 - (sb.y + sb.height / 2)).toBeCloseTo(41, 0)
    const tb = await box(thumb)
    expect(tb.width).toBeGreaterThanOrEqual(24)
    expect(tb.width).toBeLessThan(sb.width)

    // paint: thumb brighter than the rail, the rail brighter than the wall
    const [onThumb = [], onRail = [], wallBg = []] = await pixelsAt(scrub, [
      { x: tb.width / 2, y: 12 },
      { x: sb.width - 4, y: 12 },
      { x: sb.width / 2, y: 2 },
    ])
    const paint = {
      thumb: rgbDiff(onThumb, wallBg),
      rail: rgbDiff(onRail, wallBg),
    }
    test.info().annotations.push({
      type: 'paint',
      description: JSON.stringify({ vp: 1440, ...paint }),
    })
    expect(paint.thumb).toBeGreaterThan(paint.rail + 40)
    expect(paint.rail).toBeGreaterThan(10)

    // hover: a 4 px track, the label names the book nearest the centre
    const first = (
      (await wall.getByTestId('ss6-book').first().getAttribute('aria-label')) ??
      ''
    ).split(',')[0]
    await page.mouse.move(sb.x + tb.width / 2, sb.y + 12)
    await expect(thumb).toHaveCSS('height', '4px')
    await expect(label).toHaveCSS('opacity', '1')
    await expect(label).toHaveText(first ?? '')

    // drag: 1:1 by the content / track ratio
    await page.mouse.down()
    await page.mouse.move(sb.x + tb.width / 2 + 200, sb.y + 12, { steps: 5 })
    await page.mouse.up()
    expect((await box(thumb)).x - tb.x).toBeCloseTo(200, 0)
    await expect(fadeL).toHaveCSS('opacity', '1')
    await expect(label).not.toHaveText(first ?? '')

    // a track click glides to the end; Home goes back, ← / → step a book
    await page.mouse.click(sb.x + sb.width - 4, sb.y + 12)
    await expect(scrub).toHaveAttribute('aria-valuenow', '100')
    await expect(fadeR).toHaveCSS('opacity', '0')
    await scrub.focus()
    await page.keyboard.press('Home')
    await expect(scrub).toHaveAttribute('aria-valuenow', '0')
    await page.keyboard.press('ArrowRight')
    await expect(scrub).not.toHaveAttribute('aria-valuenow', '0')
    await page.keyboard.press('End')
    await expect(scrub).toHaveAttribute('aria-valuenow', '100')

    const sw = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      innerWidth,
    ])
    expect(sw[0]).toBe(sw[1])
    expect(errors).toEqual([])
  })

  test('books=1: 14 px/cm, centred in columns 4–11, no scrubber or fades', async ({
    page,
  }) => {
    const errors = consoleErrors(page)
    await page.goto('/uikit/#/full/site-demo-6?books=1')
    const ex = page.locator('.ss6-ex')
    await expect(ex).toHaveCount(1)
    await expect(page.getByTestId('ss6-scrub')).toHaveCount(0)
    await expect(page.getByTestId('ss6-fade-r')).toHaveCount(0)
    const b = await box(ex)
    // the first book is 24 cm wide
    expect(b.width).toBeCloseTo(24 * 14, 0)
    // cols 4–11 at 1440: x(4) = 24 + 4·(cw + 16), span(8) = 8·cw + 7·16
    const cw = (1440 - 48 - 11 * 16) / 12
    const mid = 24 + 4 * (cw + 16) + (8 * cw + 7 * 16) / 2
    expect(b.x + b.width / 2).toBeCloseTo(mid, 0)
    expect(errors).toEqual([])
  })
})

test.describe('phone 390×844: demo 6', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })

  test('books=6: one book per screen, no scrubber, no bottom strip; the book paints', async ({
    page,
  }) => {
    const errors = consoleErrors(page)
    await page.goto('/uikit/#/full/site-demo-6?books=6')
    const screen = page.locator('.ss6-screen').first()
    await expect(page.locator('.ss6-screen')).toHaveCount(6)
    await expect(page.getByTestId('ss6-scrub')).toHaveCount(0)
    await expect(page.getByText(/^\s*\d+ \/ \d+\s*$/)).toHaveCount(0)
    const sb = await box(screen)
    const bb = await box(screen.getByTestId('ss6-book'))
    // the bottom 40 px of the screen is bare wall; the book is not
    // (left half: the count switch sits bottom right)
    const xs = [16, 40, 70, 100, 130, 160]
    const grid = [0.25, 0.5, 0.75].flatMap((u) =>
      [0.25, 0.5, 0.75].map((v) => ({
        x: bb.x - sb.x + bb.width * u,
        y: bb.y - sb.y + bb.height * v,
      })),
    )
    const px = await pixelsAt(screen, [
      { x: 4, y: sb.height - 4 },
      ...xs.map((x) => ({ x, y: sb.height - 24 })),
      ...grid,
    ])
    const bg = px[0] ?? []
    const diffs = px.slice(1).map((c) => rgbDiff(c, bg))
    const strip = Math.max(...diffs.slice(0, xs.length))
    const book = Math.max(...diffs.slice(xs.length))
    test.info().annotations.push({
      type: 'paint',
      description: JSON.stringify({ vp: 390, strip, book }),
    })
    expect(strip).toBeLessThanOrEqual(2)
    expect(book).toBeGreaterThan(20)
    const sw = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      innerWidth,
    ])
    expect(sw[0]).toBe(sw[1])
    expect(errors).toEqual([])
  })
})
