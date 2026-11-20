import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit layout picker (moved from uikit/scripts/qa.mjs v0.7.1 layout-tile-states and the kit-sync
// W3 walk after KS12, uikit-qa-split-5): tile states, prod's tile grid, header + hint, Save as
// template / Contact sheet row, My templates, ••• on the hovered tile, page-1 templates and the
// page-1 selection. Every test also fails on a console error / warning, page error or failed
// request, like qa.mjs.

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

/** layout-tile-states: one tile's background, paper shadow / lift / easing, fill and grid columns */
function tileState(t: Element) {
  const thumb = t.querySelector('[data-testid="tpl-thumb"]')
  const p = t.querySelector('[data-testid="tpl-paper"]')
  const btn = t.querySelector('button')
  if (!thumb || !p || !btn || !t.parentElement) throw new Error('no tile parts')
  const th = thumb.getBoundingClientRect()
  const ps = getComputedStyle(p)
  const lifted = ps.translate !== 'none'
  const liftProp = lifted ? 'translate' : 'transform' // the lift eases only if the transition lists the property that moves
  return {
    bg: getComputedStyle(btn).backgroundColor,
    shadow: ps.boxShadow,
    lift: lifted ? ps.translate : ps.transform,
    eased:
      ps.transitionProperty.split(', ').includes(liftProp) &&
      parseFloat(ps.transitionDuration) > 0,
    fill: Math.abs(th.width - p.getBoundingClientRect().width) <= 1,
    cols: getComputedStyle(t.parentElement).gridTemplateColumns.split(' ')
      .length,
  }
}

test('screen canvas: layout-tile-states (Owner 2026-11-02) — the tile stays transparent, hover rings the paper, the paper fills a trim-shaped box, page 1 goes 3 columns', async ({
  page,
}) => {
  const errs = watchErrors(page)
  await page.goto('/uikit/#/screen/canvas')
  await expect(page.getByTestId('demo')).toBeVisible()
  await settled(page)
  const E = (s: string) => D(page, `[data-testid="editor7"] ${s}`)
  const tile = () =>
    E('[data-testid="layout-section"] [data-testid="tpl-tile"]').nth(1)
  const read = () => tile().evaluate(tileState)
  const open = async (k: string) => {
    await E(`[data-item="${k}"]`).scrollIntoViewIfNeeded()
    await E(`[data-item="${k}"]`).click()
    await settled(page)
  }
  await open('p3')
  const spread = await read()
  await tile().locator('button').hover()
  await settled(page)
  const hover = await read()
  await open('p0')
  const page1 = await read()
  expect(
    spread.cols === 2 &&
      spread.fill &&
      page1.cols === 3 &&
      page1.fill &&
      hover.bg === 'rgba(0, 0, 0, 0)' &&
      hover.shadow.includes('rgba(0, 0, 0, 0.22) 0px 0px 0px 1px') &&
      hover.lift !== 'none' &&
      hover.eased,
    JSON.stringify({ spread, hover, page1 }),
  ).toBe(true)
  expect(errs).toEqual([])
})

interface DemoApi {
  reset: () => void
}

const SEC = `${DEMO} [data-testid="layout-section"]`

/** KS7: the layout section measured without the scrollbar gutter (Spec / prod numbers have none) */
function pickState(sec: string) {
  const s = document.querySelector(sec)
  const grid = s?.querySelector('[data-testid="tpl-grid"]')
  const hintEl = s?.querySelector('[data-testid="tpl-hint"]')
  if (!s || !grid || !hintEl) throw new Error('no layout section')
  const scroller = s.closest<HTMLElement>('.overflow-y-auto')
  if (scroller) scroller.style.scrollbarWidth = 'none'
  const tiles = [...s.querySelectorAll<HTMLElement>('[data-testid="tpl-tile"]')]
  const pressed = s.querySelector<HTMLElement>(
    '[data-testid="tpl-tile"] button[aria-pressed="true"]',
  )
  const h = tiles
    .filter((t) => !(t.dataset.tid ?? '').startsWith('c-'))
    .map((t) => +t.getBoundingClientRect().height.toFixed(2))
  if (scroller) scroller.style.scrollbarWidth = ''
  return {
    h,
    cols: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
    ids: tiles.map((t) => t.dataset.tid ?? ''),
    slots: tiles.map(
      (t) =>
        t.querySelectorAll('[data-testid="tpl-paper"] > div:not(.w-px)').length,
    ),
    captions: tiles
      .filter((t) => t.querySelector('[data-testid="tpl-name"]'))
      .map((t) => t.dataset.tid ?? ''),
    titles: tiles.every((t) => {
      const b = t.querySelector('button')
      return (
        !!b &&
        !!b.title &&
        b.getAttribute('aria-label') === `Apply layout ${b.title}`
      )
    }),
    note: document.querySelector('[data-testid="section-note"]')?.textContent,
    pressed: pressed?.title,
    search: s.querySelectorAll('input[type=search], [role=searchbox]').length,
    heads: /Suggested for|All layouts/.test(s.textContent),
    hint: hintEl.textContent,
    hintBelow:
      hintEl.getBoundingClientRect().top >= grid.getBoundingClientRect().bottom,
  }
}

/** r15 M86–M88 (prod LayoutSection is the reference): first text run of an element, measured without the scrollbar gutter */
function r15State(sec: string) {
  const s = document.querySelector(sec)
  if (!s) throw new Error('no layout section')
  const scroller = s.closest<HTMLElement>('.overflow-y-auto')
  if (scroller) scroller.style.scrollbarWidth = 'none'
  const run = (el: Element | null) => {
    if (!el) throw new Error('no element')
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let n = w.nextNode()
    while (n && !n.textContent?.trim()) n = w.nextNode()
    if (!n) throw new Error('no text run')
    const g = document.createRange()
    g.selectNodeContents(n)
    const b = g.getBoundingClientRect()
    return { x: +b.x.toFixed(2), y: +b.y.toFixed(2) }
  }
  const save = s.querySelector('[data-testid="tpl-save-button"]')
  const svg = save?.querySelector('svg')
  if (!save || !svg) throw new Error('no Save as template icon')
  const icon = svg.getBoundingClientRect()
  const out = {
    icon: [icon.width, icon.height],
    saveX: run(save).x,
    mineX: run(s.querySelector('[data-testid="tab-mine"]')).x,
    chipDy: [...s.querySelectorAll('[data-chip]')].map(
      (b) => +(run(b).y - b.getBoundingClientRect().top).toFixed(2),
    ),
  }
  if (scroller) scroller.style.scrollbarWidth = ''
  return out
}

/** KS7: the Contact sheet row under Save as template */
function contactRow(sec: string) {
  const s = document.querySelector(sec)
  const g = s?.querySelector('[role=group][aria-label="Contact sheet"]')
  const save = s?.querySelector('[data-testid="tpl-save-button"]')
  const apply = g?.querySelector('[data-testid="tpl-contact-apply"]')
  if (!g || !save || !apply) return null
  const b = apply.getBoundingClientRect()
  return {
    inputs: [...g.querySelectorAll('input')].map((i) => {
      const r = i.getBoundingClientRect()
      return `${i.closest('[aria-label]')?.getAttribute('aria-label') ?? i.getAttribute('aria-label') ?? ''}=${i.value} ${String(r.width)}x${String(r.height)}`
    }),
    below: g.getBoundingClientRect().top >= save.getBoundingClientRect().bottom,
    right: b.right,
    saveRight: save.getBoundingClientRect().right,
    btn: apply.textContent,
    shadows: [save, apply].map((e) => getComputedStyle(e).boxShadow),
  }
}

interface Rect {
  left: number
  right: number
  top: number
  bottom: number
  width: number
}

const inside = (boxes: Rect[], o: Rect) =>
  boxes.every(
    (r) =>
      r.left >= o.left + o.width / 2 - 1 &&
      r.right <= o.right + 1 &&
      r.top >= o.top - 1 &&
      r.bottom <= o.bottom + 1,
  )

const near = (a: number | null | undefined, b: number) =>
  a != null && Math.abs(a - b) <= 1

test('kit-sync W3 (#/demo, Designer kit-sync Spec 7 = prod): layout picker — tiles, header, Save / Contact sheet row, My templates, ••• hover, page 1 templates and selection', async ({
  page,
}) => {
  // kit-sync W3 walk: fresh #/demo, library, book "Lake trip", a photo folder, a photo on spread p1, the frame picked
  const errs = watchErrors(page)
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: DemoApi }).__demo.reset()
  })
  const c = async (sel: string) => {
    await page.locator(sel).first().click()
    await settled(page)
  }
  await c('[data-testid="create-library"]')
  await c('[data-testid="picker-select"]')
  await c(`${DEMO} [data-testid="new-book"]`)
  await page.locator('[role=dialog] input').first().fill('Lake trip')
  await c('[data-testid="create-book"]')
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await c('[data-testid="demo-add-folder"]')
  await page
    .locator('[role=dialog]')
    .getByRole('button', { name: /Choose|Select|Use|Add/i })
    .last()
    .click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await settled(page)
  await c('[data-item="p1"]')
  await page
    .locator('[data-testid="filmstrip"] [role="row"]')
    .nth(5)
    .dragTo(
      page.locator('[data-testid="canvas"] [data-testid="frame"]').first(),
    )
  await settled(page)
  // the drop selected the frame; its centre is the direct-crop grabber now, which takes the click
  await page
    .locator('[data-testid="canvas"] [data-testid="frame"]')
    .first()
    .click({ force: true })
  await c('[data-testid="book-title"]')
  await D(page, '[data-testid="size-preset"]').selectOption('sq20') // a 2:1 spread: prod's tile h 69.5
  await settled(page)
  await c('[data-item="p1"]')
  // Spec / prod numbers are taken without a scrollbar gutter (demo-capture hides scrollbars; qa shows them): drop it while measuring
  const pick = await page.evaluate(pickState, SEC)
  expect(
    pick.h.length > 0 &&
      pick.h.every((h) => near(h, 69.5)) &&
      pick.cols === 2 &&
      pick.titles &&
      pick.captions.every((id) => id.startsWith('c-')) &&
      pick.captions.length === 3,
    `kit-sync KS7: builtin tiles h 69.5 (2:1 spread), 2 columns, no caption (tooltip + aria-label), saved templates keep theirs — ${JSON.stringify({ h: pick.h.slice(0, 4), cols: pick.cols, captions: pick.captions })}`,
  ).toBe(true)
  expect(
    pick.slots.every((n, i) => i === 0 || n >= (pick.slots[i - 1] ?? 0)) &&
      !pick.ids.includes('t-2port') &&
      pick.ids.includes('t-pair') &&
      pick.search === 0 &&
      !pick.heads,
    `kit-sync KS7: one list by photo count, Two portraits merged into One per page, no search / Suggested / All layouts — ${JSON.stringify({ ids: pick.ids, slots: pick.slots })}`,
  ).toBe(true)
  expect(
    pick.note === `· ${String(pick.pressed)}` &&
      pick.hintBelow &&
      pick.hint ===
        'Hover a layout to preview it on the spread; click to apply. Photos are kept in order.',
    `kit-sync KS7: header LAYOUT · <current name>; hint under the tiles — note ${String(pick.note)} pressed ${String(pick.pressed)}`,
  ).toBe(true)
  const m86 = await page.evaluate(r15State, SEC)
  expect(
    m86.icon.join() === '14,14' && Math.abs(m86.saveX - 1247.06) <= 0.5,
    `design-r16 M86: Save as template icon 14 × 14 (prod <Icon size={14}>, was 24), label x 1247.06 (±0.5, was 1252.06) — ${JSON.stringify(m86)}`,
  ).toBe(true)
  expect(
    Math.abs(m86.mineX - 1308.56) <= 0.5,
    `design-r16 M87: All / My templates — one space before the count, “My templates” label x 1308.56 (±0.5, was 1305.41) — ${String(m86.mineX)}`,
  ).toBe(true)
  expect(
    m86.chipDy.length > 0 && m86.chipDy.every((d) => Math.abs(d - 4.5) <= 0.5),
    `design-r16 M88: Layout Photos chips — text 4.5 below the pill top (±0.5, prod .layout-chip line-height normal: 76.75 at top 72.25; was 3.59) — ${JSON.stringify(m86.chipDy)}`,
  ).toBe(true)
  const row = await page.evaluate(contactRow, SEC)
  await c(`${SEC} [data-testid="tpl-contact-apply"]`)
  const applied = {
    note: await D(page, '[data-testid="section-note"]').textContent(),
    frames: await D(
      page,
      '[data-testid="spread"][data-current] [data-testid="frame"]',
    ).count(),
  }
  expect(
    !!row &&
      row.below &&
      row.inputs.join() === 'Columns=3 44x32,Rows=2 44x32' &&
      row.btn === 'Contact sheet' &&
      near(row.right, row.saveRight) &&
      applied.note === '· Contact sheet 3×2' &&
      applied.frames === 12,
    `kit-sync KS7: Contact sheet row under Save as template — Columns 3 × Rows 2 (44×32) + Contact sheet at the right edge; applies 3×2 — ${JSON.stringify({ row, applied })}`,
  ).toBe(true)
  expect(
    !!row &&
      row.shadows.every((s) =>
        s.endsWith('rgba(20, 20, 19, 0.06) 0px 1px 2px 0px'),
      ),
    `kit-sync KS7: Save as template + Contact sheet buttons carry shadow-xs (prod 0 1px 2px rgba(20,20,19,.06)) — ${JSON.stringify(row?.shadows)}`,
  ).toBe(true)
  await c(`${SEC} [data-testid="tab-mine"]`)
  await c(`${SEC} [data-chip="4"]`)
  const empty = await page
    .locator(`${SEC} [data-testid="tpl-empty"]`)
    .textContent()
    .catch(() => null)
  expect(
    empty?.trim() === 'No layouts match.',
    `kit-sync KS7: My templates + 4+ → empty state — ${String(empty)}`,
  ).toBe(true)
  const m87 = await page.evaluate(r15State, SEC)
  expect(
    Math.abs(m87.mineX - 1308.56) <= 0.5 &&
      m87.chipDy.every((d) => Math.abs(d - 4.5) <= 0.5),
    `design-r16 M87/M88: My templates selected + 4+ chip on — label x stays 1308.56, chip text stays 4.5 below the pill top (±0.5) — ${JSON.stringify(m87)}`,
  ).toBe(true)
  await c(`${SEC} [data-chip="all"]`)
  // Designer review UT4: ••• follows the hovered tile (group/cell), not the pointer anywhere in the section
  const tiles = page.locator(`${SEC} [data-testid="tpl-tile"]`)
  const menuOps = async (target: ReturnType<Page['locator']>) => {
    await target.hover()
    await settled(page)
    return tiles.evaluateAll((ts) =>
      ts.map((t) => {
        const m = t.querySelector('[data-testid="tpl-menu"]')
        if (!m) throw new Error('no ••• menu')
        return +getComputedStyle(m).opacity
      }),
    )
  }
  const onSave = await menuOps(
    page.locator(`${SEC} [data-testid="tpl-save-button"]`),
  )
  const onT1 = await menuOps(tiles.nth(0).locator('button').first())
  const onT2 = await menuOps(tiles.nth(1).locator('button').first())
  const only = (i: number) =>
    JSON.stringify(onSave.map((_, j) => Number(j === i)))
  expect(
    onSave.length >= 2 &&
      onSave.every((o) => o === 0) &&
      JSON.stringify(onT1) === only(0) &&
      JSON.stringify(onT2) === only(1),
    `user-templates UT4: ••• shows on the hovered tile only — pointer on Save → all 0, tile 1 → [1,0,…], tile 2 → [0,1,…] — ${JSON.stringify({ onSave, onT1, onT2 })}`,
  ).toBe(true)
  await c('[data-item="p0"]')
  // Designer spec user-templates UT1/UT2/UT4: page 1 lists no two-page template; Save on page 1 adds one, a second Save flashes it
  const tabMine = () =>
    page.locator(`${SEC} [data-testid="tab-mine"]`).textContent()
  const p0Empty = await page
    .locator(`${SEC} [data-testid="tpl-empty"]`)
    .textContent()
    .catch(() => null)
  const mine0 = await tabMine()
  expect(
    mine0 === 'My templates 0' &&
      p0Empty?.trim() === 'No templates yet. Save a page you like.',
    `user-templates UT1: page 1 → My templates 0, “No templates yet. Save a page you like.” — ${String(mine0)} / ${String(p0Empty)}`,
  ).toBe(true)
  // the header + sits in the Section head, outside layout-section
  const saveOff = await page.evaluate(
    ([demo, sec]) =>
      [
        ...document.querySelectorAll(
          `${demo} [data-testid="tpl-save"], ${sec} [data-testid="tpl-save-button"]`,
        ),
      ].map(
        (b) => b.hasAttribute('disabled') || b.hasAttribute('data-disabled'),
      ),
    [DEMO, SEC] as const,
  )
  const p0Photos = await D(
    page,
    '[data-testid="spread"][data-current] [data-testid="frame"]',
  ).count()
  expect(
    saveOff.length === 2 && saveOff.every((d) => d === (p0Photos === 0)),
    `user-templates UT4: both Save controls are enabled exactly when the spread has image frames — ${JSON.stringify({ saveOff, p0Photos })}`,
  ).toBe(true)
  // qa.mjs ran the page-1 save checks only when page 1 has image frames; the walk always gives it some
  expect(p0Photos, 'page 1 has image frames').toBeGreaterThan(0)
  await c(`${SEC} [data-testid="tpl-save-button"]`)
  await page.keyboard.press('Enter')
  await settled(page)
  await page.mouse.move(5, 895)
  await settled(page)
  const p0Tile = await page.evaluate((sec) => {
    const t = document.querySelector(`${sec} [data-testid="tpl-tile"]`)
    const paper = t?.querySelector('[data-testid="tpl-paper"]')
    const m = t?.querySelector('[data-testid="tpl-menu"]')
    if (!t || !paper || !m) return null
    const p = paper.getBoundingClientRect()
    return {
      aspect: +(p.width / p.height).toFixed(3),
      slots: t.querySelectorAll('[data-testid="tpl-paper"] > div').length,
      menu: getComputedStyle(m).opacity,
    }
  }, SEC)
  expect(
    (await tabMine()) === 'My templates 1' &&
      p0Tile?.slots === p0Photos &&
      p0Tile.menu === '0',
    `user-templates UT1/UT4: page 1 save → My templates 1 on page 1, page-shaped thumb, ••• hidden at rest (opacity 0) — ${JSON.stringify(p0Tile)}`,
  ).toBe(true)
  await c(`${DEMO} [data-testid="tpl-save"]`)
  const flashed = await page
    .locator(`${SEC} [data-testid="tpl-tile"][data-flash]`)
    .count()
  const status = await D(page, '[data-testid="status"]').allTextContents()
  expect(
    (await tabMine()) === 'My templates 1' &&
      flashed === 1 &&
      status.some((s) => /Already in My templates as “My layout \d+”/.test(s)),
    `user-templates UT2: a second Save adds nothing and flashes the tile; status “Already in My templates as …” — ${JSON.stringify({ flashed, status })}`,
  ).toBe(true)
  await expect(
    page.locator(`${SEC} [data-testid="tpl-tile"][data-flash]`),
    'user-templates UT2: the flash ends after 1200 ms',
  ).toHaveCount(0, { timeout: 1300 })
  await c(`${SEC} [role=tab]:not([data-testid="tab-mine"])`)
  const cols1 = await page
    .locator(`${SEC} [data-testid="tpl-grid"]`)
    .first()
    .evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length)
    .catch(() => null)
  expect(cols1, 'kit-sync KS7: single page (page 1) → 3 columns').toBe(3)
  // prod counts only the frames on that page (LayoutSection.tsx:207): sort and the Photos chips follow the tile
  await c(`${SEC} [role=tab]:not([data-testid="tab-mine"])`)
  const tids = () =>
    page
      .locator(`${SEC} [data-testid="tpl-tile"]`)
      .evaluateAll((ts) => ts.map((t) => (t as HTMLElement).dataset.tid ?? ''))
  // built-ins only: the kit's sample saved templates have no prod twin
  const p1Order = (
    await page
      .locator(
        `${SEC} [data-testid="tpl-tile"]:not([data-tid^="c-"]) button[title]`,
      )
      .evaluateAll((bs) => bs.map((b) => (b as HTMLElement).title))
  ).slice(0, 7)
  const chipIds = async (n: string) => {
    await c(`${SEC} [data-chip="${n}"]`)
    return (await tids()).filter((id) => !id.startsWith('c-')).join()
  }
  const p1One = await chipIds('1')
  const p1Two = await chipIds('2')
  const p1Three = await chipIds('3')
  await c(`${SEC} [data-chip="all"]`)
  expect(
    p1Order.join('|') ===
      'Full bleed|One per page|Panorama|Framed single|Offset pair|Two portraits|Hero + two' &&
      p1One === 't-full,t-pair,t-pano,t-margin',
    `kit-sync KS7: page 1 lays each template out in the page (prod generateTemplateFrames) — order = prod, "1" chip shows 4 built-ins — ${JSON.stringify({ p1Order, p1One })}`,
  ).toBe(true)
  expect(
    p1Two === 't-offset,t-2port' && p1Three === 't-hero2,t-three,t-land2port',
    `kit-sync KS7: page 1 "2" chip = Offset pair, Two portraits; "3" chip = Hero + two, Three across, Landscape + 2 portraits — ${JSON.stringify({ p1Two, p1Three })}`,
  ).toBe(true)
  // tile, hover preview and canvas agree on page 1: same frame count, every frame inside the right page (none clipped at the page edge)
  const hero = `${SEC} [data-testid="tpl-tile"][data-tid="t-hero2"]`
  const tile = await page
    .locator(`${hero} [data-testid="tpl-paper"]`)
    .evaluate((p) => {
      const o = p.getBoundingClientRect()
      return [...p.children]
        .map((f) => f.getBoundingClientRect())
        .every((r) => r.left >= o.left - 1 && r.right <= o.right + 1)
        ? p.children.length
        : -1
    })
  await page.locator(`${hero} button`).hover()
  await settled(page)
  const prev = await D(page, '[data-testid="tpl-preview"]')
    .first()
    .evaluate((o) => ({
      o: o.getBoundingClientRect().toJSON() as Rect,
      boxes: [...o.querySelectorAll('.outline-dashed')].map(
        (b) => b.getBoundingClientRect().toJSON() as Rect,
      ),
    }))
    .catch(() => null)
  await c(`${hero} button`)
  const cv = await D(page, '[data-testid="spread"][data-current]')
    .first()
    .evaluate((s) => ({
      o: s.getBoundingClientRect().toJSON() as Rect,
      boxes: [...s.querySelectorAll('[data-testid="frame"]')].map(
        (f) => f.getBoundingClientRect().toJSON() as Rect,
      ),
    }))
    .catch(() => null)
  const note1 = await D(page, '[data-testid="section-note"]')
    .textContent()
    .catch(() => null)
  expect(
    tile === 3 &&
      !!prev &&
      prev.boxes.length === 3 &&
      inside(prev.boxes, prev.o) &&
      !!cv &&
      cv.boxes.length === 3 &&
      inside(cv.boxes, cv.o) &&
      note1 === '· Hero + two',
    `kit-sync KS7: page 1 Hero + two — tile, hover preview and canvas all show 3 frames inside the page — ${JSON.stringify({ tile, preview: prev?.boxes.length, prevInside: prev && inside(prev.boxes, prev.o), canvas: cv?.boxes.length, canvasInside: cv && inside(cv.boxes, cv.o), note1 })}`,
  ).toBe(true)
  // kit-thumbgrid-page-select: page 1 stores t-hero2@page; its base tile is the selected one (box-shadow = the shadow-tile-select token)
  const sel1 = await page.locator(hero).evaluate((t) => {
    const q = document.createElement('div')
    q.className = 'shadow-tile-select'
    document.body.append(q)
    const want = getComputedStyle(q).boxShadow
    q.remove()
    const paper = t.querySelector('[data-testid="tpl-paper"]')
    if (!paper) throw new Error('no tile paper')
    return {
      pressed: [
        ...document.querySelectorAll<HTMLElement>(
          '[data-testid="tpl-tile"] button[aria-pressed="true"]',
        ),
      ].map((b) => b.closest<HTMLElement>('[data-tid]')?.dataset.tid ?? ''),
      shadow: getComputedStyle(paper).boxShadow,
      want,
    }
  })
  expect(
    sel1.pressed.join() === 't-hero2' &&
      sel1.shadow === sel1.want &&
      sel1.want !== 'none',
    `kit-thumbgrid-page-select: page 1 Hero + two (t-hero2@page) → only the t-hero2 tile pressed, paper box-shadow = shadow-tile-select — ${JSON.stringify(sel1)}`,
  ).toBe(true)
  // kit-sync W3: no console errors
  expect(errs).toEqual([])
})
