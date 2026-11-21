import type { Locator, Page } from '@playwright/test'
import { topAt } from './fixtures/paintProbe'
import { expect, test } from './fixtures/coverage'

// Designer cycle-layouts CL2 (kit, Owner Q-27): the layout pill centred 8 px above the active paper, ‹ › and ⇧[ / ⇧]
// step the spread through the picker layouts with its photo count; a run of presses is one undo step (D5) and the
// frames keep their photos and per-frame props (D6). Prod twin: e2e/cycle-layouts.spec.ts (CL3).

test.use({
  viewport: { width: 1440, height: 900 },
  launchOptions: { args: ['--font-render-hinting=none'] },
})

const DEMO = '[data-testid="demo"]'
const PILL = `${DEMO} [data-testid="layout-cycle"]`
const D = (page: Page, s: string) => page.locator(`${DEMO} ${s}`)

interface Fr {
  id: string
  kind: string
  x: number
  y: number
  w: number
  h: number
  photo: string | null
  rot: number
  [k: string]: unknown
}
interface DemoApi {
  reset: () => void
  state: () => {
    path: string
    books: {
      id: string
      title: string
      book: Record<string, unknown>
      doc?: { spreads: { id: string; template: string | null; frames: Fr[] }[] }
    }[]
    open: string
  }
  go: (view: string) => void
}

function watchErrors(page: Page) {
  const errs: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning')
      errs.push(`${m.type()}: ${m.text().slice(0, 240)}`)
  })
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`))
  return errs
}

async function settled(page: Page) {
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  )
}

/** #/demo with one A5 book open, a folder of photos added, spread 2–3 (p1) current at Fit */
async function demoBook(page: Page) {
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(() => {
    const d = (window as unknown as { __demo: DemoApi }).__demo
    d.reset()
    const s = d.state()
    s.path = '~/Pictures/Photobooks'
    s.books = [
      {
        id: 's1',
        title: 'Cycle',
        book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: 'A5' },
      },
    ]
    s.open = 's1'
    d.go('editor')
  })
  await expect(D(page, '[data-testid="dock"]')).toBeVisible()
  await page.locator('[data-testid="demo-add-folder"]').first().click()
  await page
    .locator('[role=dialog]')
    .getByRole('button', { name: /Select/i })
    .last()
    .click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await D(page, '[data-item="p1"]').click()
  await expect(page.locator(PILL)).toBeVisible()
  await settled(page)
}

/** Patch the image frames of spread `si` in the saved demo doc (`{i}` in a string prop = the frame index), set its
 *  template if given, and reopen the editor on it. */
async function reshape(
  page: Page,
  si: number,
  props: Record<string, unknown>,
  template?: string | null,
) {
  await page.evaluate(
    ({ si, props, template }) => {
      const d = (window as unknown as { __demo: DemoApi }).__demo
      const b = d.state().books.at(0)
      const s = b?.doc?.spreads.at(si)
      if (!b?.doc || !s) throw new Error('no saved doc')
      const patch = (i: number) =>
        Object.fromEntries(
          Object.entries(props).map(([k, v]) => [
            k,
            typeof v === 'string' ? v.replace('{i}', String(i)) : v,
          ]),
        )
      b.doc.spreads[si] = {
        ...s,
        frames: s.frames.map((f, i) =>
          f.kind === 'image' ? { ...f, ...patch(i) } : f,
        ),
        ...(template === undefined ? {} : { template }),
      }
      d.go('library')
    },
    { si, props, template },
  )
  await settled(page)
  await page.evaluate(() => {
    ;(window as unknown as { __demo: DemoApi }).__demo.go('editor')
  })
  await expect(D(page, '[data-testid="dock"]')).toBeVisible()
  await D(page, `[data-item="p${String(si)}"]`).click()
  await settled(page)
}

/** the saved doc's spread `si` after a round trip through the library (the demo saves on leaving the editor) */
async function savedSpread(page: Page, si: number) {
  await page.evaluate(() => {
    ;(window as unknown as { __demo: DemoApi }).__demo.go('library')
  })
  await settled(page)
  const s = await page.evaluate(
    (si) =>
      (window as unknown as { __demo: DemoApi }).__demo
        .state()
        .books.at(0)
        ?.doc?.spreads.at(si),
    si,
  )
  await page.evaluate(() => {
    ;(window as unknown as { __demo: DemoApi }).__demo.go('editor')
  })
  await expect(D(page, '[data-testid="dock"]')).toBeVisible()
  await D(page, `[data-item="p${String(si)}"]`).click()
  await settled(page)
  if (!s) throw new Error('no saved spread')
  return s
}

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}
const paper = (page: Page) =>
  D(page, '[data-testid="spread"][data-current]').first()
const name = (page: Page) =>
  page.locator(`${PILL} [data-testid="layout-cycle-name"]`)
const pos = (page: Page) =>
  page.locator(`${PILL} [data-testid="layout-cycle-pos"]`)
/** n of the pill's `i/n` */
const total = async (page: Page) =>
  Number((await pos(page).innerText()).split('/')[1])

test('cycle-layouts CL2 (#/demo): the pill sits centred 8 px above the paper, 28 high, same width across presses', async ({
  page,
}) => {
  const errs = watchErrors(page)
  await demoBook(page)
  const pill = page.locator(PILL)
  await expect(pill).toHaveAttribute('role', 'group')
  await expect(pill).toHaveAttribute('aria-label', 'Layout')
  const p = await box(paper(page))
  const b = await box(pill)
  expect(Math.abs(b.x + b.width / 2 - (p.x + p.width / 2))).toBeLessThanOrEqual(
    0.5,
  )
  expect(Math.abs(b.y + b.height - (p.y - 8))).toBeLessThanOrEqual(0.5)
  expect(b.height).toBe(28)
  // Spec numbers at Fit 1440×900 on spread 2–3: x 676, y 71.02–99.02
  expect(
    Math.abs(b.x + b.width / 2 - 676),
    JSON.stringify({ b, p }),
  ).toBeLessThanOrEqual(1)
  expect(Math.abs(b.y - 71.02), JSON.stringify({ b, p })).toBeLessThanOrEqual(1)
  // paint: the pill is on top at its centre and over each arrow
  expect((await topAt(pill))[0]).toContain('layout-cycle')
  for (const id of ['layout-cycle-prev', 'layout-cycle-next']) {
    const a = pill.getByTestId(id)
    expect(await box(a)).toMatchObject({ width: 24, height: 24 })
    expect((await topAt(a)).at(0)?.at(0)).toBe(id)
  }
  // › walks the whole set and wraps; the arrows never move (D7)
  const n = await total(page)
  expect(n).toBeGreaterThanOrEqual(2)
  const first = await name(page).innerText()
  const seen = new Set<string>()
  for (let i = 0; i < n; i++) {
    await pill.getByTestId('layout-cycle-next').click()
    seen.add(await name(page).innerText())
    const nb = await box(pill)
    expect(nb.width).toBe(b.width)
    expect(nb.x).toBe(b.x)
  }
  expect(seen.size).toBe(n)
  await expect(name(page)).toHaveText(first)
  // a press keeps the paper and the pill in place, and no status line appears for it
  expect(await box(paper(page))).toEqual(p)
  expect(errs).toEqual([])
})

test('design-parity p4 (#/demo): a new book centres page 1 in the 56/48 band at a width-limited Fit (prod placedScroll)', async ({
  page,
}) => {
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(() => {
    const d = (window as unknown as { __demo: DemoApi }).__demo
    d.reset()
    const s = d.state()
    s.books = [
      {
        id: 's1',
        title: 'Band',
        book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: 'A5' },
      },
    ]
    s.open = 's1'
    d.go('editor')
  })
  await expect(D(page, '[data-testid="dock"]')).toBeVisible()
  await settled(page)
  const pb = await box(D(page, '[data-testid="pasteboard"]'))
  const p = await box(paper(page))
  expect(p.height, 'width-limited Fit').toBeLessThan(pb.height - 56 - 48)
  const want = 56 + (pb.height - 56 - 48 - p.height) / 2
  expect(
    Math.abs(p.y - pb.y - want),
    JSON.stringify({ pb, p }),
  ).toBeLessThanOrEqual(0.5)
})

test('cycle-layouts CL2 (#/demo): page 1 centres the pill on the page, not the slot', async ({
  page,
}) => {
  await demoBook(page)
  await D(page, '[data-item="p0"]').click()
  await settled(page)
  const pill = page.locator(PILL)
  await expect(pill).toBeVisible()
  const p = await box(paper(page))
  const b = await box(pill)
  expect(
    Math.abs(b.x + b.width / 2 - (p.x + (p.width * 3) / 4)),
  ).toBeLessThanOrEqual(0.5)
  expect(Math.abs(b.y + b.height - (p.y - 8))).toBeLessThanOrEqual(0.5)
})

test('cycle-layouts CL2 (#/demo): hidden at gap < 63, in Preview and Masters; ⇧] still works without room', async ({
  page,
}) => {
  await demoBook(page)
  const pill = page.locator(PILL)
  const before = await name(page).innerText()
  // 50 %: gap 53 < 63
  await D(page, '[data-testid="zoom-menu"]').click()
  await page.getByRole('menuitem', { name: '50%', exact: true }).click()
  await settled(page)
  await expect(pill).toHaveCount(0)
  await page.keyboard.press('Shift+BracketRight')
  await D(page, '[data-testid="zoom-menu"]').click()
  await page.getByRole('menuitem', { name: /Fit spread/ }).click()
  await settled(page)
  await expect(pill).toBeVisible()
  await expect(name(page)).not.toHaveText(before)

  await D(page, '[data-testid="mode-seg"]')
    .getByText('Masters', { exact: true })
    .click()
  await settled(page)
  await expect(pill).toHaveCount(0)
  await D(page, '[data-testid="mode-seg"]')
    .getByText('Pages', { exact: true })
    .click()
  await settled(page)
  await D(page, '[data-item="p1"]').click()
  await expect(pill).toBeVisible()

  // the demo's Preview is a modal over the editor: the pill is not painted and ⇧] does nothing
  const shown = await name(page).innerText()
  await page.getByTestId('demo-preview').click()
  await expect(page.getByTestId('site-preview')).toBeVisible()
  await settled(page)
  expect((await topAt(pill)).at(0)).not.toContain('layout-cycle')
  await page.keyboard.press('Shift+BracketRight')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('site-preview')).toHaveCount(0)
  await expect(name(page)).toHaveText(shown)
})

test('cycle-layouts CL2 (#/demo): ⇧] applies while ] still toggles the inspector; 3 presses then Ctrl+Z = 1 step', async ({
  page,
}) => {
  await demoBook(page)
  const first = await name(page).innerText()
  const toggle = D(page, '[data-testid="toggle-r"]')
  const open0 = await toggle.getAttribute('aria-pressed')
  await page.keyboard.press(']')
  await expect(toggle).not.toHaveAttribute('aria-pressed', open0 ?? '')
  await expect(name(page)).toHaveText(first)
  await page.keyboard.press(']')
  await expect(toggle).toHaveAttribute('aria-pressed', open0 ?? '')

  const undo = D(page, '[data-testid="undo"]')
  const undo0 = await undo.getAttribute('aria-label')
  await page.keyboard.press('Shift+BracketRight')
  await expect(name(page)).not.toHaveText(first)
  await expect(toggle).toHaveAttribute('aria-pressed', open0 ?? '')
  await expect(undo).toHaveAttribute(
    'aria-label',
    'Undo “Change layout” (Ctrl+Z)',
  )
  await page.keyboard.press('Shift+BracketRight')
  await page.keyboard.press('Shift+BracketLeft')
  await page.keyboard.press('Control+z')
  await expect(name(page)).toHaveText(first)
  await expect(undo).toHaveAttribute('aria-label', undo0 ?? '')
  // ‹ from the start wraps to the last layout
  const n = await total(page)
  await page.locator(`${PILL} [data-testid="layout-cycle-prev"]`).click()
  await expect(pos(page)).toHaveText(`${String(n)}/${String(n)}`)
})

test('cycle-layouts CL2 (#/demo): a layout change keeps ids, photos and per-frame props; › then ‹ gives the same frames', async ({
  page,
}) => {
  await demoBook(page)
  await reshape(page, 1, {
    rot: 0,
    fit: 'fit',
    caption: 'cap {i}',
    locked: true,
    styleId: 'st-hair',
    adj: { b: 10, c: -5, s: 3 },
    zoom: 1.5,
    ox: 0.25,
    oy: -0.5,
  })
  const s0 = await savedSpread(page, 1)
  await page.keyboard.press('Shift+BracketRight')
  const s1 = await savedSpread(page, 1)
  expect(s1.template).not.toBe(s0.template)
  const img = (s: typeof s0) => s.frames.filter((f) => f.kind === 'image')
  const keep = (f: Fr) =>
    Object.fromEntries(
      Object.entries(f).filter(([k]) => !['x', 'y', 'w', 'h'].includes(k)),
    )
  expect(img(s1).map(keep)).toEqual(img(s0).map(keep))
  expect(img(s1).map((f) => [f.x, f.y, f.w, f.h])).not.toEqual(
    img(s0).map((f) => [f.x, f.y, f.w, f.h]),
  )
  await page.keyboard.press('Shift+BracketLeft')
  const s2 = await savedSpread(page, 1)
  expect(s2.template).toBe(s0.template)
  expect(s2.frames).toEqual(s0.frames)

  // the inspector picker rebinds the same way (D6 picker parity); its frames take new ids (live-captions §6 freeze)
  const other = await page
    .locator(`${PILL} .lc-w`)
    .evaluateAll(
      (els, cur) =>
        els.map((e) => e.textContent).find((t) => t && t !== cur) ?? '',
      await name(page).innerText(),
    )
  await D(page, '[data-testid="inspector"]')
    .getByRole('button', { name: `Apply layout ${other}` })
    .click()
  await expect(name(page)).toHaveText(other)
  const s3 = await savedSpread(page, 1)
  const noId = (f: Fr) => {
    const k = keep(f)
    delete k.id
    return k
  }
  expect(img(s3).map(noId)).toEqual(img(s0).map(noId))
  expect(img(s3).map((f) => f.id)).not.toEqual(img(s0).map((f) => f.id))
})

test('cycle-layouts CL2 (#/demo): Custom after a hand move; › applies the first layout', async ({
  page,
}) => {
  await demoBook(page)
  await reshape(page, 1, {}, null)
  await expect(name(page)).toHaveText('Custom')
  const n = await total(page)
  await expect(pos(page)).toHaveText(`–/${String(n)}`)
  await page.locator(`${PILL} [data-testid="layout-cycle-next"]`).click()
  await expect(pos(page)).toHaveText(`1/${String(n)}`)
})
