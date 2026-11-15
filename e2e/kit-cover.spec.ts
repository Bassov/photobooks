import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit cover (moved from uikit/scripts/qa.mjs kit-sync W4 and cover-editor, uikit-qa-split-5):
// the #/demo cover inspector rows, selects and read-only rows (= prod), and the printed cover
// sheet geometry on #/full/cover-editor. Every test also fails on a console error / warning,
// page error or failed request, like qa.mjs (qa.mjs runs with scrollbars shown, so these specs
// do too: Book settings scrolls in W4).

test.use({
  viewport: { width: 1440, height: 900 },
  // qa.mjs Chrome: scrollbars shown, unhinted (fractional) text widths
  launchOptions: {
    ignoreDefaultArgs: ['--hide-scrollbars'],
    args: ['--font-render-hinting=none'],
  },
})

const DEMO = '[data-testid="demo"]'

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

interface DemoApi {
  reset: () => void
}

/** text-node box of the first `sel` whose text is `t` (Spec measures glyph runs, not padded pills) */
const textBox = (page: Page, sel: string, t: string) =>
  page.evaluate(
    ([sel, t]) => {
      const e = [...document.querySelectorAll(sel)].find(
        (x) => x.textContent.trim().toLowerCase() === t.toLowerCase(),
      )
      if (!e) return null
      const g = document.createRange()
      g.selectNodeContents(e)
      const b = g.getBoundingClientRect()
      return { x: b.x, top: b.top }
    },
    [sel, t] as const,
  )

const near = (a: number | null | undefined, b: number) =>
  a != null && Math.abs(a - b) <= 1

test('kit-sync W4 (#/demo, Designer kit-sync Spec 9–11 = prod): cover inspector row tops, front thumb, selects, editable Cover, read-only rows', async ({
  page,
}) => {
  // kit-sync W4 walk: fresh #/demo, library, book "Lake trip", the cover
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
  await c('[data-item="cover"]')
  // cover-editor "Inspector": the print-profile hint under Spine width (6 + 16.8 px) moves Direction and below down 22.8 px (prod item cover-editor follows)
  const TOPS = {
    'Title font': 285.44,
    Spine: 343.86,
    'Spine width': 415.7,
    Direction: 473.35,
    Back: 527.19,
    Fill: 603.03,
    Material: 656.88,
    Finish: 741.3,
  }
  const tops: Record<string, number | undefined> = {}
  for (const t of Object.keys(TOPS))
    tops[t] = (
      await textBox(page, '[data-testid="insp-cover"] :is(h3, span)', t)
    )?.top
  expect(
    Object.entries(TOPS).every(([t, v]) => near(tops[t], v)),
    `kit-sync KS10: cover inspector row tops = prod (±1) — ${JSON.stringify(tops)}`,
  ).toBe(true)
  // r15 M90 (prod .cover-thumb 2.625 × 3.25 rem, flex none): the front thumb keeps 42 × 52, its copy starts 12 px right of it
  const th = await page
    .locator(`${DEMO} [data-testid="cover-front-thumb"]`)
    .evaluate((e) => {
      const b = e.getBoundingClientRect()
      return { w: b.width, h: b.height, right: b.right }
    })
  const np = await textBox(
    page,
    '[data-testid="insp-cover"] div',
    'No photo yet',
  )
  const dg = await textBox(
    page,
    '[data-testid="insp-cover"] div',
    'Drag a photo from the filmstrip onto the cover',
  )
  expect(
    th.w === 42 &&
      th.h === 52 &&
      near(np?.x, 1210) &&
      near(dg?.x, 1210) &&
      Math.abs((np?.x ?? NaN) - th.right - 12) <= 0.5,
    `r15 M90: cover front thumb 42 × 52 (no shrink), «No photo yet» / «Drag a photo…» at x 1210 (thumb right + 12) — thumb ${JSON.stringify(th)} copy ${String(np?.x)} / ${String(dg?.x)}`,
  ).toBe(true)
  const sels = await page
    .locator(`${DEMO} [data-testid="insp-cover"] select`)
    .evaluateAll((els) =>
      els.map((e) => {
        const b = e.getBoundingClientRect()
        const cs = getComputedStyle(e)
        return {
          l: e.getAttribute('aria-label') ?? '',
          x: b.x,
          w: b.width,
          h: b.height,
          right: b.right,
          r: cs.borderRadius,
          bg: cs.backgroundColor,
          chev:
            cs.backgroundImage.includes('svg') &&
            cs.backgroundSize === '16px 16px',
        }
      }),
    )
  const SELS: Record<string, [number, number]> = {
    'Title font': [1318, 106],
    Cover: [1309, 115],
    Finish: [1289, 135],
  }
  expect(
    sels.length === 3 &&
      sels.every((s) => {
        const want = SELS[s.l]
        return (
          !!want &&
          near(s.x, want[0]) &&
          near(s.w, want[1]) &&
          s.h === 36 &&
          s.r === '8px' &&
          s.bg === 'rgb(215, 215, 215)' &&
          s.chev &&
          near(s.right, 1424)
        )
      }),
    `kit-sync KS10: Title font / Cover / Finish are selects h 36, r 8, #D7D7D7, chevron 16, right edge 1424 — ${JSON.stringify(sels)}`,
  ).toBe(true)
  await page
    .locator(`${DEMO} [data-testid="cover-material"]`)
    .selectOption('Linen')
  expect(
    (await page
      .locator(`${DEMO} [data-testid="cover-material"]`)
      .inputValue()) === 'Linen' &&
      (await page
        .locator(`${DEMO} [data-testid="material-readonly"]`)
        .count()) === 0,
    'kit-sync KS10: Cover is editable (no coming-later note)',
  ).toBe(true)
  const pw = await textBox(page, '[data-testid="insp-cover"] span', '#3E3C3B')
  await c('[data-testid="book-title"]')
  const hc = await textBox(page, '[data-testid="insp-book"] span', 'Hardcover')
  // page-numbers-kit: the Page numbers section makes Book settings taller than the 900 px viewport, so its 10 px scrollbar shifts Hardcover left
  // cover-back-fill: the Back Fill row is a swatch + "#3E3C3B" (no pill, no note), flush right
  expect(
    near(pw?.x, 1347.86) && near(hc?.x, 1285.45),
    `kit-sync KS10: read-only rows flush right — Back fill swatch x 1347.86, Hardcover x 1285.45 (Book settings scrolls) — fill ${String(pw?.x)} hardcover ${String(hc?.x)}`,
  ).toBe(true)
  expect(errs).toEqual([])
})

const S = '[data-scenario]'

interface Box {
  x: number
  y: number
  w: number
  h: number
  r: number
  b: number
}

/** the cover sheet geometry of the current #/full/cover-editor scenario */
function coverGeo(S: string) {
  const r = (id: string) => {
    const e = document.querySelector(`${S} [data-testid="${id}"]`)
    if (!e) return null
    const b = e.getBoundingClientRect()
    return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom }
  }
  const t = document.querySelector(`${S} [data-testid="cover-spine-text"]`)
  const labels = [
    ...document.querySelectorAll(`${S} [data-testid="page-labels"] span`),
  ].map((s) => [s.textContent, s.getBoundingClientRect().top] as const)
  const veil = document.querySelector(`${S} [data-testid="cover-wrap"]`)
  const photo = document.querySelector(
    `${S} [data-testid="cover-front"] .cover-front-photo`,
  )
  return {
    sheet: r('cover-sheet'),
    cover: r('canvas-cover'),
    spine: r('cover-spine'),
    text: r('cover-spine-text'),
    hb: r('cover-hinge-back'),
    hf: r('cover-hinge-front'),
    sb: r('cover-safe-back'),
    sf: r('cover-safe-front'),
    chip: r('cover-wrap-chip'),
    front: r('cover-front'),
    photo: photo?.getBoundingClientRect().toJSON() as
      { x: number; top: number; right: number; bottom: number } | undefined,
    labels,
    veilPe: veil && getComputedStyle(veil).pointerEvents,
    veilN: veil?.children.length,
    ell: t && getComputedStyle(t).textOverflow,
    clip: t && t.scrollWidth > t.clientWidth,
    sub: document.querySelector(`${S} [data-testid="cover-head-sub"]`)
      ?.textContent,
    sw: document.querySelector(`${S} [data-testid="cover-spine-width"]`)
      ?.textContent,
    hint: document.querySelector(`${S} [data-testid="cover-spine-hint"]`)
      ?.textContent,
  }
}

/** every box the cover-editor checks read must be there */
function boxes(g: ReturnType<typeof coverGeo>) {
  const need = { ...g }
  for (const k of ['sheet', 'cover', 'spine', 'text'] as const)
    if (!need[k]) throw new Error(`no ${k}`)
  return need as typeof g & Record<'sheet' | 'cover' | 'spine' | 'text', Box>
}

const n5 = (a: number | null | undefined, b: number) =>
  a != null && Math.abs(a - b) <= 0.5
const cx = (b: Box) => b.x + b.w / 2
const cy = (b: Box) => b.y + b.h / 2
const centred = (g: { text: Box; spine: Box }) =>
  n5(cx(g.text), cx(g.spine)) && n5(cy(g.text), cy(g.spine))

test('cover-editor (Designer cover-editor Geometry / Layers / Spine text / Inspector): the printed cover sheet at 1440 × 900, 19 × 23 cm', async ({
  page,
}) => {
  const errs = watchErrors(page)
  await page.goto('/uikit/#/full/cover-editor')
  await expect(page.locator(S).first()).toBeVisible()
  await settled(page)
  const top = await page
    .locator(S)
    .first()
    .evaluate((e) => e.getBoundingClientRect().top)
  await page.setViewportSize({ width: 1440, height: 900 + top })
  await settled(page)
  const pick = async (l: string) => {
    await page
      .locator(`[data-testid="scenarios"] [role="tab"]:text-is("${l}")`)
      .evaluate((t: HTMLElement) => {
        t.click()
      })
    await settled(page)
  }
  const geo = () => page.evaluate(coverGeo, S)
  await pick('New cover')
  const e = await geo()
  expect(
    !!e.sheet &&
      !!e.hb &&
      !!e.hf &&
      !!e.sb &&
      !!e.sf &&
      e.veilN === 4 &&
      e.veilPe === 'none' &&
      !!e.chip &&
      !e.photo,
    `cover-editor: empty cover — sheet, hinges, safe frames, 4-strip veil (pointer-events none) and chip; no photo layer — ${JSON.stringify({ veil: e.veilN, pe: e.veilPe, photo: !!e.photo })}`,
  ).toBe(true)
  await pick('Photo + title')
  const g = boxes(await geo())
  const wrap = g.cover.x - g.sheet.x
  expect(
    n5(g.sheet.w, 848) &&
      n5(g.sheet.h, 522.47) &&
      n5(g.cover.w, 787.73) &&
      n5(g.cover.h, 462.18) &&
      n5(g.spine.w, 24.11) &&
      n5(wrap, 30.14) &&
      n5(g.cover.y - g.sheet.y, 30.14) &&
      n5(g.hb?.w, 16.08) &&
      n5(g.hb?.r, g.spine.x) &&
      n5(g.hf?.x, g.spine.r),
    `cover-editor: 20 pages — sheet 848 × 522.47, cover 787.73 × 462.18, spine 24.11, wrap 30.14, hinge 16.08 px (±0.5) — ${JSON.stringify({ sheet: [g.sheet.w, g.sheet.h], cover: [g.cover.w, g.cover.h], spine: g.spine.w, wrap, hinge: g.hb?.w })}`,
  ).toBe(true)
  expect(
    !!g.sb &&
      !!g.sf &&
      !!g.chip &&
      n5(g.sb.x - g.sheet.x, 40.19) &&
      n5(g.sb.y - g.sheet.y, 40.19) &&
      n5(g.sb.w, 355.68) &&
      n5(g.sb.h, 442.08) &&
      n5(g.sf.x - g.sheet.x, 452.13) &&
      n5(g.sf.w, 355.68) &&
      n5(g.sheet.r - g.chip.r, 8) &&
      n5(g.chip.y - g.sheet.y, (wrap - 14) / 2),
    `cover-editor: safe frames 355.68 × 442.08 at sheet + (40.19, 40.19) and (452.13, 40.19); chip 8 px from the sheet's right, centred in the band — ${JSON.stringify({ sb: g.sb, sf: g.sf, chip: g.chip })}`,
  ).toBe(true)
  expect(
    !!g.photo &&
      !!g.front &&
      n5(g.photo.x, g.front.x) &&
      n5(g.photo.right, g.sheet.r) &&
      n5(g.photo.top, g.sheet.y) &&
      n5(g.photo.bottom, g.sheet.b) &&
      g.labels.map((l) => l[0]).join() === 'Back,Spine,Front' &&
      g.labels.every((l) => n5(l[1] - g.sheet.b, 10)),
    `cover-editor: front photo = front board + the wrap on top, outer and bottom edges; labels 10 px under the sheet — ${JSON.stringify({ photo: g.photo, labels: g.labels, sheetB: g.sheet.b })}`,
  ).toBe(true)
  expect(
    centred(g) &&
      g.sub === 'Hardcover · wrap 15 mm · hinge 8 mm' &&
      g.sw === '12 mm' &&
      g.hint === 'Generic print profile · 20 pages',
    `cover-editor: spine text centre = spine centre (±0.5) at 20 pages; inspector sub, Spine width and hint — ${JSON.stringify({ text: [cx(g.text), cy(g.text)], spine: [cx(g.spine), cy(g.spine)], sub: g.sub, sw: g.sw, hint: g.hint })}`,
  ).toBe(true)
  await page
    .locator(`${S} [data-testid="cover-text-spine"]`)
    .fill(
      'Lake trip · Summer 2026 · Karelia, Ladoga, Valaam, the islands of Lake Ladoga and the long road home',
    )
  await settled(page)
  const l = boxes(await geo())
  expect(
    centred(l) &&
      l.ell === 'ellipsis' &&
      !!l.clip &&
      l.text.h <= g.cover.h * (22 / 23) + 0.5,
    `cover-editor: a long spine text stays centred and ends in an ellipsis within trim height − 2 × safe — ${JSON.stringify({ h: l.text.h, ell: l.ell, clip: l.clip })}`,
  ).toBe(true)
  await pick('120 pages')
  const t = boxes(await geo())
  expect(
    n5(t.spine.w, 61.39) &&
      n5(t.sheet.h, 498.82) &&
      n5(t.cover.x - t.sheet.x, 28.78) &&
      centred(t) &&
      t.sw === '32 mm' &&
      t.hint === 'Generic print profile · 120 pages',
    `cover-editor: 120 pages — spine 61.39 px, sheet 848 × 498.82, wrap 28.78, text centred, Spine width 32 mm — ${JSON.stringify({ spine: t.spine.w, sheet: t.sheet.h, wrap: t.cover.x - t.sheet.x, sw: t.sw, hint: t.hint })}`,
  ).toBe(true)
  await pick('Photo + title')
  await page.locator(`${S} [data-testid="book-title"]`).click()
  await settled(page)
  await page.locator(`${S} [data-testid="size-preset"]`).selectOption('A3')
  await settled(page)
  await page
    .locator(`${S} [data-testid="size-orientation"]`)
    .getByText('Landscape', { exact: true })
    .click()
  await settled(page)
  await page.locator(`${S} [data-item="cover"]`).click()
  await settled(page)
  const a3 = await geo()
  expect(
    n5(a3.sheet?.w, 848) &&
      n5(a3.sheet?.h, 314.4) &&
      !!a3.cover &&
      !!a3.sheet &&
      n5(a3.cover.x - a3.sheet.x, 14.42) &&
      !a3.chip,
    `cover-editor: A3 landscape — sheet 848 × 314.4, band 14.42 px < 18, chip not rendered — ${JSON.stringify({ sheet: a3.sheet && [a3.sheet.w, a3.sheet.h], wrap: a3.cover && a3.sheet && a3.cover.x - a3.sheet.x, chip: !!a3.chip })}`,
  ).toBe(true)
  expect(errs).toEqual([])
})
