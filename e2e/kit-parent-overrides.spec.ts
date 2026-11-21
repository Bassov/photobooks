import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// parent-overrides-kit (Designer parent-overrides Spec 2026-11-04 §Kit changes,
// parent-overrides-canvas review 3): on the kit `#/demo` spread 2–3 (Master A,
// one full-bleed own frame) parent items paint under own frames and let clicks
// through; Ctrl+Shift reaches them geometrically, copies keep the parent slot
// and wear the fit-rule badge; Delete / guide-to-ruler hide; the inspector
// names the changes and resets them.

const demo = (page: Page) => page.getByTestId('demo')
const current = (page: Page) =>
  demo(page).locator(
    '[data-testid="canvas"] [data-testid="spread"][data-current]',
  )
const chapter = (page: Page) =>
  current(page).locator('[data-testid="master-frame"][data-frame="mA-ch"]')
const copy = (page: Page) => current(page).locator('[data-override="true"]')
const badge = (page: Page) => copy(page).getByTestId('override-badge')
const inspector = (page: Page) => demo(page).getByTestId('ctx-inspector')
const changes = (page: Page) => inspector(page).getByTestId('parent-changes')
const rows = (page: Page) => changes(page).getByTestId('parent-change-row')

async function openSpread(page: Page) {
  await page.goto('/uikit/#/demo')
  await expect(demo(page)).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: { reset: () => void } }).__demo.reset()
  })
  await demo(page).getByTestId('create-library').click()
  await page.getByTestId('picker-select').click()
  await demo(page).getByTestId('new-book').click()
  await page.locator('[role=dialog] input').first().fill('Lake trip')
  await page.getByTestId('create-book').click()
  await demo(page).locator('[data-item="p1"]').click()
  await expect(chapter(page)).toHaveCount(1)
}

/** The copy's badge against the PO3 fit rule on the measured frame: `want` from the rule, `shown` from the DOM,
 *  `inside` = not clipped by the frame, `sized` = 66.42 (full) / 18 (icon) px wide ±1.5 and 16.84 px tall; `sc` = px per mm (7 mm line). */
async function badgeState(page: Page) {
  return copy(page).evaluate((el) => {
    const f = el.getBoundingClientRect()
    const node = el.querySelector('[data-testid="override-badge"]')
    const b = node?.getBoundingClientRect()
    const want =
      f.height < 24.84
        ? 'none'
        : f.width >= 66.42 + 8
          ? 'full'
          : f.width >= 26
            ? 'icon'
            : 'none'
    const shown = node?.getAttribute('data-fit') ?? 'none'
    return {
      want,
      shown,
      inside: !b || (b.right <= f.right && b.bottom <= f.bottom),
      sized:
        !b ||
        (Math.abs(b.width - (shown === 'full' ? 66.42 : 18)) < 1.5 &&
          Math.abs(b.height - 16.84) < 0.5),
      sc: f.height / 7,
    }
  })
}

/** The spread inspector of spread 2–3 (its list row). */
async function showSpread(page: Page) {
  await demo(page).locator('[data-item="p1"]').click()
  await expect(inspector(page)).toHaveAttribute('data-ctx', 'spread')
}

async function centre(l: Locator) {
  const b = await l.boundingBox()
  if (b === null) throw new Error('no box')
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }
}

/** Ctrl+Shift press at (x, y), optionally dragged to `to` before the release. The drag holds Alt after the
 *  press (snap off), so the move is exact at any canvas fit scale (the dock height changes the fit). */
async function ctrlShift(
  page: Page,
  x: number,
  y: number,
  to?: { x: number; y: number },
) {
  await page.keyboard.down('Control')
  await page.keyboard.down('Shift')
  await page.mouse.move(x, y)
  await page.mouse.down()
  if (to) {
    await page.keyboard.down('Alt')
    await page.mouse.move(to.x, to.y, { steps: 6 })
  }
  await page.mouse.up()
  if (to) await page.keyboard.up('Alt')
  await page.keyboard.up('Shift')
  await page.keyboard.up('Control')
}

test('parent items paint under own frames and let a plain click through; Ctrl+Shift copies through the photo, Alt does not', async ({
  page,
}) => {
  await openSpread(page)
  const look = await chapter(page).evaluate((el) => {
    const cs = getComputedStyle(el)
    const all = [...(el.parentElement?.querySelectorAll('[data-frame]') ?? [])]
    const own = all.findIndex((x) => x.getAttribute('data-testid') === 'frame')
    return { pe: cs.pointerEvents, z: cs.zIndex, under: all.indexOf(el) < own }
  })
  expect(look).toEqual({ pe: 'none', z: 'auto', under: true })
  const p = await centre(chapter(page))
  const top = await page.evaluate(
    ({ x, y }) =>
      document
        .elementFromPoint(x, y)
        ?.closest('[data-frame]')
        ?.getAttribute('data-testid'),
    p,
  )
  expect(top).toBe('frame')

  await chapter(page).click({ modifiers: ['Alt'], force: true })
  await expect(copy(page)).toHaveCount(0)
  await expect(inspector(page)).toHaveAttribute('data-ctx', 'photo')

  await ctrlShift(page, p.x, p.y)
  await expect(copy(page)).toHaveCount(1)
  await expect(chapter(page)).toHaveCount(0)
  await expect(inspector(page)).toHaveAttribute('data-ctx', 'text')
  await expect(
    inspector(page).getByTestId('inspector-override-meta'),
  ).toHaveText('Override · Master A')
  await expect(inspector(page).getByTestId('z-front')).toHaveCount(0)
  // the copy keeps the parent slot: before every own frame in paint order
  const order = await current(page).evaluate((sp) =>
    [...sp.querySelectorAll('[data-frame]')].map((x) =>
      x.hasAttribute('data-override') ? 'copy' : x.getAttribute('data-testid'),
    ),
  )
  expect(order.indexOf('copy')).toBeLessThan(order.indexOf('frame'))
})

test('Ctrl+Shift on a copy reselects it with no undo step and moves it after 3 px; ↺ resets it', async ({
  page,
}) => {
  await openSpread(page)
  const p = await centre(chapter(page))
  await ctrlShift(page, p.x, p.y)
  await page.keyboard.press('Escape')
  await expect(inspector(page)).toHaveAttribute('data-ctx', 'spread')
  await ctrlShift(page, p.x, p.y)
  await expect(inspector(page)).toHaveAttribute('data-ctx', 'text')
  // one undo removes the copy: the reselect press added no step
  await page.keyboard.press('Control+z')
  await expect(copy(page)).toHaveCount(0)
  await expect(chapter(page)).toHaveCount(1)

  await ctrlShift(page, p.x, p.y, { x: p.x + 30, y: p.y })
  const moved = await centre(copy(page))
  expect(moved.x - p.x).toBeGreaterThan(25)
  await expect(changes(page)).toHaveCount(0) // a frame is selected: no spread inspector
  const reset = inspector(page).getByTestId('inspector-reset-parent')
  const rb = await reset.boundingBox()
  expect([rb?.width, rb?.height]).toEqual([28, 28])
  await reset.click()
  await expect(copy(page)).toHaveCount(0)
  await expect(chapter(page)).toHaveCount(1)
  await expect(inspector(page)).toHaveAttribute('data-ctx', 'spread')
  await expect(changes(page)).toHaveCount(0)
})

test('override badge follows the fit rule and is never clipped', async ({
  page,
}) => {
  await openSpread(page)
  const p = await centre(chapter(page))
  await ctrlShift(page, p.x, p.y)
  const ok = { inside: true, sized: true }
  // Fit: the 7 mm Chapter line is ~20 px high
  expect(await badgeState(page)).toMatchObject({
    want: 'none',
    shown: 'none',
    ...ok,
  })
  for (let i = 0; i < 3; i++) await page.keyboard.press('Control+=')
  const zoomed = await badgeState(page)
  expect(zoomed).toMatchObject({ want: 'full', shown: 'full', ...ok })
  await expect(badge(page)).toHaveText('override')
  await inspector(page).getByText('Position & size').click()
  const w = inspector(page).getByRole('textbox', { name: 'Width' })
  await w.fill(String(Math.max(5, Math.round(45 / zoomed.sc))))
  await w.press('Enter')
  expect(await badgeState(page)).toMatchObject({
    want: 'icon',
    shown: 'icon',
    ...ok,
  })
  await expect(badge(page)).toHaveAttribute('aria-label', 'Override')
})

test('Delete on a copy and a guide copy on the ruler hide; the spread lists them; ↺ and Reset all restore', async ({
  page,
}) => {
  await openSpread(page)
  await page.keyboard.press('Shift+R')
  await page.keyboard.press('Control+;')
  await showSpread(page)
  await expect(changes(page)).toHaveCount(0) // empty: nothing changed, no block
  // the own full-bleed frame goes, so the Chapter line is uncovered: a plain click names it
  await current(page).locator('[data-testid="frame"]').first().click()
  await page.keyboard.press('Delete')
  const p = await centre(chapter(page))
  await page.mouse.click(p.x, p.y)
  await expect(demo(page).getByTestId('status')).toHaveText(
    'Parent item from “Master A”. Ctrl+Shift+click to override it on this spread.',
  )

  await ctrlShift(page, p.x, p.y)
  await page.keyboard.press('Delete')
  await expect(copy(page)).toHaveCount(0)
  await expect(chapter(page)).toHaveCount(0)

  const guide = current(page).locator('[data-guide="mA-gl"]')
  const g = await centre(guide)
  const ruler = await centre(demo(page).getByTestId('ruler-x'))
  await ctrlShift(page, g.x, g.y, { x: g.x, y: ruler.y })
  await expect(guide).toHaveCount(0)

  await showSpread(page)
  await expect(rows(page)).toHaveText([
    'Text “Chapter”· hidden',
    'Guide · vertical 12 mm· hidden',
  ])
  await expect(changes(page)).toContainText('Changed from Master A')
  const sizes = await changes(page).evaluate((el) => {
    const h = (s: string) => el.querySelector(s)?.getBoundingClientRect().height
    return [
      h('[data-testid="parent-reset-all"]'),
      h('[data-testid="parent-change-row"]'),
      h('[data-testid="parent-change-reset"]'),
    ]
  })
  expect(sizes).toEqual([24, 28, 16])
  // Designer kit review: the row icon sits at x 0 of the row, like prod
  const iconInset = await rows(page)
    .first()
    .evaluate(
      (row) =>
        (row.querySelector('svg')?.getBoundingClientRect().left ?? NaN) -
        row.getBoundingClientRect().left,
    )
  expect(iconInset).toBe(0)
  await rows(page).first().getByTestId('parent-change-reset').click()
  await expect(chapter(page)).toHaveCount(1)
  await expect(rows(page)).toHaveCount(1)
  await changes(page).getByTestId('parent-reset-all').click()
  await expect(changes(page)).toHaveCount(0)
  await expect(guide).toHaveCount(1)
})

test('Ctrl+Shift-drag on a parent guide makes a spread copy at the drop', async ({
  page,
}) => {
  await openSpread(page)
  // guides are dragged in the rulers' single-spread camera (the stack has none)
  await page.keyboard.press('Shift+R')
  await page.keyboard.press('Control+;')
  const guide = current(page).locator('[data-guide="mA-gl"]')
  const g = await centre(guide)
  await ctrlShift(page, g.x, g.y, { x: g.x + 40, y: g.y })
  await expect(guide).toHaveCount(0)
  const own = current(page).locator('[data-guide]:not([data-passive])')
  await expect(own).toHaveCount(1)
  expect((await centre(own)).x - g.x).toBeGreaterThan(30)
  await showSpread(page)
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('· override')
})

// Moved from uikit/scripts/qa.mjs v8 / kit10 (uikit-qa-split-4): on the canvas screen the spread grid's grey parent
// values write nothing and own values reset (GP2 / GP3), link writes only the margins ≠ T in one undo step (GP5);
// in the kit10 #/demo walk master guides paint dashed under own guides and let clicks through (PG5 / PG2), and
// Ctrl+Shift+click on a parent item makes an override copy (PO2). Smoke ports also fail on a console error /
// warning, page error or failed request, like the qa.mjs smokeS().

const DEMO = '[data-testid="demo"]'
const Dm = (page: Page, s: string) => page.locator(`${DEMO} ${s}`)

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

/** two frames painted and no finite animation still running */
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

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

function must<T>(v: T | null, what: string): T {
  if (v === null) throw new Error(what)
  return v
}

/** smokeS(…, "canvas"): spread p3 picked and its grid set to Custom; console errors collected from the start */
async function canvasCustomGrid(page: Page) {
  const errs = watchErrors(page)
  await page.goto('/uikit/#/screen/canvas')
  const p3 = Dm(page, '[data-item="p3"]')
  await p3.scrollIntoViewIfNeeded()
  await p3.click()
  await expect(p3).toHaveAttribute('aria-selected', 'true')
  const sg = Dm(page, '[data-testid="spread-grid"]')
  await sg.getByText('Custom', { exact: true }).click()
  await expect(sg.getByRole('button', { name: 'Custom' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await settled(page)
  return { errs, sg }
}

const weight = (l: Locator) => l.evaluate((e) => getComputedStyle(e).fontWeight)

test('layout-grids-parent-inherit GP2/GP3: Custom is grey and writes nothing; G 8 is own (600 + ↺); ↺ restores it and Custom stays', async ({
  page,
}) => {
  const { errs, sg } = await canvasCustomGrid(page)
  const g = sg.locator('[data-testid="spread-grid-G"]')
  const reset = sg.locator('[data-testid="spread-grid-reset-G"]')
  const g0 = await g.inputValue()
  const w0 = await weight(g)
  const hint = await sg
    .locator('[data-testid="spread-grid-hint"]')
    .textContent()
  const r0 = await reset.count()
  const box0 = await box(g.locator('..'))
  await g.fill('8')
  await expect.poll(() => weight(g)).toBe('600')
  const w1 = await weight(g)
  const label = await reset.getAttribute('aria-label')
  const box1 = await box(g.locator('..'))
  await reset.click()
  await expect(reset).toHaveCount(0)
  await expect(g).toHaveValue(g0)
  const g2 = await g.inputValue()
  const r2 = await reset.count()
  const custom = await sg
    .getByRole('button', { name: 'Custom' })
    .getAttribute('aria-pressed')
  const info = `G ${g0} w${w0} → 8 w${w1} "${String(label)}" → ${g2}; ↺ ${String(r0)}/${String(r2)}; Custom ${String(custom)}; box ${String(box1.width)}x${String(box1.height)}; "${String(hint)}"`
  expect(
    w0 === '400' &&
      r0 === 0 &&
      w1 === '600' &&
      g2 === g0 &&
      r2 === 0 &&
      custom === 'true' &&
      box0.width === box1.width &&
      box0.height === box1.height &&
      (hint ?? '').startsWith('Grey values follow '),
    info,
  ).toBe(true)
  expect(errs).toEqual([])
})

test('layout-grids-parent-inherit GP5: link on writes only the margins ≠ T as spread overrides, in one undo step', async ({
  page,
}) => {
  const { errs, sg } = await canvasCustomGrid(page)
  // * = own (600)
  const read = () =>
    Promise.all(
      ['T', 'B', 'I', 'O'].map(async (k) => {
        const i = sg.locator(`[data-testid="spread-grid-${k}"]`)
        return `${await i.inputValue()}${(await weight(i)) === '600' ? '*' : ''}`
      }),
    ).then((v) => v.join('/'))
  const m0 = await read()
  const t = m0.split('/')[0] ?? ''
  const diff = m0
    .split('/')
    .map((v, i) => (i && v !== t ? `${t}*` : v))
    .join('/')
  expect(m0).not.toBe(`${t}/${t}/${t}/${t}`)
  await sg.locator('[data-testid="spread-grid-link"]').click()
  await expect.poll(read).toBe(diff)
  await page.keyboard.press('Control+z')
  await expect.poll(read).toBe(m0)
  expect(errs).toEqual([])
})

test('kit10 #/demo: parent-guides PG5 / PG2 and parent-overrides PO2 on a Master A spread', async ({
  page,
}) => {
  // kit10 walk opening: fresh #/demo, library, a new book, a photo folder, spread p1
  await page.goto('/uikit/#/demo')
  await expect(demo(page)).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: { reset: () => void } }).__demo.reset()
  })
  const c = (sel: string) => page.locator(sel).first().click() // dialogs portal outside the demo root
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
  await settled(page)
  // kit10 steps before the parent checks (their state feeds them): the low-res photo p02 on p1's first frame,
  // rulers (Shift+R) + guides (Ctrl+;) on, a guide dragged onto the spread, rulers off, p1 duplicated,
  // a master guide and master Page numbers, back to Pages on p1
  const filmRow = Dm(page, '[data-testid="filmstrip"] [role="row"]').nth(1)
  await filmRow.dragTo(
    Dm(
      page,
      '[data-testid="canvas"] [data-current] [data-testid="frame"]',
    ).first(),
  )
  await expect(filmRow.getByTestId('filmstrip-placed')).toHaveCount(1)
  await page.keyboard.press('Shift+R')
  await page.keyboard.press('Control+;')
  const rulerX = Dm(page, '[data-testid="ruler-x"]')
  await expect(rulerX).toBeVisible()
  await settled(page)
  const spreadGuides = Dm(page, '[data-testid="spread"] [data-guide]')
  const g0 = await spreadGuides.count()
  const rx = await box(rulerX)
  const sp = await box(Dm(page, '[data-testid="spread"]').first())
  await page.mouse.move(rx.x + rx.width / 2, rx.y + 10)
  await page.mouse.down()
  await page.mouse.move(rx.x + rx.width / 2, sp.y + sp.height * 0.4, {
    steps: 6,
  })
  await page.mouse.up()
  await expect(spreadGuides).toHaveCount(g0 + 1)
  await page.keyboard.press('Shift+R')
  await expect(rulerX).toHaveCount(0)
  await Dm(page, '[data-item="p1"]').hover()
  await c('[data-item="p1"] [data-testid="spread-menu"]')
  await page.getByRole('menuitem', { name: /Duplicate/ }).click()
  await expect(page.getByRole('menuitem')).toHaveCount(0)
  const modeSeg = Dm(page, '[data-testid="mode-seg"]')
  const master = Dm(page, '[data-testid="canvas-master"]')
  await modeSeg.getByText('Masters', { exact: true }).click()
  await expect(master).toBeVisible()
  await page.keyboard.press('Shift+R')
  const rulerY = Dm(page, '[data-testid="ruler-y"]')
  await expect(rulerY).toBeVisible()
  await settled(page)
  const masterGuides = Dm(page, '[data-testid="node-view"] [data-guide]')
  const m0 = await masterGuides.count()
  const ry = await box(rulerY)
  const mb = await box(master)
  await page.mouse.move(ry.x + 10, ry.y + ry.height / 2)
  await page.mouse.down()
  await page.mouse.move(mb.x + mb.width * 0.3, ry.y + ry.height / 2, {
    steps: 6,
  })
  await page.mouse.up()
  await expect(masterGuides).toHaveCount(m0 + 1)
  const pnSwitch = page
    .locator(
      '[data-testid="insp-master"] [role=switch][aria-label="Page numbers"]',
    )
    .first()
  await pnSwitch.click()
  await expect(pnSwitch).toHaveAttribute('aria-checked', 'true')
  await modeSeg.getByText('Pages', { exact: true }).click()
  await expect(master).toHaveCount(0)
  await c('[data-item="p1"]')
  await expect(
    Dm(page, '[data-testid="panel-l"] [data-item="p1"]'),
  ).toHaveAttribute('aria-selected', 'true')
  await settled(page)

  // parent-guides PG5: inherited guides are dashed --parent-soft, 24 px past the page, under own guides and pointer-transparent
  const pg = await page.evaluate((demo) => {
    const sp = document.querySelector(
      `${demo} [data-testid="spread"][data-current]`,
    )
    if (!sp) throw new Error('no current spread')
    const all = [...sp.querySelectorAll<HTMLElement>('[data-guide]')]
    const inh = all.filter((g) => g.dataset.passive !== undefined)
    const firstOwn = all.findIndex((g) => g.dataset.passive === undefined)
    const lastInh = inh.at(-1)
    const order =
      firstOwn === -1 || (!!lastInh && firstOwn > all.indexOf(lastInh))
    const look = inh.map((g) => {
      const ln = g.firstElementChild as HTMLElement
      const cs = getComputedStyle(ln)
      const v = g.offsetHeight > g.offsetWidth
      const par = g.offsetParent as HTMLElement
      return {
        v,
        img: cs.backgroundImage,
        w: v ? ln.offsetWidth : ln.offsetHeight,
        pe: getComputedStyle(g).pointerEvents,
        over: v
          ? [-g.offsetTop, g.offsetHeight - par.clientHeight + g.offsetTop]
          : [-g.offsetLeft, g.offsetWidth - par.clientWidth + g.offsetLeft],
      }
    })
    // a point on an inherited line inside an own frame: elementFromPoint must be that frame
    let hit: {
      x: number
      y: number
      id: string | undefined
      at: string | null
    } | null = null
    for (const g of inh) {
      const line = g.firstElementChild
      if (!line) continue
      const r = line.getBoundingClientRect()
      const v = r.height > r.width
      for (const f of sp.querySelectorAll<HTMLElement>(
        '[data-testid="frame"]',
      )) {
        const b = f.getBoundingClientRect()
        const x = v ? r.left + r.width / 2 : b.left + b.width / 2
        const y = v ? b.top + b.height / 2 : r.top + r.height / 2
        if (
          x > b.left + 2 &&
          x < b.right - 2 &&
          y > b.top + 2 &&
          y < b.bottom - 2
        ) {
          hit = {
            x,
            y,
            id: f.dataset.frame,
            at:
              document
                .elementFromPoint(x, y)
                ?.closest<HTMLElement>('[data-frame]')?.dataset.frame ?? null,
          }
          break
        }
      }
      if (hit) break
    }
    return { n: inh.length, order, look, hit }
  }, DEMO)
  expect
    .soft(
      pg.n >= 1 &&
        pg.order &&
        pg.look.every(
          (l) =>
            /repeating-linear-gradient\(.*rgb\(163, 161, 162\)/.test(l.img) &&
            l.w === 1 &&
            l.pe === 'none' &&
            l.over[0] === 24 &&
            l.over[1] === 24,
        ),
      `parent-guides PG5: a Master A spread shows its master's guides dashed rgb(163, 161, 162), 1 px, 24 px past the page, pointer-events none, under own guides: ${JSON.stringify({ n: pg.n, order: pg.order, look: pg.look[0] })}`,
    )
    .toBe(true)
  expect
    .soft(
      !!pg.hit && pg.hit.at === pg.hit.id,
      `parent-guides PG2: elementFromPoint on a parent guide over a frame is the frame: ${JSON.stringify(pg.hit)}`,
    )
    .toBe(true)
  const handles = Dm(page, '[data-current] [data-testid="sel-handle"]')
  const hit = must(pg.hit, 'no parent guide over a frame')
  await page.mouse.click(hit.x, hit.y)
  await expect(handles.first()).toBeVisible()
  const pgStatus =
    (await Dm(page, '[data-testid="status"]').textContent()) ?? ''
  // parent-guides PG2: a click on a parent guide selects the frame below, no status
  expect.soft(await handles.count(), pgStatus).toBeGreaterThan(0)
  expect.soft(pgStatus).not.toMatch(/parent spread/)
  await page.keyboard.press('Escape')
  await settled(page)
  await Dm(page, '[data-current] [data-testid="master-frame"]')
    .first()
    .click({ modifiers: ['Control', 'Shift'], force: true })
  // parent-overrides PO2: Ctrl+Shift+click on a parent item makes an override copy
  await expect(
    Dm(page, '[data-testid="spread"][data-current] [data-override]'),
  ).toHaveCount(1)
})
