import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit editor chrome (moved from uikit/scripts/qa.mjs v7 / v0.7.1 / v0.7.2 /
// v0.7.3 / v0.9 / v0.9.1 / v0.9.3 / kit10, uikit-qa-split-3): the kit chrome
// tones, ONE editor on every page, the panel keyboard (Tab / Ctrl+. / Space
// held / hidden panels inert), the #/full pages loading clean, the demo top
// bar buttons, and the #/demo top bar (view toggles, tools toolbar, narrow
// widths, no default guides / rulers / overlays / dpi badge). Smoke ports also
// fail on a console error / warning, page error or failed request, like the
// qa.mjs smoke() helpers.

test.use({ viewport: { width: 1440, height: 900 } })

const UIKIT = path.resolve(process.cwd(), 'uikit')
const readKit = (f: string) =>
  fs.readFileSync(path.join(UIKIT, 'src', 'kit', f), 'utf8')
const screenIds = (JSON.parse(readKit('screens.json')) as { id: string }[]).map(
  (s) => s.id,
)
const slugs = (JSON.parse(readKit('pages.json')) as { slug: string }[]).map(
  (p) => p.slug,
)
const editorPages = [
  ...screenIds.map((s) => `#/screen/${s}`),
  ...slugs.map((s) => `#/feature/${s}`),
]

const demo = '[data-testid="demo"]'
const D = (page: Page, s: string) => page.locator(`${demo} ${s}`)
const E = (page: Page, s: string) => D(page, `[data-testid="editor7"] ${s}`)
const A5 = { endp: true, endpSame: true, w: 14.8, h: 21, preset: 'A5' }
/** "<n> pages" with a plain or a no-break space, as in qa.mjs */
const PAGES = /(\d+)[ \xa0]pages/

interface DemoApi {
  reset: () => void
  state: () => {
    path: string
    books: { id: string; title: string; book: typeof A5 }[]
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

/** a kit page with its demo painted */
async function open(page: Page, hash: string) {
  await page.goto(`/uikit/${hash}`)
  await expect(page.locator(demo)).toBeVisible()
  await settled(page)
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

/** #/demo editor on one A5 book */
async function demoEditor(page: Page, title: string) {
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(
    ({ title, book }) => {
      const d = (window as unknown as { __demo: DemoApi }).__demo
      d.reset()
      d.state().path = '~/Pictures/Photobooks'
      d.state().books = [{ id: 's1', title, book }]
      d.state().open = 's1'
      d.go('editor')
    },
    { title, book: A5 },
  )
  await expect(page.locator('[data-testid="demo-publish"]')).toBeVisible()
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
  await expect(
    D(page, '[data-testid="panel-l"] [data-item="p1"]'),
  ).toHaveAttribute('aria-selected', 'true')
  await settled(page)
}

/** "lbr": 1 per editor panel shown (wider / taller than 2 px), 0 per hidden one */
const panelW = (page: Page) =>
  page.evaluate(() =>
    ['l', 'b', 'r']
      .map((k) => {
        const e = document.querySelector(
          `[data-testid="demo"] [data-testid="panel-${k}"]`,
        )
        if (!e) return 0
        const r = e.getBoundingClientRect()
        return (k === 'b' ? r.height : r.width) > 2 ? 1 : 0
      })
      .join(''),
  )
const hiddenPanels = (page: Page) =>
  page.evaluate(() => document.querySelectorAll('[data-hidden-panel]').length)

/** panel visibility is a global store: start from all panels shown */
async function panelsShown(page: Page) {
  if (await hiddenPanels(page)) await page.keyboard.press('Control+.')
  await expect.poll(() => hiddenPanels(page)).toBe(0)
  await settled(page)
}

/** the #/demo top-bar book title: ellipsis, clip, right edges, the size text width */
const bookTitle = (page: Page) =>
  page.evaluate(() => {
    const b = document.querySelector(
      '[data-testid="demo"] [data-testid="book-title"]',
    )
    const e = b?.firstElementChild
    const size = b?.querySelector('[data-testid="book-size"]')
    if (!b || !e || !size) throw new Error('no book title')
    const r = e.getBoundingClientRect()
    const s = getComputedStyle(e)
    return {
      to: s.textOverflow,
      ov: s.overflowX,
      cut: e.scrollWidth > e.clientWidth,
      w: +r.width.toFixed(2),
      right: +r.right.toFixed(2),
      box: +b.getBoundingClientRect().right.toFixed(2),
      size: +size.getBoundingClientRect().width.toFixed(2),
    }
  })

/** panels after a Tab from a button inside the canvas ("111" when the canvas has none) */
async function innerTab(page: Page, w: () => Promise<string>) {
  const inner = E(page, '[data-testid="canvas"] button').first()
  if (!(await inner.count())) return '111'
  await inner.focus()
  await page.keyboard.press('Tab')
  await settled(page)
  return w()
}

/** one kit page: editor count, v7-framed editor count, old markers, dark spread outlines; "" when clean */
async function editorPageCheck(page: Page, id: string) {
  await open(page, id)
  const r = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-testid="demo"]')
    if (!root) throw new Error('no demo')
    const t = root.innerText
    const ed = root.querySelectorAll('[data-testid="editor"]').length
    const ed7 = root.querySelectorAll(
      '[data-testid="editor7"] [data-testid="editor"]',
    ).length
    const mk = ['Spreads 8', '1 Cover', 'Spread 1 · cover'].filter((m) =>
      t.includes(m),
    )
    const dark = [
      ...root.querySelectorAll<HTMLElement>(
        '[data-testid="spread"], [data-testid="spread-layer"] > *',
      ),
    ].filter((e) => {
      const s = getComputedStyle(e)
      return (
        s.outlineStyle !== 'none' &&
        parseFloat(s.outlineWidth) > 0 &&
        /rgb\((3[0-9]|[0-2]?[0-9]), /.test(s.outlineColor) &&
        e.dataset.testid !== 'sel-outline'
      )
    }).length
    return { ed, ed7, mk, dark }
  })
  const bad =
    r.ed !== r.ed7 || r.mk.length || r.dark
      ? `${id}:${String(r.ed)}/${String(r.ed7)} ${r.mk.join()} dark=${String(r.dark)}`
      : ''
  return { id, editor: r.ed > 0, bad }
}

/** the page count in the demo header text, 0 when absent */
async function headerPages(page: Page) {
  const txt = await page.locator(demo).innerText()
  return +(PAGES.exec(txt)?.[1] ?? 0)
}

// ───────── v7: kit chrome ─────────

test('v7 kit chrome: no borders, #CACACA nav, opaque #E1E1E1 header, Inter + Lora, #D7D7D7 hover, no #232223 fills', async ({
  page,
}) => {
  await page.goto('/uikit/#/')
  await expect(page.locator('[data-nav="index"]')).toBeVisible()
  await settled(page)
  const r = await page.evaluate(() => {
    const bad: string[] = []
    const q = (s: string) => document.querySelector(s)
    for (const e of document.querySelectorAll(
      'header *, header, main *:not([data-testid=demo] *)',
    )) {
      if (e.closest('[data-testid="demo"]')) continue
      const s = getComputedStyle(e)
      for (const k of ['Top', 'Right', 'Bottom', 'Left'] as const)
        if (
          parseFloat(s[`border${k}Width`]) > 0 &&
          s[`border${k}Style`] !== 'none' &&
          !s[`border${k}Color`].includes('rgba(0, 0, 0, 0)') &&
          !e.matches('input, [role=searchbox], [role=checkbox] *, select')
        )
          bad.push(
            `${e.tagName}:${(e.getAttribute('class') ?? '').slice(0, 40)}`,
          )
    }
    const nav = q('[data-nav="index"]')
    const comp = q('[data-nav="components"]')
    const hdr = q('header')
    if (!nav || !comp || !hdr) throw new Error('no kit nav / header')
    return {
      bad: [...new Set(bad)].slice(0, 5),
      n: bad.length,
      nav: getComputedStyle(nav).backgroundColor,
      cur: nav.getAttribute('aria-current'),
      comp: getComputedStyle(comp).backgroundColor,
      hdr: getComputedStyle(hdr).backgroundColor,
      font: getComputedStyle(document.body).fontFamily,
      h: getComputedStyle(q('.heading') ?? document.body).fontFamily,
    }
  })
  // v7 kit chrome: no borders or lines in header / index / docs chrome
  expect(r.n, r.bad.join(' | ')).toBe(0)
  // v7 kit nav: selected #CACACA (not black), aria-current
  expect(r.nav).toBe('rgb(202, 202, 202)')
  expect(r.cur).toBe('page')
  expect(r.comp).not.toBe('rgb(202, 202, 202)')
  // v7 kit header opaque #E1E1E1; fonts Inter + Lora
  expect(r.hdr).toBe('rgb(225, 225, 225)')
  expect(r.font).toMatch(/Inter/)
  expect(r.h).toMatch(/Lora/)
  // v7 kit nav hover #D7D7D7
  await page.hover('[data-nav="components"]')
  await expect(page.locator('[data-nav="components"]')).toHaveCSS(
    'background-color',
    'rgb(215, 215, 215)',
  )
  // v7 kit chrome: no #232223 fills outside primary buttons
  const blk = await page.evaluate(
    () =>
      [...document.querySelectorAll('header *, main *')].filter(
        (e) =>
          !e.closest('[data-testid="demo"]') &&
          getComputedStyle(e).backgroundColor === 'rgb(35, 34, 35)' &&
          !e.matches('button, a[class*=bg-primary]'),
      ).length,
  )
  expect(blk).toBe(0)
})

test('v7 kit links #393738/#535152 tone, not underlined at rest; demo frame: no border, chrome tone', async ({
  page,
}) => {
  await open(page, '#/feature/spread-list-panel')
  const r = await page.evaluate(() => {
    const ls = [...document.querySelectorAll<HTMLElement>('main a')].filter(
      (a) =>
        !a.closest('[data-testid="demo"]') &&
        a.innerText.trim() &&
        !a.closest('header'),
    )
    return ls
      .slice(0, 20)
      .map((a) => [
        getComputedStyle(a).color,
        getComputedStyle(a).textDecorationLine,
      ])
  })
  expect(r.length, JSON.stringify(r.slice(0, 3))).toBeGreaterThan(0)
  expect(
    r.every(
      ([c = '', d = '']) =>
        !d.includes('underline') &&
        !/rgb\(\d+, \d+, (1\d\d|2\d\d)\)/.test(
          c.replace(/rgb\((\d+), \d+, \1\)/, ''),
        ),
    ),
    JSON.stringify(r.slice(0, 3)),
  ).toBe(true)
  const dm = await page.locator(demo).evaluate((d) => {
    const s = getComputedStyle(d)
    return [s.borderTopWidth, s.borderTopStyle, s.backgroundColor]
  })
  expect(dm[0] === '0px' || dm[1] === 'none', dm.join(' ')).toBe(true)
  expect(dm[2], dm.join(' ')).toBe('rgb(225, 225, 225)')
})

// ───────── v0.7.1: no keyboard trap, one editor ─────────

test('screen canvas: v7.1 P1 #2: no keyboard trap — Tab hides only from the bare canvas, 2nd Tab moves on, Shift/Ctrl+Tab and inner focus never hide; Cmd/Ctrl+. toggles', async ({
  page,
}) => {
  const errs = await openCanvas(page)
  const w = () =>
    page.evaluate(() =>
      ['l', 'b', 'r']
        .map((k) => {
          const e = document.querySelector(
            `[data-testid="editor7"] [data-testid="panel-${k}"]`,
          )
          if (!e) throw new Error(`no panel-${k}`)
          const r = e.getBoundingClientRect()
          return (k === 'b' ? r.height : r.width) > 2 ? 1 : 0
        })
        .join(''),
    )
  const act = () =>
    page.evaluate(
      () =>
        document.activeElement?.getAttribute('data-testid') ??
        document.activeElement?.tagName,
    )
  const canvas = E(page, '[data-testid="canvas"]')
  await canvas.focus()
  await page.keyboard.press('Shift+Tab')
  await settled(page)
  const a = await w()
  await canvas.focus()
  await page.keyboard.press('Control+Tab')
  await settled(page)
  const b = await w()
  const c = await innerTab(page, w)
  await canvas.focus()
  await page.keyboard.press('Tab')
  await expect.poll(w).toBe('000')
  await settled(page)
  const d = await w()
  const f1 = await act()
  await page.keyboard.press('Tab')
  const f2 = await act()
  const later: (string | undefined)[] = []
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab')
    later.push(await act())
  }
  await page.keyboard.press('Control+.')
  await expect.poll(w).toBe('111')
  const e = await w()
  const info = `shift=${a} ctrl=${b} inner=${c} tab=${d} focus ${String(f1)}→${String(f2)} later=${later.join()} ctrl+.=${e}`
  expect([a, b, c, d, e], info).toEqual(['111', '111', '111', '000', '111'])
  expect(f1, info).toBe('canvas')
  expect(f2, info).not.toBe('canvas')
  // back-on-canvas = 0
  expect(later, info).not.toContain('canvas')
  expect(errs).toEqual([])
})

test("v7.1 P1 #3: ONE editor — every editor demo is the v7 frame, editor7.tsx removed, no 'Spreads 8' / '1 Cover' / 'Spread 1 · cover' / dark spread outline anywhere", async ({
  page,
}) => {
  const rs: Awaited<ReturnType<typeof editorPageCheck>>[] = []
  for (const id of editorPages) rs.push(await editorPageCheck(page, id))
  const tried = rs.filter((r) => r.editor)
  const bad = rs.map((r) => r.bad).filter(Boolean)
  const info = `${String(tried.length)} pages with an editor; bad=${bad.slice(0, 6).join(' ; ')}`
  expect(bad, info).toEqual([])
  expect(
    fs.existsSync(path.join(UIKIT, 'src', 'features', 'editor7.tsx')),
  ).toBe(false)
  expect(tried.length, info).toBeGreaterThan(10)
})

// ───────── v0.7.2: hidden panels inert, page count, clean #/full loads ─────────

for (const label of ['#/full/canvas', '#/screen/canvas']) {
  test(`v7.2 P0-1: ${label}: Ctrl+. → every panel inert + aria-hidden, Tab never lands inside; Ctrl+. again → panels interactive again`, async ({
    page,
  }) => {
    await page.goto(`/uikit/${label}`)
    await expect(page.locator('[data-testid="panel-l"]').first()).toBeVisible()
    await settled(page)
    const panelsHidden = () =>
      page.evaluate(() => {
        const ps = [
          ...document.querySelectorAll<HTMLElement>(
            '[data-testid="panel-l"],[data-testid="panel-b"],[data-testid="panel-r"]',
          ),
        ]
        return {
          n: ps.length,
          bad: ps
            .filter(
              (e) =>
                !(
                  e.hasAttribute('inert') &&
                  e.getAttribute('aria-hidden') === 'true' &&
                  e.hasAttribute('data-hidden-panel')
                ),
            )
            .map((e) => e.dataset.testid),
        }
      })
    const tabLeak = async () => {
      let leak = 0
      // Shift+Tab: a plain Tab on the canvas is the Figma-style "toggle all panels" shortcut and would re-show them
      for (let i = 0; i < 24; i++) {
        await page.keyboard.press('Shift+Tab')
        leak += await page.evaluate(() =>
          document.activeElement?.closest('[data-hidden-panel],[inert]')
            ? 1
            : 0,
        )
      }
      return leak
    }
    await page.mouse.click(5, 5)
    await page.evaluate(() => {
      ;(document.activeElement as HTMLElement | null)?.blur()
    })
    await panelsShown(page)
    await page.keyboard.press('Control+.')
    await expect.poll(async () => (await panelsHidden()).bad).toEqual([])
    const r = await panelsHidden()
    const leak = await tabLeak()
    // the attributes must survive the #/full MutationObserver a little later too
    await settled(page)
    const r2 = await panelsHidden()
    const info = `${String(r.n)} panels, bad=${r.bad.concat(r2.bad).join(',') || '-'}, tab-leaks=${String(leak)}`
    expect(r.n, info).toBe(3)
    expect(r.bad, info).toEqual([])
    expect(r2.bad, info).toEqual([])
    expect(leak, info).toBe(0)
    await page.keyboard.press('Control+.')
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            [
              ...document.querySelectorAll<HTMLElement>(
                '[data-testid^="panel-"]',
              ),
            ].filter(
              (e) =>
                /^panel-[lbr]$/.test(e.dataset.testid ?? '') &&
                (e.hasAttribute('inert') || e.hasAttribute('aria-hidden')),
            ).length,
        ),
      )
      .toBe(0)
  })
}

test('v7.2 P1-3: editor header says ≥ 20 pages', async ({ page }) => {
  await open(page, '#/screen/canvas')
  await expect.poll(() => headerPages(page)).toBeGreaterThanOrEqual(20)
})

test('v7.2 P2-10: #/full/* (served over http) loads with no 404 / failed request / console error', async ({
  page,
}) => {
  const fails: string[] = []
  page.on('response', (r) => {
    if (r.status() >= 400) fails.push(`${String(r.status())} ${r.url()}`)
  })
  page.on('requestfailed', (r) => fails.push(`failed ${r.url()}`))
  page.on('console', (m) => {
    if (m.type() === 'error') fails.push(`console ${m.text().slice(0, 120)}`)
  })
  for (const h of ['#/full/canvas', '#/full/library', '#/screen/canvas']) {
    await page.goto(`/uikit/${h}`)
    await page.waitForLoadState('load')
    await expect(page.locator('#root')).not.toBeEmpty()
    await expect
      .poll(() =>
        page.evaluate(() => [...document.images].every((i) => i.complete)),
      )
      .toBe(true)
    await settled(page)
  }
  expect(fails, fails.slice(0, 4).join(' | ') || 'clean').toEqual([])
})

// ───────── v0.7.3: Tab with panels hidden, Ctrl+. after a frame select ─────────

test('v7.3 P2-2: forward plain Tab ×60 with panels hidden never lands in a hidden panel', async ({
  page,
}) => {
  await page.goto('/uikit/#/full/canvas')
  await expect(page.locator('[data-testid="panel-l"]').first()).toBeVisible()
  await settled(page)
  await page.mouse.click(5, 5)
  await page.evaluate(() => {
    ;(document.activeElement as HTMLElement | null)?.blur()
  })
  await panelsShown(page)
  await page.keyboard.press('Control+.')
  await expect.poll(() => hiddenPanels(page)).toBeGreaterThan(0)
  await page.evaluate(() => {
    ;(document.activeElement as HTMLElement | null)?.blur()
  })
  const tabs: { h: number; in: boolean }[] = []
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab')
    tabs.push(
      await page.evaluate(() => ({
        h: document.querySelectorAll('[data-hidden-panel]').length,
        in: !!document.activeElement?.closest('[data-hidden-panel],[inert]'),
      })),
    )
  }
  const hidden = tabs.filter((r) => r.h > 0)
  const whileHidden = hidden.length
  const leak = hidden.filter((r) => r.in).length
  const info = `${String(whileHidden)} tabs while hidden, leaks=${String(leak)}`
  expect(whileHidden, info).toBeGreaterThan(0)
  expect(leak, info).toBe(0)
})

test('screen canvas: v7.3 P2-3 / v0.9: after frame select, Ctrl+. hides the panels', async ({
  page,
}) => {
  const errs = await openCanvas(page)
  await scenPhoto(page)
  await panelsShown(page)
  await D(page, '[data-testid="dock"]').scrollIntoViewIfNeeded()
  await D(page, '[data-testid="frame"]')
    .first()
    .click({ position: { x: 30, y: 30 }, force: true })
  await settled(page)
  await page.keyboard.press('Control+.')
  await expect.poll(() => hiddenPanels(page)).toBe(3)
  expect(errs).toEqual([])
})

// ───────── v0.9 / v0.9.1: demo top bar buttons ─────────

test('v0.9 §9 Publish is quiet gray, not primary black', async ({ page }) => {
  await demoEditor(page, 'Pub')
  const pub = await page
    .locator('[data-testid="demo-publish"]')
    .evaluate((e) => {
      const s = getComputedStyle(e)
      return { bg: s.backgroundColor, color: s.color }
    })
  expect(pub.bg, JSON.stringify(pub)).not.toMatch(
    /rgb\(\s*35,\s*34,\s*35\s*\)|rgb\(\s*0,\s*0,\s*0\s*\)/,
  )
  expect(pub.bg, JSON.stringify(pub)).toMatch(
    /rgb\(\s*215,\s*215,\s*215\s*\)|rgb\(\s*225,\s*225,\s*225\s*\)/,
  )
})

test('v0.9.1 §7 Preview/Print/Publish share quiet #D7D7D7', async ({
  page,
}) => {
  await demoEditor(page, 'Tone')
  const tones: Record<string, string> = {}
  for (const id of ['demo-preview', 'demo-print', 'demo-publish'])
    tones[id] = await page
      .locator(`[data-testid="${id}"]`)
      .evaluate((e) => getComputedStyle(e).backgroundColor)
  expect(tones, JSON.stringify(tones)).toEqual({
    'demo-preview': 'rgb(215, 215, 215)',
    'demo-print': 'rgb(215, 215, 215)',
    'demo-publish': 'rgb(215, 215, 215)',
  })
})

// ───────── v0.9.3: Space held ─────────

test('v0.9.3 Space held: panel hotkeys do not change panel visibility; [ works when Space is not held', async ({
  page,
}) => {
  await scenPhoto(page)
  await panelsShown(page)
  const w0 = await panelW(page)
  const canvas = page.locator(`${demo} [data-testid="canvas"]`)
  await canvas.focus()
  await page.keyboard.down('Space')
  for (const k of ['[', '\\', ']', 'i', 'Control+.'])
    await page.keyboard.press(k)
  await settled(page)
  const wSpace = await panelW(page)
  await page.keyboard.up('Space')
  // Playwright can leave Space stuck after chords; force-clear + refocus before [
  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent('keyup', {
        code: 'Space',
        key: ' ',
        bubbles: true,
        cancelable: true,
      }),
    )
    window.dispatchEvent(new Event('blur'))
  })
  await canvas.focus()
  // v0.9.3 Space held: panel hotkeys do not change panel visibility
  expect([w0, wSpace], `before=${w0} during=${wSpace}`).toEqual(['111', '111'])
  // v0.9.3 panel key [ works when Space is not held
  await page.keyboard.press('[')
  await expect.poll(() => panelW(page)).not.toBe(wSpace)
})

// ───────── kit10 → kit-sync KS1: the #/demo top bar ─────────

test('kit10 → kit-sync KS1: #/demo top bar — two view toggles, tools toolbar 210 centred, Snap / Grid 28 × 28, narrow widths, title ellipsis, no default guides / rulers / overlays, no dpi badge', async ({
  page,
}) => {
  await openKit10(page)
  const views = await Promise.all(
    ['snap', 'grid', 'guides', 'rulers', 'overlays', 'dpi'].map((k) =>
      page.locator(`${demo} [data-testid="toggle-${k}"]`).count(),
    ),
  )
  // kit10 → kit-sync KS1 (M11 widened): #/demo top bar has two view toggles (snap, grid), no guides / rulers / bleed / trim / safe / DPI
  expect(views.join()).toBe('1,1,0,0,0,0')
  // KS1 (M39): the tools toolbar (4 tools + snap + grid) is 210 wide and centred on the canvas, between the spread list and the inspector
  const tb = await page.evaluate(() => {
    const d = document.querySelector('[data-testid="demo"]')
    const r = (s: string) => {
      const e = d?.querySelector(s)
      if (!e) throw new Error(`no ${s}`)
      return e.getBoundingClientRect()
    }
    const t = r('[data-testid="editor-bar"] [role=toolbar][aria-label="Tools"]')
    return {
      w: t.width,
      cx: t.x + t.width / 2,
      canvas:
        (r('[data-testid="panel-l"]').right +
          r('[data-testid="panel-r"]').left) /
        2,
    }
  })
  const tbInfo = JSON.stringify(tb)
  expect(Math.abs(tb.w - 210), tbInfo).toBeLessThanOrEqual(0.5)
  expect(Math.abs(tb.cx - tb.canvas), tbInfo).toBeLessThanOrEqual(0.5)
  // rework (prod SnapToggle / GridToggle .pb-view-toggle): 28 × 28, 8 apart, #CACACA when on, x 717 / 753 at 1440
  await page.mouse.move(0, 899)
  await settled(page)
  const vt = await page.evaluate(() =>
    ['snap', 'grid'].map((k) => {
      const e = document.querySelector<HTMLElement>(
        `[data-testid="demo"] [data-testid="toggle-${k}"]`,
      )
      if (!e) throw new Error(`no toggle-${k}`)
      const b = e.getBoundingClientRect()
      return [
        +b.x.toFixed(2),
        b.width,
        b.height,
        e.getAttribute('aria-pressed') === 'true' ||
          e.dataset.selected !== undefined,
        getComputedStyle(e).backgroundColor,
      ] as const
    }),
  )
  expect(
    vt.every(
      ([x, w, h, on, bg], i) =>
        Math.abs(x - ([717, 753][i] ?? 0)) <= 0.5 &&
        w === 28 &&
        h === 28 &&
        bg === (on ? 'rgb(202, 202, 202)' : 'rgba(0, 0, 0, 0)'),
    ) && vt.some((t) => t[3]),
    JSON.stringify(vt),
  ).toBe(true)
  // rework: the side groups never overlap the tools; the right group reserves its width and moves the tools aside when room runs out
  const bars: number[][] = []
  const titles: Awaited<ReturnType<typeof bookTitle>>[] = []
  for (const w of [1024, 1100, 1280]) {
    await page.setViewportSize({ width: w, height: 900 })
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(w)
    await settled(page)
    titles.push(await bookTitle(page))
    bars.push(
      await page.evaluate(() => {
        const d = document.querySelector('[data-testid="demo"]')
        const r = (s: string) => {
          const e = d?.querySelector(s)
          if (!e) throw new Error(`no ${s}`)
          return e.getBoundingClientRect()
        }
        const s = r('[data-testid="editor-bar-start"]')
        const t = r(
          '[data-testid="editor-bar"] [role=toolbar][aria-label="Tools"]',
        )
        const e = r('[data-testid="editor-bar-end"]')
        const bar = r('[data-testid="editor-bar"]')
        return [
          innerWidth,
          +(t.left - s.right).toFixed(2),
          +(e.left - t.right).toFixed(2),
          +(bar.right - e.right).toFixed(2),
          +t.width.toFixed(2),
        ]
      }),
    )
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect.poll(() => page.evaluate(() => innerWidth)).toBe(1440)
  await settled(page)
  // kit-sync KS1 rework: top bar at 1024 / 1100 / 1280 — start · tools · end never overlap (gaps ≥ 8), end stays inside the bar, tools 210
  expect(
    bars.every(
      ([, a = 0, b = 0, c = 0, w = 0]) =>
        a >= 7.5 && b >= 7.5 && c >= 0 && Math.abs(w - 210) <= 0.5,
    ),
    JSON.stringify(bars),
  ).toBe(true)
  // round 2: a clipped book title ends in "…" inside its button (was shrink-0: "Lake tri" cut by the button edge)
  const [t] = titles // at 1024
  expect(
    t?.to === 'ellipsis' &&
      t.ov === 'hidden' &&
      t.right <= t.box + 0.5 &&
      (!t.cut || t.size <= 0.5),
    JSON.stringify(t),
  ).toBe(true)
  // kit-sync KS1: the #/demo canvas opens with 0 guides, 0 rulers, 0 bleed / trim / safe overlays (no dashed safe lines)
  const defs = await page.evaluate(() =>
    [
      '[data-guide]',
      '[data-testid^="ruler-"]',
      '[data-testid="print-overlay"]',
    ].map((s) => document.querySelectorAll(`[data-testid="demo"] ${s}`).length),
  )
  expect(defs.join()).toBe('0,0,0')
  // p02 = the 800 px low-res photo
  const filmRow = D(page, '[data-testid="filmstrip"] [role="row"]').nth(1)
  await filmRow.dragTo(
    D(
      page,
      '[data-testid="canvas"] [data-current] [data-testid="frame"]',
    ).first(),
  )
  await expect(filmRow.locator('[title="Placed in the book"]')).toHaveCount(1)
  await settled(page)
  // kit10 → kit-sync KS1: no DPI toggle in #/demo, so a low-res photo shows no dpi badge (prod has none)
  await expect(
    D(page, '[data-testid="canvas"] [data-frame]').filter({ hasText: /dpi/ }),
  ).toHaveCount(0)
})
