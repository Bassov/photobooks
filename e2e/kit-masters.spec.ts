import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit masters and page numbers (moved from uikit/scripts/qa.mjs v7 / v0.7.3 /
// v0.7.4 / v0.9 / kit10, uikit-qa-split-3): the Pages/Masters toggle, Master
// A/B/None on the canvas, the Masters inspector fields, the Row gap field, and
// in #/demo master guides + Page numbers feeding the spreads (page-numbers-kit
// folio geometry, Book settings Start at / Format / Skip first). Smoke ports
// also fail on a console error / warning, page error or failed request, like
// the qa.mjs smoke() helpers.

test.use({ viewport: { width: 1440, height: 900 } })

const demo = '[data-testid="demo"]'
const D = (page: Page, s: string) => page.locator(`${demo} ${s}`)
const E = (page: Page, s: string) => D(page, `[data-testid="editor7"] ${s}`)
const items = (page: Page) =>
  E(page, '[data-testid="panel-l"] [role=row]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-item')),
  )
const near = (a: number, b: number) => Math.abs(a - b) <= 0.5

interface DemoApi {
  reset: () => void
  state: () => { books: { book: { w: number; h: number; safe: number } }[] }
}

function watchErrors(page: Page) {
  const errs: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning')
      errs.push(`${m.type()}: ${m.text().slice(0, 240)}`)
  })
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`))
  page.on('requestfailed', (r) => errs.push(`requestfailed: ${r.url()}`))
  return errs
}

/** no finite animation still running after the next two frames (enter transitions done; spinners loop forever) */
async function settled(page: Page) {
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  )
  await expect
    .poll(() =>
      page.evaluate(() =>
        document
          .getAnimations()
          .every(
            (a) =>
              a.playState !== 'running' ||
              a.effect?.getComputedTiming().iterations === Infinity,
          ),
      ),
    )
    .toBe(true)
}

/** smokeS("…", "canvas"): the canvas screen with its editor rendered; console errors collected from here on */
async function openCanvas(page: Page) {
  const errs = watchErrors(page)
  await page.goto('/uikit/#/screen/canvas')
  await expect(
    E(page, '[data-testid="panel-l"] [role=row]').first(),
  ).toBeVisible()
  await settled(page)
  return errs
}

/** qa.mjs scen("Masters"): the old editor scenario now lives on #/feature/layout-grids-settings, tab Master grid */
async function scenMasters(page: Page) {
  await page.goto('/uikit/#/feature/layout-grids-settings')
  const t = D(page, '[data-testid="scenarios"]').getByRole('tab', {
    name: 'Master grid',
    exact: true,
  })
  await t.click()
  await expect(t).toHaveAttribute('aria-selected', 'true')
  await settled(page)
}

/** kit10 walk opening: fresh #/demo, library, a new book, a photo folder, spread p1 */
async function openKit10(page: Page) {
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: DemoApi }).__demo.reset()
  })
  const c = (sel: string) => page.locator(sel).first().click() // dialogs portal outside the demo root
  await c('[data-testid="create-library"]')
  await c('[data-testid="picker-select"]')
  await c(`${demo} [data-testid="new-book"]`)
  await c('[data-testid="create-book"]')
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await c('[data-testid="demo-add-folder"]')
  await page
    .locator('[role=dialog]')
    .getByRole('button', { name: /Choose|Select|Use|Add/i })
    .last()
    .click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await c('[data-item="p1"]')
  await settled(page)
}

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

/** Ctrl+; on the canvas when no guide is shown yet */
async function guidesOn(page: Page, shown: number) {
  if (shown) return
  await page.locator('[data-testid="canvas"]').focus()
  await page.keyboard.press('Control+;')
}

/** the demo editor in Pages or Masters mode */
async function mode(page: Page, t: 'Pages' | 'Masters') {
  await D(page, '[data-testid="mode-seg"]')
    .getByText(t, { exact: true })
    .click()
  const master = D(page, '[data-testid="canvas-master"]')
  if (t === 'Masters') await expect(master).toBeVisible()
  else await expect(master).toHaveCount(0)
  await settled(page)
}

/** the first #/demo book */
async function firstBook(page: Page) {
  const bk = await page.evaluate(
    () =>
      (window as unknown as { __demo: DemoApi }).__demo.state().books[0]?.book,
  )
  if (!bk) throw new Error('no book')
  return bk
}

function three<T>(xs: T[]): [T, T, T] {
  const [a, b, c] = xs
  if (a === undefined || b === undefined || c === undefined)
    throw new Error('expected 3 reads')
  return [a, b, c]
}

test('screen canvas: v7 Pages/Masters toggle: masters show margins, columns, # placeholders', async ({
  page,
}) => {
  const errs = await openCanvas(page)
  await E(page, '[data-testid="mode-seg"] button').nth(1).click()
  await expect(E(page, '[data-testid="canvas-master"]')).toHaveCount(1)
  await settled(page)
  // page-numbers-kit: Show off hides the position seg and hint; no dead "Position · Bottom" row
  const segOff =
    (await E(page, '[data-testid="master-pn-position"]').count()) +
    (await E(page, '[data-testid="master-pn-note"]').count())
  // kit10: Page numbers start off (they feed Parent.pageNumbers of every spread)
  const pnSwitch = E(
    page,
    '[data-testid="insp-master"] [role=switch][aria-label="Page numbers"]',
  )
  await pnSwitch.click()
  await expect(pnSwitch).toHaveAttribute('aria-checked', 'true')
  await settled(page)
  expect((await items(page)).join()).toBe('mA,mB')
  await expect(E(page, '[data-testid="canvas-master"]')).toHaveCount(1)
  await expect(E(page, '[data-testid="master-margin"]')).toHaveCount(2)
  expect(
    await E(page, '[data-testid="master-col"]').count(),
  ).toBeGreaterThanOrEqual(4)
  expect(await E(page, '[data-testid="master-pn"]').allInnerTexts()).toEqual([
    '#',
    '#',
  ])
  expect(segOff).toBe(0)
  await expect(E(page, '[data-testid="master-pn-position"]')).toHaveCount(1)
  await expect(
    E(page, '[data-testid="insp-master"]').getByText(/^(Position|Bottom)$/),
  ).toHaveCount(0)
  expect(errs).toEqual([])
})

test('v7.3 P1: Master A/B/None changes what the canvas renders (master frames + guides, no spread outline)', async ({
  page,
}) => {
  await page.goto('/uikit/#/full/canvas')
  const select = page.getByTestId('spread-master-select').first()
  await expect(select).toBeAttached()
  await settled(page)
  const snap = () =>
    page.evaluate(() => {
      const sp = document.querySelector('[data-testid="spread"][data-current]')
      const q = (s: string) => (sp ? sp.querySelectorAll(s).length : -1)
      const cs = sp ? getComputedStyle(sp) : null
      return {
        a: q('[data-frame^="mA-"]'),
        b: q('[data-frame^="mB-"]'),
        ga: q('[data-guide^="mA-"]'),
        gb: q('[data-guide^="mB-"]'),
        outline: cs
          ? cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px'
          : true,
      }
    })
  const pick = (name: string) =>
    select.selectOption(name === 'None' ? 'none' : name.slice(-1), {
      force: true,
    })
  await pick('Master B')
  await expect
    .poll(async () => {
      const s = await snap()
      return { frames: s.b > 0, other: s.a, outline: s.outline }
    })
    .toEqual({ frames: true, other: 0, outline: false })
  await pick('None')
  await expect
    .poll(async () => {
      const s = await snap()
      return { frames: s.a + s.b, outline: s.outline }
    })
    .toEqual({ frames: 0, outline: false })
  await pick('Master A')
  await expect
    .poll(async () => {
      const s = await snap()
      return { frames: s.a > 0, other: s.b, outline: s.outline }
    })
    .toEqual({ frames: true, other: 0, outline: false })
  // guides on → master guides render too
  await page.evaluate(() => {
    ;(document.activeElement as HTMLElement | null)?.blur()
  })
  const s0 = await snap()
  await guidesOn(page, s0.ga + s0.gb)
  await expect.poll(async () => (await snap()).ga).toBeGreaterThan(0)
  await pick('Master B')
  await expect.poll(async () => (await snap()).gb).toBeGreaterThan(0)
  await pick('None')
  await expect
    .poll(async () => {
      const s = await snap()
      return s.ga + s.gb
    })
    .toBe(0)
})

test('screen canvas: v7.4 P2-2: Masters inspector — page numbers toggle, margin and grid fields change the master render', async ({
  page,
}) => {
  const errs = await openCanvas(page)
  await scenMasters(page)
  const r = () =>
    page.evaluate(() => {
      const d = document.querySelector('[data-testid="demo"]')
      const m = d?.querySelector<HTMLElement>('[data-testid="master-margin"]')
      return {
        pn: d?.querySelectorAll('[data-testid="master-pn"]').length ?? 0,
        cols: d?.querySelectorAll('[data-testid="master-col"]').length ?? 0,
        inset: m ? m.style.inset : '',
      }
    })
  const r0 = await r()
  expect(r0.pn).toBe(0)
  const pnSwitch = D(
    page,
    '[data-testid="insp-master"] [role=switch][aria-label="Page numbers"]',
  )
  await pnSwitch.click()
  await expect.poll(async () => (await r()).pn).toBeGreaterThan(0)
  await pnSwitch.click()
  await expect.poll(async () => (await r()).pn).toBe(0)
  await D(page, '[data-testid="master-field-C"]').fill('4')
  await expect.poll(async () => (await r()).cols).toBe(2 * 4)
  const r2 = await r()
  expect(r2.cols).not.toBe(r0.cols)
  await D(page, '[data-testid="master-field-T"]').fill('20')
  await expect.poll(async () => (await r()).inset).not.toBe(r2.inset)
  expect(errs).toEqual([])
})

test('v0.9 §5 Row gap shows numeric value + mm (short label)', async ({
  page,
}) => {
  await openCanvas(page)
  await scenMasters(page)
  const rg = page.locator('[data-testid="master-field-RG"]')
  const rgVal = await rg.inputValue()
  const rgRow = await rg.evaluate((el) => {
    const lab = el.closest('label')
    return {
      text: (lab?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      label: lab?.querySelector('span')?.textContent.trim(),
    }
  })
  expect(rgVal).toMatch(/^\d+$/)
  expect(rgRow.text).toMatch(/mm/)
  expect(rgRow.label).toBe('RG')
})

interface Folio {
  l: number
  r: number
  t: number
  al: string
  fz: number
  col?: string
  tx: string | null
}

test('kit10: master guides + Page numbers feed the spreads; page-numbers-kit folio geometry, master chip, last page, Book settings Start at / Format / Skip first', async ({
  page,
}) => {
  await openKit10(page)
  const c = (sel: string) => page.locator(sel).first().click()
  const filmRow = D(page, '[data-testid="filmstrip"] [role="row"]').nth(1)
  // kit10 steps before the master checks (their state feeds them): the low-res photo p02 on p1's first frame,
  // rulers (Shift+R) + guides (Ctrl+;) on, a guide dragged onto the spread, rulers off, p1 duplicated
  await filmRow.dragTo(
    D(
      page,
      '[data-testid="canvas"] [data-current] [data-testid="frame"]',
    ).first(),
  )
  await expect(filmRow.locator('[title="Placed in the book"]')).toHaveCount(1)
  await page.keyboard.press('Shift+R')
  await page.keyboard.press('Control+;')
  const rulerX = D(page, '[data-testid="ruler-x"]')
  await expect(rulerX).toBeVisible()
  await settled(page)
  const spreadGuides = D(page, '[data-testid="spread"] [data-guide]')
  const g0 = await spreadGuides.count()
  const rx = await box(rulerX)
  const sp = await box(D(page, '[data-testid="spread"]').first())
  await page.mouse.move(rx.x + rx.width / 2, rx.y + 10)
  await page.mouse.down()
  await page.mouse.move(rx.x + rx.width / 2, sp.y + sp.height * 0.4, {
    steps: 6,
  })
  await page.mouse.up()
  await expect(spreadGuides).toHaveCount(g0 + 1)
  await page.keyboard.press('Shift+R')
  await expect(rulerX).toHaveCount(0)
  await D(page, '[data-item="p1"]').hover()
  await c('[data-item="p1"] [data-testid="spread-menu"]')
  await page.getByRole('menuitem', { name: /Duplicate/ }).click()
  await expect(page.getByRole('menuitem')).toHaveCount(0)

  // master guides + Page numbers feed every spread on the master
  const modeSeg = D(page, '[data-testid="mode-seg"]')
  const master = D(page, '[data-testid="canvas-master"]')
  await modeSeg.getByText('Masters', { exact: true }).click()
  await expect(master).toBeVisible()
  await page.keyboard.press('Shift+R')
  const rulerY = D(page, '[data-testid="ruler-y"]')
  await expect(rulerY).toBeVisible()
  await settled(page)
  const masterGuides = D(page, '[data-testid="node-view"] [data-guide]')
  const m0 = await masterGuides.count()
  const ry = await box(rulerY)
  const mb = await box(master)
  await page.mouse.move(ry.x + 10, ry.y + ry.height / 2)
  await page.mouse.down()
  await page.mouse.move(mb.x + mb.width * 0.3, ry.y + ry.height / 2, {
    steps: 6,
  })
  await page.mouse.up()
  // kit10: a guide dragged on a master is kept and inherited (dashed) by its spreads
  await expect(masterGuides).toHaveCount(m0 + 1)
  const m1 = m0 + 1
  const pnSwitch = page
    .locator(
      '[data-testid="insp-master"] [role=switch][aria-label="Page numbers"]',
    )
    .first()
  await pnSwitch.click()
  await expect(pnSwitch).toHaveAttribute('aria-checked', 'true')

  const p1Row = D(page, '[data-testid="panel-l"] [data-item="p1"]')
  const pick = async (item: string) => {
    await c(`[data-item="${item}"]`)
    await expect(
      D(page, `[data-testid="panel-l"] [data-item="${item}"]`),
    ).toHaveAttribute('aria-selected', 'true')
    await settled(page)
  }
  const toP1 = async () => {
    await mode(page, 'Pages')
    await pick('p1')
  }
  await mode(page, 'Pages')
  await pick('p1')
  await expect(p1Row).toHaveAttribute('aria-selected', 'true')
  expect(await spreadGuides.count()).toBeGreaterThanOrEqual(m1)
  // kit10: master Page numbers toggle wires Parent.pageNumbers — spreads show page numbers
  await expect(
    D(page, '[data-testid="spread"][data-current] [data-testid="page-number"]'),
  ).toHaveCount(2)

  // page-numbers-kit: folio box 20 × 4.34 mm at y = min(H − bottom/2 − 2.17, H − safe − 4.34) (safe = the book's S, 8 mm), x per Outer / Centre /
  // Inner from Master A's margins, Inter 3.1 mm × px/mm, painted under the spread frames; the single last page gets the left folio; none in the
  // spread list; Start at / Format / Skip first from Book settings
  const fol = () =>
    page.evaluate((demo) => {
      const sp = document.querySelector(
        `${demo} [data-testid="spread"][data-current]`,
      )
      if (!sp) throw new Error('no current spread')
      const s = sp.getBoundingClientRect()
      const kids = [...sp.children]
      const fs = [...sp.querySelectorAll('[data-testid="page-number"]')]
      const own = kids.findIndex((k) => k.matches('[data-testid="frame"]'))
      const box = (e: Element) => {
        const r = e.getBoundingClientRect()
        const cs = getComputedStyle(e)
        return {
          l: r.left - s.left,
          r: r.right - s.left,
          t: r.top - s.top,
          al: cs.textAlign,
          fz: parseFloat(cs.fontSize),
          col: cs.color,
          tx: e.textContent,
        }
      }
      return {
        w: s.width,
        n: [...document.querySelectorAll<HTMLElement>(`${demo} [data-item]`)]
          .map((e) => e.dataset.item ?? '')
          .filter((k) => /^p\d+$/.test(k)).length,
        under: own === -1 || fs.every((e) => kids.indexOf(e) < own),
        f: fs.map(box),
      }
    }, demo)
  const lastFol = async () => {
    await pick('last')
    return page.evaluate((demo): Folio[] | null => {
      const lp = document.querySelector(`${demo} [data-testid="canvas-last"]`)
      if (!lp) return null
      const lr = lp.getBoundingClientRect()
      return [...lp.querySelectorAll('[data-testid="page-number"]')].map(
        (e) => {
          const r = e.getBoundingClientRect()
          const cs = getComputedStyle(e)
          return {
            l: r.left - lr.left,
            r: r.right - lr.left,
            t: r.top - lr.top,
            al: cs.textAlign,
            fz: parseFloat(cs.fontSize),
            tx: e.textContent,
          }
        },
      )
    }, demo)
  }
  const bk = await firstBook(page)
  const P = bk.w * 10
  const H = bk.h * 10
  await mode(page, 'Masters')
  const fv = async (k: string) =>
    +(await D(page, `[data-testid="master-field-${k}"]`).inputValue())
  const g = { b: await fv('B'), i: await fv('I'), o: await fv('O') }
  const chips = () =>
    page.evaluate((demo) => {
      const m = document
        .querySelector(`${demo} [data-testid="canvas-master"]`)
        ?.getBoundingClientRect() ?? { width: 0, top: 0 }
      return {
        w: m.width,
        t: [
          ...document.querySelectorAll(`${demo} [data-testid="master-pn"]`),
        ].map((e) => e.getBoundingClientRect().top - m.top),
      }
    }, demo)
  const seg = D(page, '[data-testid="master-pn-position"] button')
  const got = []
  for (let i = 0; i < 3; i++) {
    await seg.nth(i).click()
    await settled(page)
    const al = await D(page, '[data-testid="master-pn"]').evaluateAll((es) =>
      es.map((e) => (e as HTMLElement).dataset.align).join(),
    )
    const ch = await chips()
    await toP1()
    got.push({ ...(await fol()), al, ch, last: await lastFol() })
    await mode(page, 'Masters')
  }
  await seg.nth(0).click()
  await settled(page)
  const [g0f, g1f, g2f] = three(got)
  const k = g0f.w / (2 * P)
  const ymm = Math.min(H - g.b / 2 - 2.17, H - bk.safe - 4.34)
  const y = ymm * k
  const [o0, o1] = g0f.f
  const [c0, c1] = g1f.f
  const [i0, i1] = g2f.f
  const info = JSON.stringify({ k, ymm, y, g, safe: bk.safe, got })
  // page-numbers-kit: spread folios follow Outer / Centre / Inner at the master margins, top in the bottom margin band inside the book's safe
  // margin, Inter 3.1 mm, under the spread frames (±0.5 px)
  expect(
    bk.safe === 5 &&
      got.every(
        (x) =>
          x.f.length === 2 &&
          x.under &&
          x.f.every(
            (f) =>
              near(f.t, y) &&
              near(f.fz, 3.1 * k) &&
              f.col === 'rgb(35, 34, 32)',
          ),
      ) &&
      !!o0 &&
      !!o1 &&
      near(o0.l, g.o * k) &&
      o0.al === 'left' &&
      near(o1.r, g0f.w - g.o * k) &&
      o1.al === 'right' &&
      g0f.al === 'left,right' &&
      !!c0 &&
      !!c1 &&
      near((c0.l + c0.r) / 2, (P / 2) * k) &&
      near((c1.l + c1.r) / 2, P * 1.5 * k) &&
      g1f.f.every((f) => f.al === 'center') &&
      g1f.al === 'center,center' &&
      !!i0 &&
      !!i1 &&
      near(i0.r, (P - g.i) * k) &&
      i0.al === 'right' &&
      near(i1.l, (P + g.i) * k) &&
      i1.al === 'left' &&
      g2f.al === 'right,left',
    info,
  ).toBe(true)
  // page-numbers-kit: the master # chip sits at the folio top inside the book's safe margin (±0.5 px)
  expect(
    got.every(
      (x) =>
        x.ch.t.length === 2 &&
        x.ch.t.every((t) => near(t, (ymm * x.ch.w) / (2 * P))),
    ),
    JSON.stringify(got.map((x) => x.ch)),
  ).toBe(true)
  // page-numbers-kit: the single last page prints the left-page folio (page 2n) at Outer / Centre / Inner (±0.5 px)
  const [lo, lc, li] = got.map((x) => x.last?.[0])
  expect(
    got.every(
      (x) =>
        x.last?.length === 1 &&
        x.last[0]?.tx === String(2 * x.n) &&
        near(x.last[0].t, y) &&
        near(x.last[0].fz, 3.1 * k),
    ) &&
      !!lo &&
      !!lc &&
      !!li &&
      near(lo.l, g.o * k) &&
      lo.al === 'left' &&
      near((lc.l + lc.r) / 2, (P / 2) * k) &&
      lc.al === 'center' &&
      near(li.r, (P - g.i) * k) &&
      li.al === 'right',
    JSON.stringify(got.map((x) => x.last)),
  ).toBe(true)
  // page-numbers-kit: no folios in the spread list
  await expect(
    D(page, '[data-testid="panel-l"] [data-testid="page-number"]'),
  ).toHaveCount(0)
  // master hint → Book settings; the Page numbers section sits between Binding and Print (179.37 px with a one-line note)
  const hint = await D(page, '[data-testid="master-pn-note"]').innerText()
  await c('[data-testid="master-pn-book-settings"]')
  await expect(D(page, '[data-testid="book-page-numbers"]')).toBeVisible()
  await settled(page)
  const bs = await page.evaluate((demo) => {
    const s = document.querySelector(
      `${demo} [data-testid="book-page-numbers"]`,
    )
    // the Start at value fits its 2ch field (no spin buttons eating it)
    const st = s?.querySelector<HTMLInputElement>(
      '[data-testid="book-pn-start"]',
    )
    return {
      h: s?.getBoundingClientRect().height ?? 0,
      fits: !!st && st.value === '1' && st.scrollWidth <= st.clientWidth,
      eyebrows: [
        ...document.querySelectorAll(`${demo} [data-testid="insp-book"] h3`),
      ]
        .map((h) => h.textContent)
        .join('/'),
    }
  }, demo)
  const bsInfo = `${hint} ${JSON.stringify(bs)}`
  expect(hint, bsInfo).toBe('Starts at 1 · 1, 2, 3 · Book settings')
  expect(near(bs.h, 179.37), bsInfo).toBe(true)
  expect(bs.fits, bsInfo).toBe(true)
  expect(bs.eyebrows, bsInfo).toBe(
    'Page size/Binding/Page numbers/Print/Defaults',
  )
  expect(await D(page, '[data-testid="book-pn-note"]').innerText()).toBe(
    'Page 1 is 1',
  )
  // Start at 5 + i, ii, iii + Skip first page → vi / vii on pages 2–3, none on page 1; Skip off → v on the right page
  const start = D(page, '[data-testid="book-pn-start"]')
  const fmt = (i: number) =>
    D(page, '[data-testid="book-pn-format"] button').nth(i).click()
  const skip = () => c(`${demo} [data-testid="book-pn-skip-first"]`)
  await start.fill('5')
  await page.keyboard.press('Enter')
  await start.fill('12')
  await page.keyboard.press('Escape')
  await fmt(1)
  await skip()
  await settled(page)
  const note = await D(page, '[data-testid="book-pn-note"]').innerText()
  const sv = await start.inputValue()
  await toP1()
  const p1 = (await fol()).f.map((f) => f.tx).join()
  await pick('p0')
  const p0 = (await fol()).f.length
  await c('[data-testid="book-title"]')
  await expect(D(page, '[data-testid="insp-book"]')).toBeVisible()
  await skip()
  await pick('p0')
  const p0n = (await fol()).f
  const pnInfo = `start=${sv} note="${note}" p1=${p1} p0=${String(p0)}/${p0n.map((f) => f.tx).join()}`
  expect(sv, pnInfo).toBe('5')
  expect(note, pnInfo).toBe('Page 1 has no number · page 2 is vi')
  expect(p1, pnInfo).toBe('vi,vii')
  expect(p0, pnInfo).toBe(0)
  expect(
    p0n.map((f) => f.tx),
    pnInfo,
  ).toEqual(['v'])
  expect(p0n[0]?.l ?? 0, pnInfo).toBeGreaterThanOrEqual(g0f.w / 2)
})
