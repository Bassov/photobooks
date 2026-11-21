import fs from 'node:fs'
import path from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit editor canvas (moved from uikit/scripts/qa.mjs §4 / v5 / v6, uikit-qa-split-1):
// top-bar tooltips, the empty Spread inspector, drag a photo onto a frame, the grid
// toggle, the spread list panel and the selected-frame outline. Every test also fails
// on a console error / warning, page error or failed request, like the qa.mjs smoke().

test.use({ viewport: { width: 1440, height: 900 } })

const D = (page: Page, s: string) => page.locator(`[data-testid="demo"] ${s}`)

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

async function open(page: Page, hash: string) {
  const errs = watchErrors(page)
  await page.goto(`/uikit/${hash}`)
  await expect(page.getByTestId('demo')).toBeVisible()
  return errs
}

/** 2 px selection-coloured (#393738) elements and any blue colour rendered in the demo */
function selectionAndBlue(): [number, string[]] {
  const cols = new Set<string>()
  let sel = 0
  for (const e of document.querySelectorAll('[data-testid=demo] *')) {
    const cs = getComputedStyle(e)
    if (
      (cs.outlineColor + cs.borderTopColor + cs.boxShadow).includes(
        'rgb(57, 55, 56)',
      ) &&
      (parseFloat(cs.outlineWidth) >= 2 ||
        parseFloat(cs.borderTopWidth) >= 2 ||
        cs.boxShadow.includes('2px'))
    )
      sel++
    for (const k of [
      'outlineColor',
      'borderTopColor',
      'boxShadow',
      'backgroundColor',
      'color',
    ] as const)
      for (const x of cs[k].match(/rgba?\(\d+, \d+, \d+/g) ?? []) {
        const [r = 0, g = 0, b = 0] = (x.match(/\d+/g) ?? []).map(Number)
        if (b - Math.max(r, g) > 30) cols.add(x)
      }
  }
  return [sel, [...cols]]
}

test('screen canvas: tooltips: at most 1 open while tabbing the top bar, none after Escape / leaving', async ({
  page,
}) => {
  await open(page, '#/screen/canvas')
  await page.locator('[data-testid="demo"] button').first().focus()
  // the most tooltips open at once, recorded on every DOM change
  await page.evaluate(() => {
    const w = window as unknown as { maxTips: number }
    w.maxTips = 0
    const count = () => {
      w.maxTips = Math.max(
        w.maxTips,
        document.querySelectorAll('[role=tooltip]').length,
      )
    }
    new MutationObserver(count).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    })
    count()
  })
  const tips = page.locator('[role=tooltip]')
  for (let i = 0; i < 12; i++) await tabMovesFocus(page)
  await page.keyboard.press('Escape')
  await expect(tips).toHaveCount(0)
  // leaving: focus may run past the last control, so no focus-moved wait here
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab')
  await expect(tips).toHaveCount(0)
  const maxTips = await page.evaluate(
    () => (window as unknown as { maxTips: number }).maxTips,
  )
  expect(maxTips).toBeLessThanOrEqual(1)
})

/** press Tab and wait until focus left the element that had it */
async function tabMovesFocus(page: Page) {
  const before = await page.evaluateHandle(() => document.activeElement)
  await page.keyboard.press('Tab')
  await expect
    .poll(() => page.evaluate((b) => document.activeElement !== b, before))
    .toBe(true)
  await before.dispose()
}

test('layout-grids-render-snap: empty inspector is labelled Spread, no stale hint block', async ({
  page,
}) => {
  const errs = await open(page, '#/feature/layout-grids-render-snap')
  const insp = page
    .locator(
      '[data-testid="demo"] [data-testid="inspector"], [data-testid="demo"] [data-testid="ctx-inspector"]',
    )
    .first()
  // proto: a single section shows a plain header (h2) instead of a lone tab
  const tab = await insp
    .locator('[role="tab"], [data-testid="inspector-header"] h2')
    .first()
    .textContent()
  expect(tab).toBe('Spread')
  expect(await insp.innerText()).not.toContain('Select a frame on the spread')
  expect(errs).toEqual([])
})

test('drag-place-replace: drag photo onto frame + undo', async ({ page }) => {
  const errs = await open(page, '#/feature/drag-place-replace')
  await D(page, '[data-testid="filmstrip"] [role="row"]')
    .nth(0)
    .dragTo(D(page, '[data-testid="frame"]').first())
  await expect(D(page, '[data-testid="status"]').first()).toHaveText(
    /Placed|Replaced/,
  )
  await D(page, '[data-testid="undo"]').click()
  expect(errs).toEqual([])
})

test('layout-grids-render-snap: grid toggle', async ({ page }) => {
  const errs = await open(page, '#/feature/layout-grids-render-snap')
  const grid = D(page, '[data-testid="grid-overlay"]').first()
  await expect(grid).toBeVisible()
  await D(page, '[data-testid="toggle-grid"]').click()
  await expect(grid).toBeHidden()
  expect(errs).toEqual([])
})

test('spread-list-panel: v5.1 template names are not cut off (2 columns, wrap)', async ({
  page,
}) => {
  const errs = await open(page, '#/feature/spread-list-panel')
  const cut = await D(page, '[data-testid="tpl-name"]').evaluateAll((els) =>
    els
      .filter(
        (e) =>
          (e as HTMLElement).offsetParent &&
          e.scrollHeight > e.clientHeight + 1,
      )
      .map((e) => e.textContent),
  )
  expect(cut).toEqual([])
  expect(errs).toEqual([])
})

test('spread-list-panel: v5 spread list: no horizontal scroll', async ({
  page,
}) => {
  const errs = await open(page, '#/feature/spread-list-panel')
  const [sw, cw] = await D(page, '[data-testid="spreads-panel"] .scroll-thin')
    .first()
    .evaluate((e) => [e.scrollWidth, e.clientWidth])
  expect(sw).toBeLessThanOrEqual(cw + 1)
  expect(errs).toEqual([])
})

test('frame-selection-handles: v6 selected frame: #393738 outline, no blue rendered', async ({
  page,
}) => {
  const errs = await open(page, '#/feature/frame-selection-handles')
  const [sel, blue] = await page.evaluate(selectionAndBlue)
  expect(blue).toEqual([])
  expect(sel).toBeGreaterThan(0)
  expect(errs).toEqual([])
})

// Moved from uikit/scripts/qa.mjs v7.1 / v7.2 / v7.3 / v8 / v8.1 / v0.9 / v0.9.1 / v0.9.2 / kit10 / kit-sync W4 /
// r16 / r17 (uikit-qa-split-4): the one editor's scenario states, toolbar vs page labels, no scrolling pasteboard,
// the per-spread grid and its snap, no pager, tool cursors, wheel zoom, source spot checks, pan focus ring, the
// #/demo stack geometry / zoom / last page / cover labels (kit-sync KS1–KS5, K1), the endpaper canvas, and the
// grey-canvas press / Masters → Pages centring. Smoke ports and the r16 / r17 walks also fail on a console error /
// warning, page error or failed request, like the qa.mjs smokeS() and walks.

const DEMO = '[data-testid="demo"]'
const E = (page: Page, s: string) => D(page, `[data-testid="editor7"] ${s}`)
const UIKIT = path.resolve(process.cwd(), 'uikit')
const readSandbox = (f: string) =>
  fs.readFileSync(path.join(UIKIT, 'src', 'sandbox', f), 'utf8')

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

/** `read` gives the same value across two painted frames (camera tweens, smooth scrolls done) */
async function steady(page: Page, read: () => Promise<unknown>) {
  let prev = JSON.stringify(await read())
  await expect
    .poll(async () => {
      await page.evaluate(frames2)
      const cur = JSON.stringify(await read())
      const same = cur === prev
      prev = cur
      return same
    })
    .toBe(true)
}

/** qa.mjs §7: a tool cursor is the keyword or a url() cursor with it as the fallback */
const curOk = (v: string | undefined, fb: string) =>
  typeof v === 'string' &&
  (v === fb || v.includes(fb) || (v.startsWith('url(') && v.includes(fb)))

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

/** qa.mjs scen("Photo"): the old editor scenario now lives on #/feature/frame-selection-handles, tab Frame selected */
async function scenPhoto(page: Page) {
  await page.goto('/uikit/#/feature/frame-selection-handles')
  const t = D(page, '[data-testid="scenarios"]').getByRole('tab', {
    name: 'Frame selected',
    exact: true,
  })
  await t.click()
  await expect(t).toHaveAttribute('aria-selected', 'true')
  await settled(page)
}

/** screen canvas, spread p3 picked (the spread list is a drag source: scroll first, then click), grid Custom 4 × 3 shown */
async function customGrid4x3(page: Page) {
  const errs = await open(page, '#/screen/canvas')
  const p3 = D(page, '[data-item="p3"]')
  await p3.scrollIntoViewIfNeeded()
  await p3.click()
  await settled(page)
  const sg = D(page, '[data-testid="spread-grid"]')
  await sg.getByText('Custom', { exact: true }).click()
  await sg.locator('[data-testid="spread-grid-C"]').fill('4')
  await sg.locator('[data-testid="spread-grid-R"]').fill('3')
  await settled(page)
  if (!(await D(page, '[data-testid="grid-col"]').count()))
    await sg.getByLabel('Show grid').click()
  await settled(page)
  return errs
}

test('screen canvas: v7.1 P1 #3: v0.5.3 features live in the one editor — templates All/My (no search since kit-sync KS7), filmstrip drag source, inspector params, multi-select, Crop toolbar', async ({
  page,
}) => {
  const errs = await open(page, '#/screen/canvas')
  await scenPhoto(page)
  const tb = await E(page, '[role=toolbar]').count()
  const params = await E(
    page,
    '[data-testid="inspector"] [data-testid="ctx-inspector"][data-ctx="photo"]',
  ).count()
  const p3 = E(page, '[data-item="p3"]')
  await p3.scrollIntoViewIfNeeded()
  await p3.click()
  await settled(page)
  const tpl = await E(page, '[data-testid="tpl-tile"]').count()
  const search = await E(
    page,
    '[data-testid="inspector"] input[type=search], [data-testid="inspector"] [role=searchbox]',
  ).count()
  const film = await E(page, '[data-testid="filmstrip"] [role=row]').count()
  const fr = E(
    page,
    '[data-testid="spread"][data-current] [data-testid="frame"]',
  )
  const frames = await fr.count()
  expect(frames).toBeGreaterThanOrEqual(2)
  await fr.nth(0).click({ force: true })
  await fr.nth(1).click({ modifiers: ['Shift'], force: true })
  await settled(page)
  const multi = await E(page, '[data-testid="sel-outline"]').count()
  const r = { tb, params, tpl, search, film, frames, multi }
  expect(
    tb >= 1 &&
      params === 1 &&
      tpl >= 4 &&
      search === 0 &&
      film >= 4 &&
      multi >= 2,
    JSON.stringify(r),
  ).toBe(true)
  expect(errs).toEqual([])
})

test('screen canvas: v7.2 P2-7: Replace/Crop toolbar never overlaps a page-number label', async ({
  page,
}) => {
  await open(page, '#/screen/canvas')
  await settled(page)
  const bad: string[] = []
  const fr = E(page, '[data-testid="spread"] [data-testid="frame"]')
  const n = await fr.count()
  for (let i = 0; i < n; i++) {
    await fr.nth(i).click({ force: true })
    await settled(page)
    const o = await page.evaluate(() => {
      const tb = document.querySelector(
        '[data-testid="demo"] [data-testid="frame-toolbar"]',
      )
      if (!tb) return null
      const a = tb.getBoundingClientRect()
      const labels = [
        ...document.querySelectorAll(
          '[data-testid="demo"] [data-testid="page-labels"] span',
        ),
      ]
      return labels
        .filter((l) => {
          const b = l.getBoundingClientRect()
          return (
            b.width &&
            l.textContent.trim() &&
            !(
              a.right < b.left ||
              b.right < a.left ||
              a.bottom < b.top ||
              b.bottom < a.top
            )
          )
        })
        .map((l) => l.textContent)
    })
    bad.push(...(o ?? []).map((t) => `frame ${String(i)}: ${t}`))
    await page.keyboard.press('Escape')
  }
  const nl = await page
    .locator('[data-testid="demo"] [data-testid="page-labels"] span')
    .count()
  expect(nl, `${String(n)} frames`).toBeGreaterThan(0)
  expect(bad).toEqual([])
})

test('spread-list-panel: v7.3 P2-1: canvas has no scrolling pasteboard', async ({
  page,
}) => {
  await open(page, '#/feature/spread-list-panel')
  await settled(page)
  const sc = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-testid="demo"] *')]
      .filter((e) => {
        const cs = getComputedStyle(e)
        return (
          /(auto|scroll)/.test(cs.overflowY + cs.overflowX) &&
          (e.scrollHeight > e.clientHeight + 2 ||
            e.scrollWidth > e.clientWidth + 2) &&
          e.closest(
            '[data-testid="canvas"],[data-testid="viewport"],[data-testid="pasteboard"]',
          )
        )
      })
      .map((e) => e.dataset.testid ?? e.className.slice(0, 40)),
  )
  expect(sc).toEqual([])
})

test('screen canvas: v8 §3.4 grid: per-spread custom 4 × 3 renders 4 columns and 3 rows on each page', async ({
  page,
}) => {
  const errs = await customGrid4x3(page)
  // 2 pages
  await expect
    .poll(async () => [
      await D(page, '[data-current] [data-testid="grid-col"]').count(),
      await D(page, '[data-current] [data-testid="grid-row"]').count(),
    ])
    .toEqual([8, 6])
  expect(errs).toEqual([])
})

test('screen canvas: v8.1 P2-4 grid guides carry data-allow-border; P2-9 dragging a frame snaps it to a column/row edge', async ({
  page,
}) => {
  const errs = await customGrid4x3(page)
  const ab = await D(
    page,
    '[data-testid="grid-col"], [data-testid="grid-row"]',
  ).evaluateAll(
    (es) =>
      es.length > 0 && es.every((e) => e.hasAttribute('data-allow-border')),
  )
  const fr = D(page, '[data-current] [data-testid="frame"]').first()
  const b = await box(fr)
  const edges = await D(
    page,
    '[data-current] [data-testid="grid-col"]',
  ).evaluateAll((es) =>
    es.flatMap((e) => {
      const r = e.getBoundingClientRect()
      return [r.left, r.right]
    }),
  )
  const tx =
    edges
      .map((x) => x - b.x)
      .filter((d) => Math.abs(d) > 4)
      .sort((a, c) => Math.abs(a) - Math.abs(c))[0] ?? 20
  const sx = b.x + b.width / 2
  const sy = b.y + b.height / 2
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + tx / 2, sy + 3, { steps: 4 })
  await page.mouse.move(sx + tx + 5, sy + 2, { steps: 4 })
  await page.mouse.up()
  await steady(page, () => fr.boundingBox())
  const a = await box(fr)
  const snapped = edges.some(
    (x) => Math.abs(a.x - x) < 1.5 || Math.abs(a.x + a.width - x) < 1.5,
  )
  await page.keyboard.press('Control+z')
  expect(
    ab && snapped,
    `allowBorder=${String(ab)} moved ${String(Math.round(b.x))}→${String(Math.round(a.x))} (target ${String(Math.round(b.x + tx))}) snapped=${String(snapped)}`,
  ).toBe(true)
  expect(errs).toEqual([])
})

test('screen canvas: v0.9 §6 no floating page switcher (pager)', async ({
  page,
}) => {
  await open(page, '#/screen/canvas')
  await settled(page)
  await expect(page.locator('[data-testid="pager"]')).toHaveCount(0)
})

for (const check of [
  'v0.9 §6 P2: #/feature/parent-spreads has no floating pager',
  'v0.9.1 §12 parent-spreads still has no pager',
])
  test(check, async ({ page }) => {
    // P2 post-approval: parent-spreads also has no pager (ParentStd no longer mounts it)
    await open(page, '#/feature/parent-spreads')
    await settled(page)
    await expect(page.locator('[data-testid="pager"]')).toHaveCount(0)
  })

test('v0.9 §7 / v0.9.3 tool cursors: Frame/Text outlined url (or crosshair/text), Hand=grab, Select=default', async ({
  page,
}) => {
  // §7 tool cursors on viewport (aria-labels: Select (V), Frame (F), Text (T), Pan (H))
  await open(page, '#/screen/canvas')
  await scenPhoto(page)
  const cursors: Record<string, string> = {}
  for (const [key, label] of [
    ['Select', 'Select (V)'],
    ['Frame', 'Frame (F)'],
    ['Text', 'Text (T)'],
    ['Hand', 'Pan (H)'],
  ] as const) {
    await D(page, `button[aria-label="${label}"]`).click()
    await settled(page)
    cursors[key] = await D(
      page,
      ':is([data-testid="viewport"], [data-testid="pasteboard"])',
    ).evaluate((vp) => getComputedStyle(vp).cursor)
  }
  expect(
    curOk(cursors.Frame, 'crosshair') &&
      curOk(cursors.Text, 'text') &&
      (cursors.Hand === 'grab' || cursors.Hand === '-webkit-grab') &&
      (cursors.Select === 'auto' || cursors.Select === 'default'),
    JSON.stringify(cursors),
  ).toBe(true)
})

test('v0.9.3 tool cursor assets: white fill + black stroke in SVG data-URI CSS', () => {
  const cssSrc = readSandbox('v7.tsx')
  expect(cssSrc).toMatch(/cursor-tool-frame/)
  expect(cssSrc).toMatch(/cursor-tool-text/)
  expect(cssSrc).toMatch(/stroke-width/)
  expect(cssSrc).toMatch(/%23232223/)
  expect(cssSrc).toMatch(/%23ffffff|%23fff/)
})

test('v0.9 §8 wheel over canvas changes zoom', async ({ page }) => {
  await open(page, '#/screen/canvas')
  await scenPhoto(page)
  await D(page, 'button[aria-label="Select (V)"]')
    .click()
    .catch(() => null)
  const zoom = D(page, '[data-testid="zoom-menu"]')
  const z0 = (await zoom.innerText()).trim()
  const vp = await box(
    D(page, ':is([data-testid="viewport"], [data-testid="pasteboard"])'),
  )
  await page.mouse.move(vp.x + vp.width / 2, vp.y + vp.height / 2)
  await page.mouse.wheel(0, -240)
  await expect.poll(async () => (await zoom.innerText()).trim()).not.toBe(z0)
  await expect(zoom).toHaveText(/%/)
})

test('v0.9.1 §6 floating FrameToolbar removed from canvas', () => {
  expect(readSandbox('canvas.tsx')).not.toMatch(/FrameToolbar/)
})

test('v0.9.1 §11 empty-slot copy unified (list + inspector meta N empty; frame Empty — drag a photo)', () => {
  const emptySlot = readSandbox('inspector.tsx')
  const ctxInsp = readSandbox('context-inspector.tsx')
  const listEmpty = readSandbox('chrome.tsx')
  expect(emptySlot).toContain('data-testid="empty-slot">Empty — drag a photo<')
  expect(ctxInsp).toContain('${empty} empty')
  expect(ctxInsp).not.toContain('photo${placed')
  expect(listEmpty).toMatch(/\} empty</)
})

test('v0.9.2 Space/Hand pan: no canvas focus outline', async ({ page }) => {
  await open(page, '#/screen/canvas')
  await scenPhoto(page)
  const canvas = D(page, '[data-testid="canvas"]')
  const ring = () =>
    canvas.evaluate((el) => {
      const s = getComputedStyle(el)
      return {
        outline: s.outlineStyle,
        w: s.outlineWidth,
        pan: el.hasAttribute('data-panning'),
      }
    })
  await canvas.focus()
  await page.keyboard.down('Space')
  await settled(page)
  const spaceOutline = await ring()
  await page.keyboard.up('Space')
  await settled(page)
  await D(page, 'button[aria-label="Pan (H)"]').click()
  await settled(page)
  await canvas.focus()
  const handOutline = await ring()
  expect(
    spaceOutline.pan &&
      (spaceOutline.outline === 'none' || spaceOutline.w === '0px') &&
      handOutline.pan &&
      (handOutline.outline === 'none' || handOutline.w === '0px'),
    `space=${JSON.stringify(spaceOutline)} hand=${JSON.stringify(handOutline)}`,
  ).toBe(true)
})

interface DemoApi {
  reset: () => void
}

/** a fresh #/demo: library, a new book (create dialog left to `book`) */
async function demoLibrary(page: Page) {
  const errs = watchErrors(page)
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: DemoApi }).__demo.reset()
  })
  await page.locator('[data-testid="create-library"]').first().click()
  await page.locator('[data-testid="picker-select"]').first().click()
  await page.locator(`${DEMO} [data-testid="new-book"]`).first().click()
  await expect(page.locator('[role=dialog] input').first()).toBeVisible()
  return errs
}

/** click the first match and let the editor settle */
async function pick(page: Page, sel: string) {
  await page.locator(sel).first().click()
  await settled(page)
}

/** qa.mjs W4: turn a demo switch on unless it already is */
async function switchOn(page: Page, sel: string) {
  if ((await D(page, sel).getAttribute('aria-checked')) !== 'true')
    await pick(page, sel)
}

test('kit10 #/demo: kit-sync KS1–KS5 / K1 — stack gap, page numbers, new-spread pill, no size pill, wheel / Ctrl+= zoom, last page, cover labels, Esc during a frame drag, ruler guide', async ({
  page,
}) => {
  // kit10 walk opening: fresh #/demo, library, a new book, a photo folder, spread p1
  await demoLibrary(page)
  const c = (sel: string) => page.locator(sel).first().click() // dialogs portal outside the demo root
  await c('[data-testid="create-book"]')
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await c('[data-testid="demo-add-folder"]')
  await page
    .locator('[role=dialog]')
    .getByRole('button', { name: /Choose|Select|Use|Add/i })
    .last()
    .click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await pick(page, '[data-item="p1"]')
  // kit-sync-canvas (KS2–KS5, K1): #/demo stacks the pages as prod — gap 104/588 of the spread height, 11 px page numbers 8 px under the page,
  // a content-wide new-spread pill centred between the numbers and the next spread, no frame size pill, Esc clears the "Release to replace" chip
  const cur = `${DEMO} [data-testid="spread"][data-current]`
  const curL = page.locator(cur)
  const m = await page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel)
    if (!el) throw new Error('no current spread')
    const c = el.getBoundingClientRect()
    const nx = document.querySelector(
      `[data-testid="demo"] [data-testid="spread"][data-spread="${String(Number(el.dataset.spread) + 1)}"]`,
    )
    if (!nx) throw new Error('no next spread')
    const n = nx.getBoundingClientRect()
    const l = [
      ...(el
        .closest('[data-stack-item]')
        ?.querySelectorAll('[data-testid="page-labels"] span') ?? []),
    ].find((s) => s.textContent.trim())
    if (!l) throw new Error('no page label')
    const lb = l.getBoundingClientRect()
    return {
      n: document.querySelectorAll(
        '[data-testid="demo"] [data-testid="pasteboard"] [data-testid="spread"]',
      ).length,
      h: c.height,
      gap: n.top - c.bottom,
      dy: lb.top - c.bottom,
      lh: lb.height,
      fs: getComputedStyle(l).fontSize,
    }
  }, cur)
  // absolute Fit numbers (513.25 / 90.78 at 1440×900) are the demo-capture walk's; here the ratios hold at any window size
  expect
    .soft(
      m.n > 1 && Math.abs(m.gap - (m.h * 104) / 588) <= 1,
      `kit-sync KS2: #/demo stacks the spreads; gap = 104/588 of the spread height: ${JSON.stringify(m)}`,
    )
    .toBe(true)
  expect
    .soft(
      m.fs === '11px' &&
        Math.abs(m.lh - 11) <= 0.5 &&
        Math.abs(m.dy - 8) <= 0.5,
      `kit-sync KS3: page numbers 11 px on screen, 8 px under the page: ${JSON.stringify(m)}`,
    )
    .toBe(true)
  const row = await box(
    D(page, '[data-testid="filmstrip"] [role="row"]').nth(2),
  )
  const sb = await box(curL)
  await page.mouse.move(row.x + row.width / 2, row.y + row.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++)
    await page.mouse.move(
      row.x + ((sb.x + sb.width / 2 - row.x) * i) / 8,
      row.y + ((sb.y + sb.height + 30 - row.y) * i) / 8,
    )
  const pill = () =>
    page.evaluate((sel) => {
      const cs = document.querySelector(sel)
      if (!cs) return null
      const c = cs.getBoundingClientRect()
      const pills = [
        ...document.querySelectorAll<HTMLElement>(
          '[data-testid="demo"] [data-testid="gap-pill"]',
        ),
      ]
      const e = pills.find((x) => x.getBoundingClientRect().top > c.bottom)
      if (!e) return null
      const b = e.getBoundingClientRect()
      const s = getComputedStyle(e)
      const n = [
        ...document.querySelectorAll(
          '[data-testid="demo"] [data-testid="spread"]',
        ),
      ]
        .map((x) => x.getBoundingClientRect())
        .find((x) => x.top > b.top)
      return {
        w: b.width,
        h: b.height,
        fs: s.fontSize,
        r: s.borderRadius,
        ws: s.whiteSpace,
        up: b.top - c.bottom - 19,
        down: (n?.top ?? NaN) - b.bottom,
        gapH: e.parentElement?.getBoundingClientRect().height ?? NaN,
      }
    }, cur)
  await expect.poll(pill).not.toBeNull()
  await settled(page)
  const p = await pill()
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await settled(page)
  expect
    .soft(
      !!p &&
        p.h === 32 &&
        p.fs === '12px' &&
        p.ws === 'nowrap' &&
        p.r === '8px' &&
        Math.abs(p.w - 199.23) <= 1 &&
        Math.abs(p.up - p.down) <= 1 &&
        Math.abs(p.up - (m.gap - 19 - 32) / 2) <= 1 &&
        Math.abs(p.gapH - m.gap) <= 1,
      `kit-sync KS4: new-spread pill 32 px, 12 px nowrap, width by content, radius 8, centred under the page numbers; the gap does not grow: ${JSON.stringify(p)}`,
    )
    .toBe(true)
  await page.locator(`${cur} [data-testid="frame"]`).first().click()
  const handles = D(page, '[data-testid="handles"]')
  // kit-sync KS5: a selected frame shows no size pill (380 × 230 mm)
  await expect.soft(handles).toHaveCount(1)
  expect.soft(await handles.filter({ hasText: / × \d+ mm/ }).count()).toBe(0)
  await page.keyboard.press('Escape')
  await settled(page)
  await pick(page, '[data-item="p1"]')

  // prod usePasteboardCamera: the wheel zooms about the cursor, Ctrl+= / Ctrl+- about the pasteboard centre
  const curBox = () => curL.boundingBox()
  const r0 = await box(curL)
  const mx = Math.round(r0.x + r0.width * 0.6)
  const my = Math.round(r0.y + r0.height * 0.3)
  await page.mouse.move(mx, my)
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, -120)
    await page.evaluate(frames2)
  }
  await steady(page, curBox)
  const r1 = await box(curL)
  const drift = [
    ((mx - r1.x) / r1.width - (mx - r0.x) / r0.width) * r1.width,
    ((my - r1.y) / r1.height - (my - r0.y) / r0.height) * r1.height,
  ]
  expect
    .soft(
      r1.width > r0.width && drift.every((d) => Math.abs(d) <= 2),
      `kit-sync KS2: wheel zoom keeps the point under the cursor (≤ 2 px after 3 notches): ${drift.map((d) => d.toFixed(1)).join(' / ')}`,
    )
    .toBe(true)
  await page.keyboard.press('Control+0')
  await steady(page, curBox)
  const pb = await box(D(page, '[data-testid="pasteboard"]'))
  const cx0 = (await box(curL)).x + r0.width / 2
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('Control+Equal')
    await steady(page, curBox)
  }
  const rk = await box(curL)
  const kcx = rk.x + rk.width / 2
  expect
    .soft(
      rk.width > r0.width &&
        Math.abs(kcx - (pb.x + pb.width / 2)) <= 2 &&
        Math.abs(cx0 - kcx) <= 2,
      `kit-sync KS2: Ctrl+= zooms about the pasteboard centre (spread centre stays at the centre ±2 px): centre ${kcx.toFixed(1)} vs ${(pb.x + pb.width / 2).toFixed(1)}`,
    )
    .toBe(true)
  await page.keyboard.press('Control+0')
  await steady(page, curBox)

  // M45 + Q3: the stack ends with the single last page on the left, its number under it, the stack gap before it; the `last` row scrolls to it
  const pbl = D(page, '[data-testid="pasteboard"]')
  const scrollTop = () => pbl.evaluate((el) => el.scrollTop)
  await pick(page, '[data-item="last"]')
  await steady(page, scrollTop)
  const e = await page.evaluate(() => {
    const root = document.querySelector(
      '[data-testid="demo"] [data-testid="pasteboard"]',
    )
    if (!root) return null
    const items = [...root.querySelectorAll<HTMLElement>('[data-stack-item]')]
    const l = items.at(-1)
    const prev = items.at(-2)
    const paperEl = l?.querySelector('[data-paper]')
    const lab = [
      ...(l?.querySelectorAll('[data-testid="page-labels"] span') ?? []),
    ].find((s) => s.textContent.trim())
    if (!l || !prev || !paperEl || !lab) return null
    const lr = l.getBoundingClientRect()
    const pr = prev.getBoundingClientRect()
    const paper = paperEl.getBoundingClientRect()
    const lb = lab.getBoundingClientRect()
    const rr = root.getBoundingClientRect()
    return {
      key: l.dataset.stackItem,
      inView: lr.top >= rr.top && lr.bottom <= rr.bottom,
      left: paper.left - lr.left,
      w: paper.width / lr.width,
      gap: lr.top - pr.bottom,
      h: lr.height,
      t: lab.textContent,
      lcx: lb.left + lb.width / 2 - (paper.left + paper.width / 2),
      dy: lb.top - lr.bottom,
      fs: getComputedStyle(lab).fontSize,
    }
  })
  expect
    .soft(
      !!e &&
        e.key === 'last' &&
        e.inView &&
        e.left === 0 &&
        e.w === 0.5 &&
        Math.abs(e.gap - (e.h * 104) / 588) <= 1 &&
        e.t === '20' &&
        Math.abs(e.lcx) <= 1 &&
        Math.abs(e.dy - 8) <= 0.5 &&
        e.fs === '11px',
      `kit-sync KS2: the stack ends with the last page alone on the left, its number under it; the last row stays stacked: ${JSON.stringify(e)}`,
    )
    .toBe(true)
  // a click on the last page on the canvas selects it like the `last` row and keeps the view (prod: scrollTop unchanged)
  await pick(page, '[data-item="p9"]')
  await steady(page, scrollTop)
  await pbl.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await steady(page, scrollTop)
  const t0 = await scrollTop()
  await D(page, '[data-stack-item="last"] [data-paper]').click()
  const lastRow = D(page, '[data-testid="panel-l"] [data-item="last"]')
  await expect.soft(lastRow).toHaveAttribute('aria-selected', 'true')
  await steady(page, scrollTop)
  const t1 = await scrollTop()
  expect
    .soft(
      t0 > 0 && Math.abs(t1 - t0) <= 2,
      `kit-sync KS2: a canvas click on the last page selects it (the \`last\` row) and keeps the view: scrollTop ${String(t0)} → ${String(t1)}`,
    )
    .toBe(true)
  // 11 px / 8 px is for page numbers only: cover labels keep 12 px, 10 px under the cover
  // the list is scrolled to `last`; bring the cover row into view first (Playwright's own scroll-and-click misses the row there)
  await page.locator('[data-item="cover"]').evaluate((el) => {
    el.scrollIntoView({ block: 'nearest' })
  })
  await settled(page)
  await pick(page, '[data-item="cover"]')
  const nodeView = D(page, '[data-testid="node-view"]')
  await expect(nodeView).toBeVisible()
  await steady(page, () => nodeView.boundingBox())
  const cl = await page.evaluate(() => {
    const v = document
      .querySelector('[data-testid="demo"] [data-testid="node-view"]')
      ?.getBoundingClientRect()
    return [
      ...document.querySelectorAll(
        '[data-testid="demo"] [data-testid="page-labels"] span',
      ),
    ].map((s) => ({
      t: s.textContent,
      fs: getComputedStyle(s).fontSize,
      dy: +(s.getBoundingClientRect().top - (v?.bottom ?? NaN)).toFixed(2),
    }))
  })
  expect
    .soft(
      cl.map((x) => x.t).join() === 'Back,Spine,Front' &&
        cl.every((x) => x.fs === '12px' && Math.abs(x.dy - 10) <= 0.5),
      `kit-sync KS3: cover labels Back / Spine / Front keep 12 px, 10 px under the cover: ${JSON.stringify(cl)}`,
    )
    .toBe(true)
  await pick(page, '[data-item="p1"]')

  // p02 = the 800 px low-res photo
  const filmRow = D(page, '[data-testid="filmstrip"] [role="row"]').nth(1)
  await filmRow.dragTo(
    D(
      page,
      '[data-testid="canvas"] [data-current] [data-testid="frame"]',
    ).first(),
  )
  await expect(filmRow.getByTestId('filmstrip-placed')).toHaveCount(1)
  await settled(page)
  // kit-sync K1 (prod M43): Esc during a frame drag clears the "Release to replace" chip and the dimmed drag source
  const fb = await box(page.locator(`${cur} [data-testid="frame"]`).first())
  // direct crop: the drop leaves the pointer on the frame's grabber, which shows the photo layer (its ghost pans);
  // leave until it hides, then press off the centre (the grabber)
  await page.mouse.move(5, 5)
  await expect(page.getByTestId('photo-ghost')).toHaveCount(0)
  const x = fb.x + fb.width / 4
  const y = fb.y + fb.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) await page.mouse.move(x - 10 * i, y + 6 * i)
  const chip = D(page, '[data-testid="canvas"]').getByText('Release to replace')
  await expect.soft(chip).toHaveCount(1)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await settled(page)
  const after = await chip.count()
  const dim = await D(page, '[data-frame].opacity-40').count()
  expect
    .soft(
      [after, dim],
      'kit-sync K1: Esc during a frame drag clears the Release to replace chip and the dimmed source',
    )
    .toEqual([0, 0])
  await page.keyboard.press('Escape')
  await settled(page)
  // KS1: rulers (Shift+R) and guides (Ctrl+;) are on keys as in prod
  await page.keyboard.press('Shift+R')
  await page.keyboard.press('Control+;')
  const rulerX = D(page, '[data-testid="ruler-x"]')
  await expect(rulerX).toBeVisible()
  await settled(page)
  const guides = D(page, '[data-testid="spread"] [data-guide]')
  const g0 = await guides.count()
  const rx = await box(rulerX)
  const sp = await box(D(page, '[data-testid="spread"]').first())
  await page.mouse.move(rx.x + rx.width / 2, rx.y + 10)
  await page.mouse.down()
  await page.mouse.move(rx.x + rx.width / 2, sp.y + sp.height * 0.4, {
    steps: 6,
  })
  await page.mouse.up()
  // kit10: rulers show and a drag from the ruler adds a guide
  await expect(guides).toHaveCount(g0 + 1)
})

test('kit-sync W4 / r15: endpaper canvas — no Pastedown caption, Endpaper caption 12 px 8 px under, spine a 1 px line', async ({
  page,
}) => {
  await demoLibrary(page)
  await page.locator('[role=dialog] input').first().fill('Lake trip')
  await pick(page, '[data-testid="create-book"]')
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  // W4 steps before the endpaper checks: the cover inspector, Cover material Linen, Book settings
  await pick(page, '[data-item="cover"]')
  await D(page, '[data-testid="cover-material"]').selectOption('Linen')
  await pick(page, '[data-testid="book-title"]')
  await expect(page.locator('[data-testid="insp-book"]')).toBeVisible()
  await switchOn(page, '[role=switch][aria-label="Endpapers"]')
  await pick(page, '[data-item="ef"]')
  const ep = D(page, '[data-testid="canvas-endpaper"]')
  // kit-sync KS9: endpaper canvas has no «Pastedown · glued to … board» caption
  await expect(ep).toHaveCount(1)
  expect.soft(await ep.textContent()).not.toMatch(/Pastedown/)
  // r15 M89 (prod .endpaper-caption margin-top 0.5rem): the "Endpaper" caption is 12 px, 8 px under the endpaper bottom
  const epc = await page.evaluate(() => {
    const d = document.querySelector('[data-testid="demo"]')
    const v = d
      ?.querySelector('[data-testid="canvas-endpaper"]')
      ?.getBoundingClientRect()
    const s = [
      ...(d?.querySelectorAll('[data-testid="page-labels"] span') ?? []),
    ].find((x) => x.textContent === 'Endpaper')
    return s && v
      ? {
          fs: getComputedStyle(s).fontSize,
          dy: +(s.getBoundingClientRect().top - v.bottom).toFixed(2),
        }
      : null
  })
  expect
    .soft(
      epc?.fs === '12px' && Math.abs(epc.dy - 8) <= 0.5,
      `r15 M89: endpaper caption 12 px, 8 px under the endpaper bottom (±0.5): ${JSON.stringify(epc)}`,
    )
    .toBe(true)
  // r15 M91 (prod .endpaper-gutter): the spine is a 1 px hard line, black 18 %, centred on the spread — no gradient band
  const sp = await page.evaluate(() => {
    const v = document.querySelector(
      '[data-testid="demo"] [data-testid="canvas-endpaper"]',
    )
    const l = v?.querySelector('[data-testid="endpaper-spine"]')
    if (!v || !l) return null
    const vb = v.getBoundingClientRect()
    const b = l.getBoundingClientRect()
    const cs = getComputedStyle(l)
    return {
      w: b.width,
      h: b.height,
      vh: vb.height,
      dx: +(b.x - (vb.x + vb.width / 2)).toFixed(2),
      bg: cs.backgroundColor,
      img: cs.backgroundImage,
      grads: [...v.querySelectorAll('div')].filter((e) =>
        getComputedStyle(e).backgroundImage.includes('linear-gradient'),
      ).length,
    }
  })
  expect
    .soft(
      sp?.w === 1 &&
        sp.h === sp.vh &&
        Math.abs(sp.dx) <= 0.5 &&
        /^(rgba\(0, 0, 0, 0\.18\)|color\(srgb 0 0 0 \/ 0\.18\))$/.test(sp.bg) &&
        sp.img === 'none' &&
        sp.grads === 0,
      `r15 M91: endpaper spine 1 px line at the centre, rgb(0 0 0 / 0.18), no gradient: ${JSON.stringify(sp)}`,
    )
    .toBe(true)
})

test('r16 M92: a grey-canvas press activates the nearest spread and keeps the scroll', async ({
  page,
}) => {
  const errs = await demoLibrary(page)
  await page.locator('[role=dialog] input').first().fill('Lake trip')
  await page
    .locator('[role=dialog]')
    .getByRole('button', { name: /A5|A4|Square|cm/ })
    .first()
    .click()
  await page.getByRole('option', { name: /Custom size/ }).click()
  await page.fill('[data-testid="create-custom-w"]', '19')
  await page.fill('[data-testid="create-custom-h"]', '23')
  await pick(page, '[data-testid="create-book"]')
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await pick(page, '[data-item="p1"]')
  // the list grid eats Escape; the demo walk presses it from the inspector, here from the body
  await page.evaluate(() => {
    ;(document.activeElement as HTMLElement | null)?.blur()
  })
  await page.keyboard.press('Escape')
  await settled(page)
  await page.keyboard.press('Escape')
  await settled(page)
  const read = () =>
    page.evaluate(() => {
      const span = [
        ...document.querySelectorAll(
          '[data-stack-item="0"] [data-testid="page-labels"] span',
        ),
      ].find((s) => s.textContent.trim() === '1')
      const g = document.createRange()
      if (span) g.selectNodeContents(span)
      return {
        rows: [
          ...document.querySelectorAll(
            '[data-testid="list"] [aria-selected="true"]',
          ),
        ].map((e) => e.getAttribute('data-item')),
        insp: (
          document.querySelector<HTMLElement>('[data-testid="inspector"]')
            ?.innerText ?? ''
        )
          .split('\n')
          .slice(0, 2)
          .join(' · '),
        y: span ? g.getBoundingClientRect().y : null,
      }
    })
  const before = await read()
  await page
    .locator('[data-testid="canvas"]')
    .click({ position: { x: 20, y: 20 } })
  await expect.poll(async () => (await read()).rows).toEqual(['p0'])
  await steady(page, read)
  const after = await read()
  // the demo walk (demo-capture editor-spread-selected) reads y 66.25 before and after; this shorter walk (no photos added) lands at 52.25
  expect
    .soft(
      before.rows.length === 0 &&
        before.insp === 'Select a spread or photo' &&
        before.y !== null &&
        before.y < 100,
      `r16 M92: before the press (Esc ×2) no row and the empty inspector; page 1 above the centred spread 2–3 (label y < 100): ${JSON.stringify(before)}`,
    )
    .toBe(true)
  expect
    .soft(
      after.rows.join() === 'p0' &&
        /^Spread · Page 1\b/.test(after.insp) &&
        after.y !== null &&
        before.y !== null &&
        Math.abs(after.y - before.y) <= 0.5,
      `r16 M92: grey press at canvas 20,20 → row p0 (page 1) selected, inspector Spread · Page 1, page-1 label y unchanged ±0.5 (no re-centre): ${JSON.stringify(after)}`,
    )
    .toBe(true)
  // r16 M92: no console errors
  expect(errs).toEqual([])
})

// Designer r17 (kit-thumbgrid-page-select, = prod centerSpreadScroll): Masters → Pages remounts the stack and centres the current spread
// even when it was fully in view — zoomed out 6 steps, spread 4–5 sits fully in view at scrollTop 0 and is not centred by the pick
test('Designer r17: Masters → Pages remounts the stack and centres the picked spread 4–5', async ({
  page,
}) => {
  const errs = await demoLibrary(page)
  await page.locator('[role=dialog] input').first().fill('Lake trip')
  await pick(page, '[data-testid="create-book"]')
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  const pbl = page.locator('[data-testid="pasteboard"]')
  const zoom = () =>
    pbl.evaluate((el) => [el.scrollHeight, el.scrollTop, el.clientHeight])
  for (let i = 0; i < 6; i++) {
    await pbl.hover()
    await page.keyboard.press('Control+Minus')
    await steady(page, zoom)
  }
  await pick(page, '[data-item="p2"]')
  const read = () =>
    page.evaluate(() => {
      const pb = document.querySelector('[data-testid="pasteboard"]')
      const el = pb?.querySelector<HTMLElement>('[data-stack-item="2"]')
      if (!pb || !el) return null
      return {
        top: pb.scrollTop,
        want: Math.max(
          0,
          Math.min(
            el.offsetTop + el.offsetHeight / 2 - pb.clientHeight / 2,
            pb.scrollHeight - pb.clientHeight,
          ),
        ),
      }
    })
  await steady(page, read)
  const before = await read()
  const seg = page.locator('[data-testid="mode-seg"]')
  await seg.getByText('Masters', { exact: true }).click()
  await expect(page.locator('[data-testid="canvas-master"]')).toBeVisible()
  await settled(page)
  const gone = await page.locator('[data-stack-item]').count()
  await seg.getByText('Pages', { exact: true }).click()
  await expect(page.locator('[data-stack-item="2"]')).toBeAttached()
  await steady(page, read)
  const after = await read()
  expect
    .soft(
      before?.top === 0 && before.want > 50,
      `Designer r17: picked spread 4–5 fully in view keeps scrollTop 0 (not yet centred): ${JSON.stringify(before)}`,
    )
    .toBe(true)
  expect
    .soft(
      gone === 0 && !!after && Math.abs(after.top - after.want) <= 1,
      `Designer r17: Masters → Pages remounts the stack and centres spread 4–5 (scrollTop = centre ±1): ${JSON.stringify({ gone, after })}`,
    )
    .toBe(true)
  // Designer r17: no console errors
  expect(errs).toEqual([])
})
