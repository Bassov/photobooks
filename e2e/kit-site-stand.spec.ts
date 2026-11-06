import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'

// site-stand (DEMO branch): the kit site stand holds demos 6 and 9 (fresh C
// left it, site-stand-v2 D9). Two states (D3): home and the open book; a click
// opens the reading room, `&book=<id>` is pushed, Back / Esc / "All books"
// close it and focus returns to the book.

const SLUGS = ['site-demo-6', 'site-demo-9'] as const
const BOOK = {
  'site-demo-6': 'ss6-book',
  'site-demo-9': 'ss9-book',
} as const

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

/** opens the first book's CSS reader (`?gl=0`) on view 1 (endpaper | title page) */
async function openReader(page: Page, slug: keyof typeof BOOK) {
  await page.goto(`/uikit/#/full/${slug}?gl=0`)
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
async function pageCentres(
  reader: Locator,
  clip: Locator = reader,
  testId?: string,
) {
  const pts = await reader.evaluate(
    (el, [cl, id]) => {
      // the single-page camera (`clip`) shows only the pages inside it
      const o = (cl as Element).getBoundingClientRect()
      const sel = id ? `[data-testid="${id}"]` : '.sd-pg'
      return [...el.querySelectorAll(sel)].flatMap((pg) => {
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
    },
    [await clip.elementHandle(), testId ?? ''] as const,
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

/** the phone portrait slide at rest (its paper at x 16): label + photo centre RGB */
async function slideAtRest(room: Locator) {
  const label = (await room.getByTestId('ss-label').textContent()) ?? ''
  const slide = room.locator(`[data-testid="ps-slide"][aria-label="${label}"]`)
  const paper = slide.getByTestId('ps-paper')
  await expect.poll(async () => Math.round((await box(paper)).x)).toBe(16)
  return { label, centres: await pageCentres(slide, slide, 'ps-paper') }
}

/** Next through the room to the back cover (phone portrait: the last slide);
   at each rest the RGB at the centre of every visible photo page */
async function walkRoom(room: Locator) {
  const reader = room.getByTestId('ps-reader')
  const next = room.getByTestId('ss-next')
  const seen: { label: string; centres: number[][] }[] = []
  // a phone portrait reads one page per slide (site-stand-v5 D23)
  if ((await room.getAttribute('data-mode')) === 'port')
    for (;;) {
      const s = await slideAtRest(room)
      seen.push(s)
      if (await next.isDisabled()) return seen
      await next.click()
      await expect(room.getByTestId('ss-label')).not.toHaveText(s.label)
    }
  // the room opens on view 1
  for (let k = 1; ; k++) {
    // at rest: the reader on view k
    await expect(reader).toHaveAttribute('data-view', String(k))
    await expect(reader.getByTestId('ps-leaf')).toHaveCount(0)
    seen.push({
      label: (await room.getByTestId('ss-label').textContent()) ?? '',
      centres: await pageCentres(reader),
    })
    if (await next.isDisabled()) return seen
    await next.click()
  }
}

/** a room just opened by a click rests on view 1; a phone portrait on the cover slide (site-stand-v5 D23) */
async function expectOpened(room: Locator, phone: boolean) {
  if (phone) await expect(room.getByTestId('ss-label')).toHaveText('Cover')
  else
    await expect(room.getByTestId('ss-reader')).toHaveAttribute(
      'data-view',
      '1',
    )
}

/** a deep link rests on page 1; it closes by the site name, on a phone by the room's back button (no site head, D24) */
async function deepLinkCloser(page: Page, phone: boolean) {
  const room = page.getByTestId('ss-reader-page')
  if (!phone) {
    await expect(room.getByTestId('ss-reader')).toHaveAttribute(
      'data-view',
      '1',
    )
    return page.locator('.ss-head > button')
  }
  await expect(room.getByTestId('ss-label')).toHaveText(/^Page 1 of/)
  await expect(page.locator('.ss-head')).toHaveCount(0)
  return room.getByTestId('ss-all')
}

/** Next to the first interior view (a phone: Cover → page 1 → the first interior slide); its photo centre RGBs */
async function firstSpreadCentres(room: Locator, phone: boolean) {
  const next = room.getByTestId('ss-next')
  await next.click()
  if (!phone) {
    const reader = room.getByTestId('ps-reader')
    await expect(reader.getByTestId('ps-leaf')).toHaveCount(0)
    return pageCentres(reader)
  }
  await expect(room.getByTestId('ss-label')).toHaveText(/^Page 1 of/)
  await next.click()
  await expect(room.getByTestId('ss-label')).not.toHaveText(/^Page 1 of/)
  return (await slideAtRest(room)).centres
}

/** [views walked from page 1, last label]: a phone reads slides with no back cover (D23) */
const walkEnd = (id: string, phone: boolean) => {
  if (!phone) return [expect.any(Number), 'Back cover']
  return id === 'lake-trip' ? [15, 'Page 20 of 22'] : [9, 'Page 12 of 14']
}

function consoleErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return errors
}

test.describe('desktop 1440×900: Play', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('sd-play turns the page after 4000 + 820 ms; a key press pauses it', async ({
    page,
  }) => {
    const errors = consoleErrors(page)
    await page.clock.install()
    // the CSS reader (`gl=0`): runFor fires every frame back to back, a GL frame each makes the lane time out under load
    await page.goto('/uikit/#/full/site-demo-6?books=6&book=lake-trip&gl=0')
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
})

for (const vp of VIEWPORTS)
  test.describe(`${vp.name}: two states`, () => {
    test.use({
      viewport: vp.viewport,
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
    })

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

    test('a deep link opens at view 1; the name closes it and focus lands on the book', async ({
      page,
    }) => {
      await page.goto('/uikit/#/full/site-demo-6?books=6&book=coast')
      const room = page.getByTestId('ss-reader-page')
      await (await deepLinkCloser(page, vp.isMobile)).click()
      await expect(room).toHaveCount(0)
      expect(page.url()).not.toContain('book=')
      await expect(
        page
          .locator('[data-testid="ss6-book"][data-id="coast"]')
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
      // the CSS reader (`gl=0`): page centres are read off its page boxes
      await page.goto('/uikit/#/full/site-demo-6?books=30&gl=0')
      await page
        .locator('[data-testid="ss6-book"][data-id="book-20"]')
        .locator('visible=true')
        .click()
      const room = page.getByTestId('ss-reader-page')
      await expectOpened(room, vp.isMobile)
      const centres = await firstSpreadCentres(room, vp.isMobile)
      expect(centres.length).toBeGreaterThan(0)
      expect(centres.filter(white)).toEqual([])
      expect(errors).toEqual([])
    })

    for (const id of ['lake-trip', 'coast'])
      test(`paint: every view of ${id} shows its photo pages`, async ({
        page,
      }) => {
        const errors = consoleErrors(page)
        await page.goto(`/uikit/#/full/site-demo-6?books=6&book=${id}&gl=0`)
        const seen = await walkRoom(page.getByTestId('ss-reader-page'))
        expect([seen.length, seen.at(-1)?.label]).toEqual(
          walkEnd(id, vp.isMobile),
        )
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

  test('books=6 (D22): tap the book to open, the floor under the book, the group centred', async ({
    page,
  }) => {
    const errors = consoleErrors(page)
    await page.goto('/uikit/#/full/site-demo-6?books=6')
    const screen = page.locator('.ss6-screen').first()
    const book = screen.getByTestId('ss6-book')
    await expect(book).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Open the book' }),
    ).toHaveCount(0)
    await expect(book).toHaveAttribute('aria-label', /^Lake trip, /)
    const bb = await box(book)
    const floor = await box(screen.locator('.ss6-floor'))
    const lead = await box(screen.locator('.m19'))
    const cap = await box(screen.locator('.t13.g').first())
    const sw = await box(page.getByTestId('ss-switch'))
    // D22 numbers (Spec H, 390 × 844): s 10.74, F 594, caption 643
    expect(floor.y).toBeCloseTo(594, 0)
    expect(cap.y).toBeCloseTo(643, 0)
    expect(bb.x).toBeCloseTo(66.1, 0)
    // seat() centres the contact shadow on F, so the top lands ~1 px below the Spec's 271.8
    expect(Math.abs(bb.y - 271.8)).toBeLessThanOrEqual(1.5)
    expect(bb.width).toBeCloseTo(257.8, 0)
    expect(bb.height).toBeCloseTo(322.2, 0)
    // paint: the floor line is drawn under the book, not across it
    const hit = await page.evaluate(
      ([x, y]) =>
        !!document.elementFromPoint(x, y)?.closest('[data-testid="ss6-book"]'),
      [bb.x + 10, floor.y] as const,
    )
    expect(hit).toBe(true)
    const top = bb.y - (lead.y + lead.height)
    const bottom = sw.y - (cap.y + cap.height)
    test.info().annotations.push({
      type: 'paint',
      description: JSON.stringify({ F: floor.y, cap: cap.y, top, bottom }),
    })
    expect(Math.abs(top - bottom)).toBeLessThanOrEqual(2)
    await book.click()
    await expect(page.getByTestId('ss6')).toHaveAttribute('data-open', /.+/)
    expect(errors).toEqual([])
  })

  test('D22: one scale and floor per screen size and book count', async ({
    page,
  }) => {
    const errors = consoleErrors(page)
    // [viewport, books, s (px/cm, Lake trip is 24 cm wide), F, caption top]
    const cases = [
      [{ width: 375, height: 667 }, '6', 10.29, 499, 547],
      // capOff = ceil(0.09 · 24 · 12) + 20 = 46
      [{ width: 390, height: 844 }, '1', 12, 614, 660],
    ] as const
    const screen = page.locator('.ss6-screen').first()
    // the second goto only changes the hash: the home re-lays out once its
    // ResizeObserver sees the new viewport, so poll instead of reading once
    const settled = async (s: number, F: number, cap: number) => {
      await expect
        .poll(
          async () => (await box(screen.getByTestId('ss6-book'))).width / 24,
        )
        .toBeCloseTo(s, 1)
      await expect
        .poll(async () => (await box(screen.locator('.ss6-floor'))).y)
        .toBeCloseTo(F, 0)
      await expect
        .poll(async () => (await box(screen.locator('.t13.g').first())).y)
        .toBeCloseTo(cap, 0)
    }
    for (const [vp, n, s, F, cap] of cases) {
      await page.setViewportSize(vp)
      await page.goto(`/uikit/#/full/site-demo-6?books=${n}`)
      await settled(s, F, cap)
    }
    // the same numbers after a fresh load of the last case
    await page.reload()
    const [, , s, F, cap] = cases[1]
    await settled(s, F, cap)
    expect(errors).toEqual([])
  })
})

// site-stand-v2 B / D8: the demo 9 case grows with the books: one shelf at 6,
// more at 12, as many as 30 books need; the page scrolls down to every book.

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

for (const vp of VIEWPORTS)
  test.describe(`${vp.name}: demo 9 bookcase`, () => {
    test.use({
      viewport: vp.viewport,
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
    })
    const phone = vp.viewport.width < 768

    if (!phone)
      test('books=6 → one shelf, books=12 → two or more', async ({ page }) => {
        const bays = page.getByTestId('ss9-bay')
        await page.goto('/uikit/#/full/site-demo-9?books=6')
        await expect(page.getByTestId('ss9-book')).toHaveCount(6)
        await expect(bays).toHaveCount(1)
        // 6 books: one face-out, five spines
        await expect(bays.locator('[data-kind="face"]')).toHaveCount(1)
        await page.goto('/uikit/#/full/site-demo-9?books=12')
        await expect(page.getByTestId('ss9-book')).toHaveCount(12)
        expect(await bays.count()).toBeGreaterThanOrEqual(2)
        // every shelf starts with a face-out book
        expect(await bays.locator('[data-kind="face"]').count()).toBe(
          await bays.count(),
        )
        // site-stand-v4 D17: no side column or caption; the lead 104 from the top on the case's left edge,
        // the case 40 below it, centred in the scroller, at most span 8 (891.33 at 1440) / 1100 wide
        await expect(page.getByTestId('ss9-caption')).toHaveCount(0)
        const c = await box(page.getByTestId('ss9-case'))
        const lead = await box(page.getByTestId('ss9-lead'))
        expect(Math.abs(lead.y - 104)).toBeLessThanOrEqual(0.5)
        expect(Math.abs(lead.x - c.x)).toBeLessThanOrEqual(0.5)
        expect(Math.abs(c.y - (lead.y + lead.height + 40))).toBeLessThanOrEqual(
          0.5,
        )
        const cw = await page
          .getByTestId('ss9-home')
          .evaluate((el) => el.clientWidth)
        expect(Math.abs(c.x + c.width / 2 - cw / 2)).toBeLessThanOrEqual(0.5)
        expect(c.width).toBeLessThanOrEqual(Math.min(891.33, 1100) + 0.5)
      })

    // site-stand-v4 D17: Z = clamp(h/900 · 4/3, 1, 14/9) floors the scale, rows packed for min(span 8, 1100)/Z
    if (!phone)
      for (const [n, w, h, z, width] of [
        [30, 1440, 900, 4 / 3, [890.7, 892.7]],
        [100, 2000, 1011, 1.498, [0, 1100.5]],
      ] as const)
        test(`books=${String(n)} at ${String(w)}×${String(h)}: z ${z.toFixed(3)}, case within span 8 / 1100`, async ({
          page,
        }) => {
          await page.setViewportSize({ width: w, height: h })
          await page.goto(`/uikit/#/full/site-demo-9?books=${String(n)}`)
          await expect(page.getByTestId('ss9-book')).toHaveCount(n)
          const cs = page.getByTestId('ss9-case')
          const zz = await cs.evaluate((el) =>
            Number(el.style.getPropertyValue('--z')),
          )
          expect(Math.abs(zz - z)).toBeLessThanOrEqual(0.01)
          const c = await box(cs)
          // [min, max] case width
          expect(c.width).toBeGreaterThanOrEqual(width[0])
          expect(c.width).toBeLessThanOrEqual(width[1])
        })

    // site-stand-v4 D18–D19: the face-out comes off the shelf without tipping; the lower flat of a stack
    // slides out from its top edge and never runs into the book above
    if (!phone)
      test('books=30: face-out hover lifts without tipping, the lower flat stays under the upper', async ({
        page,
      }) => {
        await page.goto('/uikit/#/full/site-demo-9?books=30')
        await expect(page.getByTestId('ss9-book')).toHaveCount(30)
        const z = await page
          .getByTestId('ss9-case')
          .evaluate((el) => Number(el.style.getPropertyValue('--z')))
        const face = page.locator('.ss9-face').first()
        const lean = face.locator('.ss9-lean')
        const r0 = await box(lean)
        await face.hover()
        await page.waitForTimeout(450)
        const m23 = await lean.evaluate(
          (el) => new DOMMatrix(getComputedStyle(el).transform).m23,
        )
        expect(m23).toBeGreaterThan(0)
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
        await page.waitForTimeout(450)
        await expect(lower).toHaveAttribute('data-up', '')
        const [l1, u1] = [await box(lower), await box(upper)]
        expect(l1.y).toBeGreaterThanOrEqual(u1.y + u1.height - 0.5)
        expect(Math.abs(u1.y - u0.y)).toBeLessThanOrEqual(0.5)
        expect(Math.abs(u1.x - u0.x)).toBeLessThanOrEqual(0.5)
      })

    // site-stand-v3 B2 / v4 D17: a short case scales up to 14 px/cm under the lead, no scroll
    if (!phone)
      for (const n of [1, 3, 6] as const)
        test(`books=${String(n)}: the case scales to z 1.556, no scroll`, async ({
          page,
        }) => {
          await page.goto(`/uikit/#/full/site-demo-9?books=${String(n)}`)
          await expect(page.getByTestId('ss9-book')).toHaveCount(n)
          const cs = page.getByTestId('ss9-case')
          const z = await cs.evaluate((el) =>
            Number(el.style.getPropertyValue('--z')),
          )
          expect(Math.abs(z - 14 / 9)).toBeLessThanOrEqual(0.01)
          const [sh, ch] = await page
            .getByTestId('ss9-home')
            .evaluate((el) => [el.scrollHeight, el.clientHeight])
          expect(sh).toBe(ch)
          await expect(page.getByTestId('ss9-caption')).toHaveCount(0)
        })

    // site-stand-v3 B2 / D12–D14: per-shelf patterns, leans rest on their neighbour, years on the spines
    test('books=30: shelf patterns differ, every lean touches its neighbour, spines carry the year', async ({
      page,
    }) => {
      await page.goto('/uikit/#/full/site-demo-9?books=30')
      await expect(page.getByTestId('ss9-book')).toHaveCount(30)
      const bays = await page.getByTestId('ss9-bay').evaluateAll((els) =>
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
      await page.goto('/uikit/#/full/site-demo-9?books=30')
      const books = page.getByTestId('ss9-book')
      await expect(books).toHaveCount(30)
      expect(await page.getByTestId('ss9-bay').count()).toBeGreaterThan(2)
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
        .getByTestId('ss9-home')
        .evaluate((el) => el.scrollTop)
      expect(scrolled).toBeGreaterThan(0)
      expect(errors).toEqual([])
    })

    test('books=6: the case, a spine and the face-out book paint', async ({
      page,
    }) => {
      const errors = consoleErrors(page)
      await page.goto('/uikit/#/full/site-demo-9?books=6')
      const bay = page.getByTestId('ss9-bay').first()
      const spine = bay.locator('[data-kind="spine"]').first()
      const face = bay.locator('[data-kind="face"]')
      // the GL book has drawn into its canvas
      await expect(face.getByTestId('book3d-gl')).toBeVisible()
      await page.waitForTimeout(500)
      const [b, sp, fb] = [await box(bay), await box(spine), await box(face)]
      // the case scale: frame lengths (AO, plinth bands) grow with it
      const z = await page
        .getByTestId('ss9-case')
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
