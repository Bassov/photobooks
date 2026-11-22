import fs from 'node:fs'
import path from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { topAt } from './fixtures/paintProbe'

// Kit filmstrip (moved from uikit/scripts/qa.mjs v0.7.2 / v0.7.4 / v8 smokes, v0.9 §3, v0.9.3,
// the kit10 missing photo + Relink steps and kit-sync W5, uikit-qa-split-5): drag onto a frame
// or the cover, the used count and head label, quiet folder status, selection tone, Relink, the
// Unplaced / sort / Add folder… header chips. Every test also fails on a console error /
// warning, page error or failed request, like qa.mjs.

test.use({
  viewport: { width: 1440, height: 900 },
  // qa.mjs Chrome: scrollbars shown, unhinted (fractional) text widths
  launchOptions: {
    ignoreDefaultArgs: ['--hide-scrollbars'],
    args: ['--font-render-hinting=none'],
  },
})

const DEMO = '[data-testid="demo"]'
const D = (page: Page, s: string) => page.locator(`${DEMO} ${s}`)

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

const frames2 = () =>
  new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

/** two frames painted and no finite animation still running */
async function settled(page: Page) {
  await page.evaluate(frames2)
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

async function open(page: Page, hash: string) {
  const errs = watchErrors(page)
  await page.goto(`/uikit/${hash}`)
  await expect(page.getByTestId('demo')).toBeVisible()
  await settled(page)
  return errs
}

/** qa.mjs scen(): the old editor screen scenarios live on feature pages */
async function scen(page: Page, feature: string, tab: string) {
  await page.goto(`/uikit/#/feature/${feature}`)
  const t = D(page, '[data-testid="scenarios"]').getByRole('tab', {
    name: tab,
    exact: true,
  })
  await t.click()
  await expect(t).toHaveAttribute('aria-selected', 'true')
  await settled(page)
}

interface DemoApi {
  reset: () => void
  state: () => {
    path: string
    books: {
      id: string
      title: string
      book: Record<string, unknown>
      doc?: Record<string, unknown>
    }[]
    open: string
  }
  go: (view: string) => void
  missing: (n: number) => void
}

/** qa.mjs: #/demo with one A5 book open in the editor */
async function demoBook(page: Page, title: string) {
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate((title) => {
    const d = (window as unknown as { __demo: DemoApi }).__demo
    d.reset()
    const s = d.state()
    s.path = '~/Pictures/Photobooks'
    s.books = [
      {
        id: 's1',
        title,
        book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: 'A5' },
      },
    ]
    s.open = 's1'
    d.go('editor')
  }, title)
  await expect(D(page, '[data-testid="dock"]')).toBeVisible()
  await settled(page)
}

/** Add folder… → the picker's Select */
async function addFolder(page: Page) {
  await page.locator('[data-testid="demo-add-folder"]').first().click()
  await page
    .locator('[role=dialog]')
    .getByRole('button', { name: /Select/i })
    .last()
    .click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await settled(page)
}

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

/** no Replace control in the demo and no replace picker anywhere */
async function replaceGone(page: Page, testid: string) {
  const n =
    (await D(page, `[data-testid="${testid}"]`).count()) +
    (await page.locator('[data-testid="replace-picker"]').count())
  return n === 0
}

const frameSrcs = () =>
  [
    ...document.querySelectorAll('[data-testid="demo"] [data-testid="frame"]'),
  ].map((f) => f.querySelector('img')?.getAttribute('src'))

test('screen canvas, v0.9 §4: no Replace button/picker; filmstrip drag onto a frame swaps the photo', async ({
  page,
}) => {
  const errs = await open(page, '#/screen/canvas')
  await scen(page, 'frame-selection-handles', 'Frame selected')
  const noReplace = await replaceGone(page, 'replace')
  // kit screen chrome clips filmstrip+frame; DnD on the dedicated feature page
  await page.goto('/uikit/#/feature/drag-place-replace')
  await expect(D(page, '[data-testid="filmstrip"]')).toBeVisible()
  await settled(page)
  const fid0 = await page.evaluate(frameSrcs)
  await D(page, '[data-testid="filmstrip"] [role="row"]')
    .nth(0)
    .dragTo(D(page, '[data-testid="frame"]').first())
  await settled(page)
  const fid1 = await page.evaluate(frameSrcs)
  const changed = fid0.filter((s, i) => s !== fid1[i]).length
  const st = await page
    .textContent(`${DEMO} [data-testid="status"]`)
    .catch(() => '')
  expect(
    noReplace && changed >= 1 && /Placed|Replaced/.test(st ?? ''),
    `noReplace=${String(noReplace)} changed=${String(changed)} status="${String(st)}"`,
  ).toBe(true)
  expect(errs).toEqual([])
})

test('screen canvas, v0.9 §4: cover has no Replace; filmstrip drag onto the cover swaps the front photo', async ({
  page,
}) => {
  const errs = await open(page, '#/screen/canvas')
  await scen(page, 'pasteboard-workspace', 'Cover')
  const noReplace = await replaceGone(page, 'cover-replace')
  // #/demo fits cover + filmstrip (kit screen page scrolls filmstrip under the viewport)
  await demoBook(page, 'Cover drag')
  await addFolder(page)
  await page.locator('[data-item="cover"]').click()
  await settled(page)
  const id0 = await page
    .locator('[data-testid="cover-front"]')
    .getAttribute('data-photo-id')
  await page
    .locator('[data-testid="filmstrip"] [role="row"]')
    .nth(2)
    .dragTo(page.locator('[data-testid="cover-front"]'))
  await settled(page)
  const id1 = await page
    .locator('[data-testid="cover-front"]')
    .getAttribute('data-photo-id')
  expect(
    noReplace && !!id1 && id0 !== id1,
    `noReplace=${String(noReplace)} ${String(id0)} → ${String(id1)}`,
  ).toBe(true)
  expect(errs).toEqual([])
})

test('screen canvas, v7.4 P2-4 / v0.9: dragging onto the cover updates the filmstrip used count', async ({
  page,
}) => {
  const errs = await open(page, '#/screen/canvas')
  // #/demo: cover + filmstrip both in view (kit screen page clips one or the other)
  await demoBook(page, 'Used count')
  await addFolder(page)
  await page.locator('[data-item="cover"]').click()
  await settled(page)
  const cnt = async () =>
    Number(
      /(\d+) used/.exec(
        await page.locator('[data-testid="placed-count"]').innerText(),
      )?.[1],
    )
  const n0 = await cnt()
  const film = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        '[data-testid="filmstrip"] [role="row"]',
      ),
    ]
      .filter((r) => !r.querySelector('[data-testid="filmstrip-placed"]'))
      .map((r) => r.dataset.key ?? ''),
  )
  const k = film[0] ?? ''
  expect(k, 'no unplaced photo in filmstrip').not.toBe('')
  await page
    .locator(`[data-testid="filmstrip"] [role="row"][data-key="${k}"]`)
    .dragTo(page.locator('[data-testid="cover-front"]'))
  await settled(page)
  const cv = await page
    .locator('[data-testid="cover-front"]')
    .getAttribute('data-photo-id')
  const n1 = await cnt()
  const mark = await page.evaluate(
    (k) =>
      !!document.querySelector(
        `[data-testid="filmstrip"] [role="row"][data-key="${k}"] [data-testid="filmstrip-placed"]`,
      ),
    k,
  )
  const marks = await page.evaluate(
    () =>
      document.querySelectorAll(
        '[data-testid="filmstrip"] [role="row"] [data-testid="filmstrip-placed"]',
      ).length,
  )
  expect(
    cv === k && mark && n1 === marks && n0 >= 0,
    `${String(n0)} → ${String(n1)} used (= ${String(marks)} ✓ marks), ${k} marked=${String(mark)} cover=${String(cv)}`,
  ).toBe(true)
  expect(errs).toEqual([])
})

test("screen canvas, v8 §3.1: single filmstrip label 'Photos · N · M used'", async ({
  page,
}) => {
  const errs = await open(page, '#/screen/canvas')
  const t = (await D(page, '[data-testid="film-head"]').innerText()).trim()
  const n = await D(page, '[data-testid="placed-count"]').count()
  const dup = await D(page, '[data-testid="dock"]').evaluate(
    (d: HTMLElement) => (d.innerText.match(/\bused\b/g) ?? []).length,
  )
  expect(
    // P11: the demo gallery holds one low-res photo (p02)
    /^Photos · \d+ · \d+ used · 1 low-res$/.test(t) && n === 1 && dup === 1,
    `"${t}" n=${String(n)} used×${String(dup)}`,
  ).toBe(true)
  expect(errs).toEqual([])
})

const toastRegion = () => {
  const region = document.querySelector(
    '[aria-label="Notifications"], [data-testid="toast-region"]',
  )
  return region?.textContent ?? ''
}

test('v0.9 §3 (#/demo): photo-folder and filmstrip events use the quiet status, never a floating toast', async ({
  page,
}) => {
  const errs = watchErrors(page)
  // §3 no floating toast for photo-folder events on Add folder (demo)
  await demoBook(page, 'Toast probe')
  await addFolder(page)
  // floating toasts live in ToastRegion; folder events must not create one
  const bodyToasts = await page.evaluate(toastRegion)
  const folderToast =
    /Added |no new photos|photos from|adds folders, not single/i.test(
      bodyToasts,
    )
  const statusTxt = await page
    .locator('[data-testid="status"]')
    .innerText()
    .catch(() => '')
  expect(
    !folderToast && /Added |no new photos/i.test(statusTxt),
    `v0.9 §3 Add folder uses quiet status, not a floating toast — folderToast=${String(folderToast)} status="${statusTxt}" region="${bodyToasts.slice(0, 80)}"`,
  ).toBe(true)
  // second Add of same folder → "no new photos" still quiet (no toast region text)
  await addFolder(page)
  const bodyToasts2 = await page.evaluate(toastRegion)
  const status2 = await page
    .locator('[data-testid="status"]')
    .innerText()
    .catch(() => '')
  const filmToast2 =
    /Added |no new photos|photos from|Drag photos|adds folders/i.test(
      bodyToasts2,
    )
  expect(
    !filmToast2 && /no new photos/i.test(status2),
    `v0.9 §3 no new photos / filmstrip events stay out of toast region — toast="${bodyToasts2.slice(0, 80)}" status="${status2}"`,
  ).toBe(true)
  // source: chrome + demo must not toast photo-folder / filmstrip import events
  const folderSrc = [
    'src/sandbox/chrome.tsx',
    'src/features/demo.tsx',
    'src/demo-parts/editor.tsx',
  ]
    .map((f) =>
      fs.readFileSync(path.resolve(process.cwd(), 'uikit', f), 'utf8'),
    )
    .join('\n')
  // flag toast calls whose title/description are photo-folder / filmstrip import or remove-from-gallery notices
  const badToast =
    /st\.toast\(\{[^\n]{0,200}(?:Added \d+ photo|no new photos|removed from the gallery|adds folders, not single|Drag photos onto)/.test(
      folderSrc,
    )
  expect(
    badToast,
    'v0.9 §3 source: no st.toast for photo-folder / filmstrip gallery events — toast call still present',
  ).toBe(false)
  expect(errs).toEqual([])
})

/** v0.9.3: a visible outline / box-shadow ring in the select ink (#232223) — 0px hairline layers ignored */
function blackRingOf(el: Element) {
  const s = getComputedStyle(el)
  if (
    s.outlineStyle !== 'none' &&
    parseFloat(s.outlineWidth) > 0 &&
    /35,\s*34,\s*35|232223/.test(s.outlineColor)
  )
    return true
  return s.boxShadow.split(/,(?![^(]*\))/).some((part) => {
    const m =
      /rgb\(\s*35,\s*34,\s*35\s*\).*?(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px/.exec(
        part,
      )
    if (!m) return false
    return Math.max(...m.slice(1).map(Number).map(Math.abs)) >= 1
  })
}

test('v0.9.3 filmstrip selection: tone only, no black ring-select', async ({
  page,
}) => {
  const errs = await open(page, '#/screen/canvas')
  await scen(page, 'frame-selection-handles', 'Frame selected')
  const thumb = page
    .locator('[data-testid="demo"] [data-testid="filmstrip"] [role="row"]')
    .first()
  await thumb.click()
  await settled(page)
  const filmSel = await thumb.evaluate((el) => {
    const s = getComputedStyle(el)
    return {
      boxShadow: s.boxShadow,
      outline: s.outlineStyle,
      bg: s.backgroundColor,
      cls: el.getAttribute('class'),
    }
  })
  const blackRing = await thumb.evaluate(blackRingOf)
  expect(
    !blackRing && /202,\s*202,\s*202/.test(filmSel.bg),
    `v0.9.3 filmstrip selection: tone only, no black ring-select — ${JSON.stringify({ ...filmSel, blackRing })}`,
  ).toBe(true)
  expect(errs).toEqual([])
})

test('kit10 #/demo: a missing photo hatches its frame, Relink lists it, a rescan finds it, Resolve relinks', async ({
  page,
}) => {
  // kit10 walk: fresh #/demo, library, a new book, a photo folder, the low-res photo on spread p1, rulers + guides,
  // a guide, Duplicate, a master guide + Page numbers, a master frame override; then a missing photo
  const errs = watchErrors(page)
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: DemoApi }).__demo.reset()
  })
  await settled(page)
  const c = async (sel: string) => {
    await page.locator(sel).first().click() // dialogs portal outside the demo root
    await settled(page)
  }
  await c('[data-testid="create-library"]')
  await c('[data-testid="picker-select"]')
  await c(`${DEMO} [data-testid="new-book"]`)
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
  await D(page, '[data-testid="filmstrip"] [role="row"]')
    .nth(1)
    .dragTo(
      D(
        page,
        '[data-testid="canvas"] [data-current] [data-testid="frame"]',
      ).first(),
    ) // p02 = the 800 px low-res photo
  await settled(page)
  // KS1: rulers (Shift+R) and guides (Ctrl+;) are on keys as in prod
  await page.keyboard.press('Shift+R')
  await page.keyboard.press('Control+;')
  await settled(page)
  const rx = await box(D(page, '[data-testid="ruler-x"]'))
  const sp = await box(D(page, '[data-testid="spread"]').first())
  await page.mouse.move(rx.x + rx.width / 2, rx.y + 10)
  await page.mouse.down()
  await page.mouse.move(rx.x + rx.width / 2, sp.y + sp.height * 0.4, {
    steps: 6,
  })
  await page.mouse.up()
  await settled(page)
  await page.keyboard.press('Shift+R')
  await D(page, '[data-item="p1"]').hover()
  await c('[data-item="p1"] [data-testid="spread-menu"]')
  await page.getByRole('menuitem', { name: /Duplicate/ }).click()
  await settled(page)
  // master guides + Page numbers feed every spread on the master
  await D(page, '[data-testid="mode-seg"]')
    .getByText('Masters', { exact: true })
    .click()
  await settled(page)
  await page.keyboard.press('Shift+R')
  await settled(page)
  const ry = await box(D(page, '[data-testid="ruler-y"]'))
  const mb = await box(D(page, '[data-testid="canvas-master"]'))
  await page.mouse.move(ry.x + 10, ry.y + ry.height / 2)
  await page.mouse.down()
  await page.mouse.move(mb.x + mb.width * 0.3, ry.y + ry.height / 2, {
    steps: 6,
  })
  await page.mouse.up()
  await settled(page)
  await c(
    '[data-testid="insp-master"] [role=switch][aria-label="Page numbers"]',
  )
  await D(page, '[data-testid="mode-seg"]')
    .getByText('Pages', { exact: true })
    .click()
  await settled(page)
  await c('[data-item="p1"]')
  await page.keyboard.press('Escape')
  await settled(page)
  await D(page, '[data-current] [data-testid="master-frame"]')
    .first()
    .click({ modifiers: ['Control', 'Shift'], force: true })
  await settled(page)
  // missing photo + Relink
  await page.evaluate(() => {
    ;(window as unknown as { __demo: DemoApi }).__demo.missing(1)
  })
  await settled(page)
  expect(
    (await D(page, '[data-testid="demo-relink"]').count()) === 1 &&
      (await D(page, '[data-testid="canvas"] .hatch-missing').count()) >= 1,
    'kit10: a missing photo hatches its frame and the dock offers Relink…',
  ).toBe(true)
  await c('[data-testid="demo-relink"]')
  const rows = await page.locator('[data-testid="relink-row"]').count()
  const dis = await page
    .locator('[data-testid="relink-resolve"]')
    .getAttribute('aria-disabled')
  expect(
    rows === 1 && dis === 'true',
    `kit10: Relink dialog lists missing photos; Resolve waits for a rescan — rows=${String(rows)} resolve aria-disabled=${String(dis)}`,
  ).toBe(true)
  await page.locator('[data-testid="relink-rescan"]').click()
  await settled(page)
  await page
    .locator('[role=dialog]')
    .getByRole('button', { name: /Choose|Select|Use|Open/i })
    .last()
    .click()
  await settled(page)
  expect(
    await page
      .locator('[data-testid="relink-row"]')
      .getAttribute('data-status'),
    'kit10: rescanning the library folder marks the photo Found',
  ).toBe('found')
  await page.locator('[data-testid="relink-resolve"]').click()
  await settled(page)
  expect(
    (await D(page, '[data-testid="demo-relink"]').count()) === 0 &&
      (await D(page, '[data-testid="canvas"] .hatch-missing').count()) === 0,
    'kit10: Resolve relinks — Relink… chip and hatch are gone',
  ).toBe(true)
  // kit10: no console errors in the new flows
  expect(errs).toEqual([])
})

const DOCK = `${DEMO} [data-testid="dock"]`
const U = `${DOCK} [data-testid="film-unplaced-only"]`
const SORT = `${DOCK} [data-testid="film-sort"]`
const A = `${DOCK} [data-testid="demo-add-folder"]`
const FB = `${DOCK} [data-testid="film-fill-book"]`

/** a header chip's box, radius, type and padding */
function chipOf(el: Element) {
  const b = el.getBoundingClientRect()
  const s = getComputedStyle(el)
  return {
    x: b.x,
    w: b.width,
    h: b.height,
    r: parseFloat(s.borderTopLeftRadius),
    fs: s.fontSize,
    fw: s.fontWeight,
    c: s.color,
    p: s.padding,
    text: el.textContent.trim(),
  }
}

/** a chip's own text run y vs its top */
function runYOf(el: Element) {
  const tn = [...el.childNodes].find(
    (n) => n.nodeType === 3 && n.textContent?.trim(),
  )
  if (!tn) throw new Error('no text run')
  const g = document.createRange()
  g.selectNodeContents(tn)
  return {
    y: +g.getBoundingClientRect().y.toFixed(2),
    top: el.getBoundingClientRect().top,
  }
}

/** text run dy below the chip top (±0.5), and the chip at `top` when given */
const runAt = (m: { y: number; top: number }, dy: number, top?: number) =>
  (top == null || m.top === top) && Math.abs(m.y - m.top - dy) <= 0.5

test('kit-sync W5 (#/demo, Designer kit-sync Spec 13 = prod FilmstripDock): filmstrip header Unplaced toggle + sort menu left of Add folder…', async ({
  page,
}) => {
  const errs = watchErrors(page)
  await demoBook(page, 'Chips')
  const head = () =>
    page.locator(`${DOCK} [data-testid="placed-count"]`).innerText()
  const chip = (sel: string) => page.locator(sel).evaluate(chipOf)
  // Designer capture = this renderer at 1440 × 900 (prod e2e rounds glyph runs: 786 / 90, 884 / 126, 1018 / 110)
  const SPEC: Record<string, [string, number, number, string, string, string]> =
    {
      // Designer fill-book F1: first in the right group; the other three keep their x
      'Fill book': [FB, 687.88, 87.97, '500', 'rgb(57, 55, 56)', '0px 10px'],
      Unplaced: [U, 783.92, 90.75, '500', 'rgb(83, 81, 82)', '0px 8px'],
      'Added order': [
        SORT,
        882.67,
        127.08,
        '400',
        'rgb(83, 81, 82)',
        '0px 8px',
      ],
      'Add folder…': [A, 1017.75, 110.25, '500', 'rgb(57, 55, 56)', '0px 10px'],
    }
  const order = await page
    .locator(
      `${DOCK} :is([data-testid="film-fill-book"], [data-testid="film-unplaced-only"], [data-testid="film-sort"], [data-testid="demo-add-folder"])`,
    )
    .evaluateAll((els) => els.map((e) => e.textContent.trim()))
  expect(
    order.join('|'),
    'kit-sync KS13 + fill-book F1: #/demo dock header = Fill book · Unplaced · Added order · Add folder…, 8 apart',
  ).toBe('Fill book|Unplaced|Added order|Add folder…')
  for (const [name, [sel, x, w, fw, c, p]] of Object.entries(SPEC)) {
    const m = await chip(sel)
    expect(
      Math.abs(m.x - x) <= 1,
      `kit-sync KS13: ${name} x ${String(x)} (±1) — ${String(m.x)}`,
    ).toBe(true)
    expect(
      Math.abs(m.w - w) <= 1,
      `kit-sync KS13: ${name} width ${String(w)} (±1) — ${String(m.w)}`,
    ).toBe(true)
    expect(m.h, `kit-sync KS13: ${name} height 28`).toBe(28)
    expect(
      m.r,
      `kit-sync KS13: ${name} radius ≥ 9999 (pill, Decided P2)`,
    ).toBeGreaterThanOrEqual(9999)
    expect(m.fs, `kit-sync KS13: ${name} font size 12`).toBe('12px')
    expect(m.fw, `kit-sync KS13: ${name} font weight ${fw}`).toBe(fw)
    expect(m.c, `kit-sync KS13: ${name} colour ${c}`).toBe(c)
    expect(m.p, `kit-sync KS13: ${name} padding ${p}`).toBe(p)
  }
  const glyphs = await page
    .locator(SORT)
    .evaluate((el) =>
      [...el.querySelectorAll('svg')].map((v) => v.getAttribute('class') ?? ''),
    )
  expect(
    glyphs.length === 2 &&
      (glyphs[0] ?? '').includes('arrow-down-up') &&
      (glyphs[1] ?? '').includes('chevron-down'),
    `kit-sync KS13: sort chip = arrow-up-down icon + label + chevron-down — ${JSON.stringify(glyphs)}`,
  ).toBe(true)
  // r15 M88: label text y at prod's line-height (chip's own text run vs its top; prod at top 774: Unplaced 780.0, sort / Add folder… 780.5)
  const runY = (sel: string) => page.locator(sel).evaluate(runYOf)
  const filmDy: Record<string, [string, number]> = {
    Unplaced: [U, 6],
    'Added order': [SORT, 6.5],
    'Add folder…': [A, 6.5],
  }
  // the filmstrip's scrollbar gutter (qa shows scrollbars, demo-capture does not) lifts the dock 10 px: drop it while measuring
  const gutter = (v: string) =>
    page
      .locator(`${DOCK} [data-testid="filmstrip"]`)
      .evaluate((e: HTMLElement, v) => {
        e.style.scrollbarWidth = v
      }, v)
  const chipsAt = async (top?: number) => {
    await gutter('none')
    const o: Record<string, { y: number; top: number; ok: boolean }> = {}
    for (const [name, [sel, dy]] of Object.entries(filmDy)) {
      const m = await runY(sel)
      o[name] = { ...m, ok: runAt(m, dy, top) }
    }
    await gutter('')
    return o
  }
  const fy0 = await chipsAt()
  expect(
    Object.values(fy0).every((m) => m.ok),
    `design-r16 M88: empty book — film chip text sits 6.0 (Unplaced) / 6.5 (Added order, Add folder…) below the chip top (±0.5, prod line-height 1 / normal) — ${JSON.stringify(fy0)}`,
  ).toBe(true)
  const emptyY = await page
    .locator(`${DOCK} [data-testid="film-panel"]`)
    .evaluate((p) => {
      const e = [...p.querySelectorAll('span')].find((s) =>
        s.textContent.startsWith('No photos yet'),
      )
      if (!e) return null
      const g = document.createRange()
      g.selectNodeContents(e)
      return +g.getBoundingClientRect().y.toFixed(2)
    })
  expect(
    emptyY != null && Math.abs(emptyY - 843.3) <= 0.5,
    `design-r16 M88: empty strip “No photos yet…” text y 843.3 (±0.5, prod .pb-empty-title 18 px / 1.3 around 13 px / 1.35; filmstrip-resize-kit: the empty row follows H = 76, was 829.3 at the 104 px --thumb) — ${String(emptyY)}`,
  ).toBe(true)
  // empty: no photos → the filter keeps the plain empty copy (prod shows the all-placed copy only with photos)
  const click = async (sel: string) => {
    await page.locator(sel).click()
    await settled(page)
  }
  const h0 = await head()
  await click(U)
  const h0on = await head()
  const empty0 = (
    await page.locator(`${DOCK} [data-testid="film-panel"]`).innerText()
  ).trim()
  await click(U)
  expect(
    h0 === 'Photos · 0 · 0 used' &&
      h0on === 'Photos · 0 of 0 · 0 used' &&
      empty0.startsWith('No photos yet'),
    `kit-sync KS13: empty book — head Photos · 0 · 0 used, Unplaced on → Photos · 0 of 0 · 0 used and the no-photos copy — ${JSON.stringify({ h0, h0on, empty0 })}`,
  ).toBe(true)
  // happy: add the folder, place one photo on the cover, Unplaced drops it and the head reads N of M
  await addFolder(page)
  const rows = () =>
    page
      .locator(`${DOCK} [data-testid="filmstrip"] [role="row"]`)
      .evaluateAll((rs) => rs.map((r) => (r as HTMLElement).dataset.key ?? ''))
  const all = await rows()
  const fy1 = await chipsAt(774)
  expect(
    Object.values(fy1).every((m) => m.ok),
    `design-r16 M88: with photos the chips sit at top 774 — text y Unplaced 780.0, Added order / Add folder… 780.5 (±0.5; was 779.59) — ${JSON.stringify(fy1)}`,
  ).toBe(true)
  await click(`${DEMO} [data-item="cover"]`)
  await page
    .locator(
      `${DOCK} [data-testid="filmstrip"] [role="row"][data-key="${all[0] ?? ''}"]`,
    )
    .dragTo(page.locator(`${DEMO} [data-testid="cover-front"]`))
  await settled(page)
  const used = Number(/(\d+) used/.exec(await head())?.[1])
  await click(U)
  const on = await rows()
  const hOn = await head()
  const pressed = await page.locator(U).getAttribute('aria-pressed')
  const bgOn = await page
    .locator(U)
    .evaluate((el) => getComputedStyle(el).backgroundColor)
  const uOn = await runY(U)
  expect(
    Math.abs(uOn.y - uOn.top - 6) <= 0.5,
    `design-r16 M88: Unplaced on keeps its text 6.0 below the chip top (±0.5) — ${JSON.stringify(uOn)}`,
  ).toBe(true)
  await click(U)
  const off = await rows()
  expect(
    all.length > 1 &&
      used === 1 &&
      !on.includes(all[0] ?? '') &&
      on.length === all.length - 1 &&
      hOn ===
        `Photos · ${String(all.length - 1)} of ${String(all.length)} · 1 used` &&
      off.length === all.length &&
      pressed === 'true',
    `kit-sync KS13: Unplaced on → the strip shows only unplaced photos, head Photos · N of M · K used; off → all photos again — ${JSON.stringify({ all: all.length, on: on.length, used, hOn, off: off.length, pressed })}`,
  ).toBe(true)
  expect(
    bgOn,
    'kit-sync KS13: Unplaced on = rgb(216, 214, 210) fill (prod .film-chip[data-selected])',
  ).toBe('rgb(216, 214, 210)')
  // interact: the sort menu opens above the chip with prod's options, Added order checked; File name relabels and re-sorts
  const label0 = await page.locator(SORT).getAttribute('aria-label')
  await click(SORT)
  const menu = await page
    .locator('[data-testid="film-sort-menu"]')
    .evaluate((m) => {
      const b = (m.closest('[data-placement]') ?? m).getBoundingClientRect()
      return {
        bottom: b.bottom,
        w: b.width,
        items: [...m.querySelectorAll('[role=menuitemradio]')].map(
          (i) =>
            `${i.textContent.trim()}${i.getAttribute('aria-checked') === 'true' ? '*' : ''}`,
        ),
      }
    })
    .catch(() => null)
  const chipTop = await page
    .locator(SORT)
    .evaluate((el) => el.getBoundingClientRect().top)
  expect(
    label0 === 'Sort photos: Added order' &&
      !!menu &&
      menu.bottom <= chipTop &&
      menu.w >= 160 &&
      menu.items.join('|') === 'Date taken|File name|Added order*',
    `kit-sync KS13: sort chip aria-label Sort photos: Added order; menu above the chip, ≥ 160 wide, Date taken · File name · Added order (checked) — ${JSON.stringify({ label0, menu, chipTop })}`,
  ).toBe(true)
  const bgc = (sel: string) =>
    page.locator(sel).evaluate((el) => {
      const s = getComputedStyle(el)
      return { bg: s.backgroundColor, c: s.color }
    })
  const openSt = await bgc(SORT)
  expect(
    openSt,
    'kit-sync KS13: sort chip stays transparent with text rgb(83, 81, 82) while its menu is open (prod .film-chip has no pressed fill)',
  ).toEqual({ bg: 'rgba(0, 0, 0, 0)', c: 'rgb(83, 81, 82)' })
  await page.getByRole('menuitemradio', { name: 'File name' }).click()
  await settled(page)
  const names = await page
    .locator(`${DOCK} [data-testid="filmstrip"] [role="row"]`)
    .evaluateAll((rs) =>
      rs.map((r) => r.getAttribute('aria-label') ?? r.textContent.trim()),
    )
  const label1 = ((await page.locator(SORT).textContent()) ?? '').trim()
  expect(
    label1 === 'File name' &&
      names.length === all.length &&
      names.every(
        (n, i) =>
          i === 0 ||
          (names[i - 1] ?? '').localeCompare(n, undefined, { numeric: true }) <=
            0,
      ),
    `kit-sync KS13: File name relabels the chip and sorts the strip by name — ${JSON.stringify({ label1, names: names.slice(0, 4) })}`,
  ).toBe(true)
  // hover: all three header chips fill rgb(216, 214, 210) with text rgb(57, 55, 56) (prod .film-chip:hover); Add folder… pressed too
  const hov: Record<string, { bg: string; c: string }> = {}
  for (const [name, sel] of [
    ['Unplaced', U],
    ['File name', SORT],
    ['Add folder…', A],
  ] as const) {
    await page.hover(sel)
    await settled(page)
    hov[name] = await bgc(sel)
  }
  await page.mouse.move(0, 0)
  await settled(page)
  expect(
    Object.values(hov).every(
      (s) => s.bg === 'rgb(216, 214, 210)' && s.c === 'rgb(57, 55, 56)',
    ),
    `kit-sync KS13: hover fills Unplaced · sort · Add folder… rgb(216, 214, 210), text rgb(57, 55, 56) — ${JSON.stringify(hov)}`,
  ).toBe(true)
  const ab = await box(page.locator(A))
  await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2)
  await page.mouse.down()
  await settled(page)
  const pressA = await bgc(A)
  await page.mouse.move(0, 0)
  await page.mouse.up()
  await settled(page)
  expect(
    pressA,
    'kit-sync KS13: Add folder… pressed fills rgb(216, 214, 210), text rgb(57, 55, 56)',
  ).toEqual({ bg: 'rgb(216, 214, 210)', c: 'rgb(57, 55, 56)' })
  // all placed: the gallery keeps only the cover photo → Unplaced on shows prod's all-placed copy
  await page.evaluate((id) => {
    const d = (window as unknown as { __demo: DemoApi }).__demo
    const b = d.state().books[0]
    if (!b) throw new Error('no book')
    b.doc = { ...b.doc, gallery: [id] }
    d.go('library')
  }, all[0] ?? '')
  await settled(page)
  await page.evaluate(() => {
    ;(window as unknown as { __demo: DemoApi }).__demo.go('editor')
  })
  await expect(page.locator(U)).toBeVisible()
  await settled(page)
  await click(U)
  const hAll = await head()
  const copyAll = (
    await page.locator(`${DOCK} [data-testid="film-panel"]`).innerText()
  ).trim()
  expect(
    hAll === 'Photos · 0 of 1 · 1 used' &&
      copyAll === 'Every photo is placed. Turn off “Unplaced” to see all.',
    `kit-sync KS13: every photo placed + Unplaced on → Photos · 0 of 1 · 1 used and “Every photo is placed. Turn off “Unplaced” to see all.” — ${JSON.stringify({ hAll, copyAll })}`,
  ).toBe(true)
  // kit-sync W5: no console errors
  expect(errs).toEqual([])
})

/* ---------------------------------------------------------------- Designer fill-book FB1 (kit) */
const POP = '[data-testid="fill-book-popover"]'
const title = (page: Page) =>
  page.locator(FB).evaluate((e) => e.parentElement?.getAttribute('title'))

/** spread rows in the spread list (p0, p1, …) */
const spreadRows = (page: Page) =>
  page
    .locator(`${DEMO} [data-item]`)
    .evaluateAll(
      (els) =>
        els.filter((e) => /^p\d+$/.test(e.getAttribute('data-item') ?? ''))
          .length,
    )

/**
 * Reshape the saved demo book and reopen the editor. The kit's new book has 10 spreads (20 pages, kit MIN_SPREADS), so the
 * Spec's prod "4-page book with 4 empty frames" becomes: 4 empty frames (spread 0: 1, spread 2: 2, spread 9: 1), other
 * spreads blank, `blank` extra blank spreads, the first `photos` photos in the gallery.
 */
async function shapeBook(
  page: Page,
  o: { photos: number; blank?: number; missing?: number },
) {
  await page.evaluate((o) => {
    const d = (window as unknown as { __demo: DemoApi }).__demo
    const b = d.state().books[0] as unknown as {
      doc?: {
        spreads: { id: string; frames: unknown[]; guides: unknown[] }[]
        gallery: string[]
      }
      missing?: string[]
    }
    if (!b.doc) throw new Error('no saved doc')
    const keep: Record<number, number> = { 0: 1, 2: 2, 9: 1 }
    const spreads = b.doc.spreads.map((s, i) => ({
      ...s,
      template: null,
      frames: s.frames.slice(0, keep[i] ?? 0),
    }))
    for (let i = 0; i < (o.blank ?? 0); i++)
      spreads.push({
        id: `fb-blank-${String(i)}`,
        template: null,
        frames: [],
        guides: [],
      })
    const gallery = b.doc.gallery.slice(0, o.photos)
    b.doc = { ...b.doc, spreads, gallery }
    b.missing = gallery.slice(0, o.missing ?? 0)
    d.go('library')
  }, o)
  await settled(page)
  await page.evaluate(() => {
    ;(window as unknown as { __demo: DemoApi }).__demo.go('editor')
  })
  await expect(page.locator(FB)).toBeVisible()
  await settled(page)
}

test('fill-book FB1 (#/demo): Fill book popover numbers, Enter fills, one Ctrl+Z restores, Esc / Masters / empty', async ({
  page,
}) => {
  const errs = watchErrors(page)
  await demoBook(page, 'Fill')
  // empty gallery: disabled in place, the reason as the wrapping span's title
  await expect(page.locator(FB)).toBeDisabled()
  expect(await title(page)).toBe('Add a folder of photos first')
  await addFolder(page)
  await shapeBook(page, { photos: 12 })
  await expect(page.locator(FB)).toBeEnabled()
  expect(await title(page)).toBe('Place the unplaced photos into the book')
  expect(await spreadRows(page)).toBe(10)

  // Esc closes with no change, focus back on the chip
  await page.locator(FB).click()
  await expect(page.locator(POP)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator(POP)).toHaveCount(0)
  await expect(page.locator(FB)).toBeFocused()
  expect(await spreadRows(page)).toBe(10)

  // open: 296 wide above the chip, focus on Fill book, the kit model's numbers
  await page.locator(FB).click()
  const pop = page.locator(POP)
  await expect(pop).toBeVisible()
  await settled(page)
  const [pb, cb] = await Promise.all([
    pop.boundingBox(),
    page.locator(FB).boundingBox(),
  ])
  expect(pb?.width, 'fill-book Popover: width 296').toBe(296)
  expect(
    pb && cb && Math.abs(pb.y + pb.height + 4 - cb.y) <= 1,
    `fill-book Popover: top end, offset 4 above the chip — ${JSON.stringify({ pb, cb })}`,
  ).toBe(true)
  await expect(pop.getByTestId('fill-book-confirm')).toBeFocused()
  await expect(pop.getByTestId('fill-book-order')).toHaveText(
    '12 unplaced photos, in Added order.',
  )
  await expect(pop.getByTestId('fill-book-frames')).toHaveText('4 photos')
  await expect(pop.getByTestId('fill-book-spreads')).toHaveText(
    '8 photos · 4 spreads',
  )
  await expect(pop.getByTestId('fill-book-pages')).toHaveText('20 → 28')
  await expect(pop.getByTestId('fill-book-left')).toHaveCount(0)
  await expect(pop.getByTestId('fill-book-missing')).toHaveCount(0)
  await expect(pop).toContainText('The cover and endpapers stay as they are.')

  // Enter = Fill book: 4 new spreads, every photo placed, status, the first changed spread active
  await page.keyboard.press('Enter')
  await expect(pop).toHaveCount(0)
  expect(await spreadRows(page)).toBe(14)
  await expect(D(page, '[data-testid="status"]')).toHaveText(
    'Placed 12 photos · added 4 spreads',
  )
  // r42 M153 (prod F11): the fill result paints as the status pill, not only the live region
  const pill = D(page, '[data-testid="status"]')
  expect((await pill.boundingBox())?.width ?? 0).toBeGreaterThan(100)
  expect(
    (await topAt(pill))[0],
    'M153: the status pill is the top paint',
  ).toContain('status')
  await expect(D(page, '[data-testid="placed-count"]')).toContainText('12 used')
  await expect(D(page, '[data-item="p0"]')).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.locator(FB)).toBeDisabled()
  expect(await title(page)).toBe('Every photo is placed')
  // the last new spread holds the 12th photo in Added order (pages read in photo order)
  const order = await D(
    page,
    '[data-testid="filmstrip"] [role="row"]',
  ).evaluateAll((rs) => rs.map((r) => r.getAttribute('data-key')))
  await D(page, '[data-item="p13"]').click()
  await settled(page)
  const lastSrc = await D(
    page,
    '[data-testid="canvas"] [data-spread="13"] [data-testid="frame"] img',
  )
    .last()
    .getAttribute('src')
  expect(
    lastSrc?.includes(`${order[11] ?? '?'}.jpg`),
    `fill-book F5: pages 26–27 end on the 12th photo in Added order — ${String(lastSrc)} vs ${JSON.stringify(order)}`,
  ).toBe(true)

  // one Ctrl+Z restores the book
  await page.locator(FB).focus()
  await page.keyboard.press('Control+z')
  expect(await spreadRows(page)).toBe(10)
  await expect(D(page, '[data-testid="placed-count"]')).toContainText('0 used')
  await expect(page.locator(FB)).toBeEnabled()

  // Masters mode disables the chip
  await D(page, '[data-testid="mode-seg"]').getByText('Masters').click()
  await expect(page.locator(FB)).toBeDisabled()
  expect(await title(page)).toBe('Switch to Pages to fill the book')
  expect(errs).toEqual([])
})

test('fill-book FB1 (#/demo): page limit warning, missing files skipped, nothing fits', async ({
  page,
}) => {
  await demoBook(page, 'Fill limit')
  await addFolder(page)
  // 10 + 49 blank spreads = 118 pages: room for one new spread (Generic prints up to 120)
  await shapeBook(page, { photos: 12, blank: 49, missing: 1 })
  await page.locator(FB).click()
  const pop = page.locator(POP)
  await expect(pop.getByTestId('fill-book-order')).toHaveText(
    '11 unplaced photos, in Added order.',
  )
  await expect(pop.getByTestId('fill-book-frames')).toHaveText('4 photos')
  await expect(pop.getByTestId('fill-book-spreads')).toHaveText(
    '2 photos · 1 spread',
  )
  await expect(pop.getByTestId('fill-book-pages')).toHaveText('118 → 120')
  await expect(pop.getByTestId('fill-book-missing')).toHaveText(
    '1 photo with missing files is skipped.',
  )
  await expect(pop.getByTestId('fill-book-left')).toHaveText(
    '5 photos stay in the filmstrip: Generic prints up to 120 pages.',
  )
  await expect(pop.getByTestId('fill-book-left')).toHaveCSS(
    'color',
    'rgb(132, 85, 16)',
  )
  await page.keyboard.press('Enter')
  await expect(D(page, '[data-testid="status"]')).toHaveText(
    'Placed 6 photos · added 1 spread · 5 stay in the filmstrip',
  )
  // the book is at 120 with no empty frames: nothing fits, confirm disabled
  await page.locator(FB).click()
  await expect(pop.getByTestId('fill-book-left')).toHaveText(
    'No empty frames, and the book is at 120 pages, the most Generic prints.',
  )
  await expect(pop.getByTestId('fill-book-frames')).toHaveCount(0)
  await expect(pop.getByTestId('fill-book-confirm')).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(pop).toHaveCount(0)
})
