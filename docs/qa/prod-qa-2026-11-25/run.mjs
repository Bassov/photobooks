// Prod walkthrough QA driver (2026-11-25). Not part of CI.
// Usage (repo root): node docs/qa/prod-qa-2026-11-25/run.mjs [--vp 1440x900] [--dpr 1] [--only a,b] [--out dir]
// Drives https://photobooks.photobooks-bassov.workers.dev with a fresh Chromium profile. The library and photo
// folders are real OPFS directories handed out by a `showDirectoryPicker` stub (prod has no test hooks).
// Photos: repo kit assets uikit/public/photos/hi/*.jpg + generated e2e fixtures (sample-3x2.png low-res,
// meta-lake.jpg / meta-hill.jpg EXIF): run e2e/fixtures/write-sample-png.mjs and write-exif-meta-jpegs.mjs first.
// No credentials, no publish, no order. Writes results.json + shots (jpg) into --out.
import { chromium } from '@playwright/test'
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

const PROD =
  process.env.QA_URL ?? 'https://photobooks.photobooks-bassov.workers.dev/'
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : def
}
const [vw, vh] = arg('vp', '1440x900').split('x').map(Number)
const dpr = Number(arg('dpr', '1'))
const only = arg('only', '').split(',').filter(Boolean)
const OUT = arg('out', `.cache/agent/qa/${vw}x${vh}@${dpr}`)
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const PHOTO_DIR = 'uikit/public/photos/hi'
const photos = [
  ...readdirSync(PHOTO_DIR)
    .filter((f) => f.endsWith('.jpg'))
    .map((f) => ({ path: `${PHOTO_DIR}/${f}`, name: f })),
  { path: 'e2e/fixtures/large-24mp.jpg', name: 'large-24mp.jpg' },
  { path: 'e2e/fixtures/sample-3x2.png', name: 'tiny-lowres.png' },
  { path: 'e2e/fixtures/meta-lake.jpg', name: 'meta-lake.jpg' },
  { path: 'e2e/fixtures/meta-hill.jpg', name: 'meta-hill.jpg' },
].map((p) => ({
  name: p.name,
  base64: readFileSync(p.path).toString('base64'),
}))

const results = []
const events = []
let chapter = 'boot'
const log = (kind, text) => {
  events.push({ chapter, kind, text: String(text).slice(0, 400) })
  if (kind !== 'request')
    console.log(`  [${kind}] ${String(text).slice(0, 200)}`)
}

async function step(name, fn) {
  const t0 = Date.now()
  try {
    const note = await fn()
    results.push({
      chapter,
      step: name,
      ok: true,
      note: note ?? '',
      ms: Date.now() - t0,
    })
    console.log(`ok   ${chapter} / ${name}${note ? ` — ${note}` : ''}`)
  } catch (e) {
    const lines = String(e.message ?? e).split('\n')
    const waiting = lines.find((l) => l.includes('waiting for')) ?? ''
    const msg = `${lines[0]} ${waiting.trim()}`.trim()
    results.push({
      chapter,
      step: name,
      ok: false,
      note: msg,
      ms: Date.now() - t0,
    })
    console.log(`FAIL ${chapter} / ${name} — ${msg}`)
    await shot(
      `fail-${chapter}-${name}`.replace(/[^a-z0-9-]+/gi, '_').slice(0, 60),
    )
    // what is open on top: dialogs, menus, the element at the viewport centre
    const top = await page
      .evaluate(() => {
        const open = [
          ...document.querySelectorAll(
            '[role=dialog],[role=alertdialog],[role=menu],[data-testid$="-popover"]',
          ),
        ]
          .filter((e) => e.getBoundingClientRect().width > 0)
          .map(
            (e) =>
              `${e.getAttribute('role') ?? ''}#${e.getAttribute('data-testid') ?? ''}:${(e.getAttribute('aria-label') ?? e.textContent ?? '').slice(0, 40)}`,
          )
        const c = document.elementFromPoint(innerWidth / 2, innerHeight / 2)
        const ct = c?.closest('[data-testid]')?.getAttribute('data-testid')
        return `open [${open.join(' ; ')}] centre ${ct}`
      })
      .catch(() => '')
    console.log(`     ↳ ${top}`)
    results[results.length - 1].note += ` ↳ ${top}`
    // recover: close what the failed step left open
    await page.keyboard.press('Escape').catch(() => {})
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(300)
  }
}

let page
async function shot(name, locator) {
  const file = join(OUT, `${name}.jpg`)
  try {
    if (locator)
      await locator.screenshot({ path: file, type: 'jpeg', quality: 60 })
    else await page.screenshot({ path: file, type: 'jpeg', quality: 60 })
  } catch (e) {
    log('shot', `${name}: ${e.message}`)
  }
}
const want = (id) => only.length === 0 || only.includes(id)
const T = (id) => page.getByTestId(id)
const expectVisible = async (loc, ms = 8000) => {
  await loc.first().waitFor({ state: 'visible', timeout: ms })
}

/** Long frames: LoAF ≥ 200 ms since the last call. */
async function stalls() {
  const list = await page.evaluate(() => {
    const w = window
    const out = (w.__qaLoaf ?? []).splice(0)
    return out
  })
  for (const d of list) log('stall', `${Math.round(d)} ms long animation frame`)
  return list
}

async function opfsList(dirName) {
  return page.evaluate(async (name) => {
    const root = await navigator.storage.getDirectory()
    const walk = async (dir, prefix) => {
      const out = []
      for await (const [n, h] of dir.entries()) {
        if (h.kind === 'directory')
          out.push(...(await walk(h, `${prefix}${n}/`)))
        else out.push(`${prefix}${n} ${(await h.getFile()).size}`)
      }
      return out
    }
    try {
      return await walk(await root.getDirectoryHandle(name), '')
    } catch {
      return []
    }
  }, dirName)
}

/** Synthetic DnD of a filmstrip asset onto a client point (same as e2e/fixtures/dropAssetOnFrame.ts). */
async function dropAsset(index, x, y, atPoint = false) {
  const id = await page
    .getByTestId('filmstrip-item')
    .nth(index)
    .getAttribute('data-asset-id')
  await page.evaluate(
    ({ id, x, y, atPoint }) => {
      const dt = new DataTransfer()
      dt.setData('application/x-photobooks-asset', id)
      const target = atPoint
        ? document.elementFromPoint(x, y)
        : document.querySelector('[data-testid="pasteboard-scroll"]')
      const p = { clientX: x, clientY: y }
      document.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }),
      )
      target.dispatchEvent(
        new DragEvent('dragenter', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          ...p,
        }),
      )
      target.dispatchEvent(
        new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          ...p,
        }),
      )
      target.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          ...p,
        }),
      )
      document.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
    },
    { id, x, y, atPoint },
  )
  await page.waitForTimeout(400)
  return id
}
const center = async (loc) => {
  const b = await loc.boundingBox()
  if (!b) throw new Error('no box')
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }
}
/** Mouse click at a fraction of the box (frames: the image layer takes the pointer, so no locator.click). */
async function clickBox(loc, { fx = 0.5, fy = 0.5, ...opts } = {}) {
  const b = await loc.boundingBox()
  if (!b) throw new Error('no box')
  await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy, opts)
}
const visibleFrames = () =>
  page.locator('[data-testid="canvas"] [data-testid="spread-frame"]:visible')
const pressMod = (key) => page.keyboard.press(`Control+${key}`)

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: vw, height: vh },
  deviceScaleFactor: dpr,
  acceptDownloads: true,
})
await context.addInitScript(() => {
  const w = window
  w.__qaLoaf = []
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        if (e.duration >= 200) w.__qaLoaf.push(e.duration)
    }).observe({ type: 'long-animation-frame', buffered: true })
  } catch {}
  // Folder picker → OPFS dir: library for id photobooks-library, `__qaPick` when set, else qa-photos.
  w.showDirectoryPicker = async (opts = {}) => {
    const root = await navigator.storage.getDirectory()
    const name =
      w.__qaPick ??
      (opts.id === 'photobooks-library' ? 'qa-library' : 'qa-photos')
    w.__qaPick = undefined
    w.__qaPickLog = [
      ...(w.__qaPickLog ?? []),
      { id: opts.id ?? null, mode: opts.mode ?? null, name },
    ]
    return root.getDirectoryHandle(name, { create: true })
  }
})
page = await context.newPage()
page.setDefaultTimeout(6000)
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning')
    log(`console.${m.type()}`, m.text())
})
page.on('pageerror', (e) => log('pageerror', e.message))
page.on('requestfailed', (r) =>
  log('requestfailed', `${r.url()} ${r.failure()?.errorText}`),
)
page.on('response', (r) => {
  if (r.status() >= 400) log('http', `${r.status()} ${r.url()}`)
})
page.on('dialog', async (d) => {
  log('dialog', `${d.type()}: ${d.message()}`)
  await d.accept()
})

// ---------- 0 boot ----------
chapter = 'boot'
let headers = {}
await step('load /', async () => {
  const r = await page.goto(PROD, { waitUntil: 'load' })
  headers = r.headers()
  await page.evaluate(async (files) => {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle('qa-photos', { create: true })
    for (const f of files) {
      const h = await dir.getFileHandle(f.name, { create: true })
      const wr = await h.createWritable()
      const bin = atob(f.base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
      await wr.write(bytes)
      await wr.close()
    }
  }, photos)
  return `${r.status()} etag ${headers.etag}`
})

// ---------- 1 library-folder ----------
chapter = 'library-folder'
await step('welcome screen', async () => {
  await expectVisible(T('welcome-screen'))
  await shot('01-welcome')
  return (await T('welcome-screen').innerText())
    .replace(/\s+/g, ' ')
    .slice(0, 300)
})
await step('Create Library → picker → library screen', async () => {
  await T('create-library').click()
  await expectVisible(T('library-screen'), 15000)
  const pick = await page.evaluate(() => window.__qaPickLog)
  await shot('02-library-empty')
  return JSON.stringify(pick)
})
await step('library bar path + Change library folder', async () => {
  const bar = await T('library-bar').innerText()
  return bar.replace(/\s+/g, ' ')
})

// ---------- 3 create-book ----------
chapter = 'create-book'
await step('Create book dialog', async () => {
  await T('new-book').first().click()
  await expectVisible(T('create-book-dialog'))
  await T('create-title').fill('QA Trip')
  await T('create-preset').click()
  await page.waitForTimeout(300)
  await shot('03-create-size-menu')
  const opts = await page.getByRole('option').allInnerTexts()
  await page.keyboard.press('Escape')
  return `sizes: ${opts.join(' | ')}`
})
await step('orientation + create', async () => {
  const o = await T('create-orientation').innerText()
  await T('create-book').click()
  await expectVisible(T('editor-shell'), 20000)
  await page.waitForTimeout(1500)
  return `orientation control: ${o.replace(/\s+/g, ' ')}`
})

// ---------- 4 editor ----------
chapter = 'editor'
await step('editor regions', async () => {
  const ids = ['book-title', 'spreads-panel', 'canvas', 'inspector', 'dock']
  const missing = []
  for (const id of ids) if (!(await T(id).first().isVisible())) missing.push(id)
  await shot('04-editor')
  const spreads = await page
    .locator('[data-testid="spreads-list"] [role=option]')
    .count()
  const title = await T('book-title').first().innerText()
  if (missing.length) throw new Error(`missing ${missing.join(',')}`)
  return `title "${title}", ${spreads} spread rows, size ${await T('book-size')
    .first()
    .innerText()
    .catch(() => '?')}`
})
await stalls()

// ---------- 5 add-photos ----------
chapter = 'add-photos'
await step('Add folder…', async () => {
  await T('film-add-folder').click()
  await page.waitForFunction(
    (n) =>
      document.querySelectorAll('[data-testid="filmstrip-item"]').length >= n,
    photos.length,
    { timeout: 20000 },
  )
  await page.waitForTimeout(1500)
  await shot('05-photos-added', T('panel-b'))
  return `${await T('filmstrip-item').count()} items; head "${(await T('film-head').innerText()).replace(/\s+/g, ' ')}"`
})
await step('Low-res chip + header count', async () => {
  const chips = await T('lowres-chip').count()
  const head = await T('lowres-count')
    .innerText()
    .catch(() => '(no lowres-count)')
  if (chips < 1) throw new Error(`no lowres chip (header ${head})`)
  return `${chips} chips, header "${head}"`
})
await step('Resize photos edge: drag + double-click', async () => {
  const sep = page.getByRole('separator', { name: 'Resize photos' })
  const before = (await T('panel-b').boundingBox()).height
  const c = await center(sep)
  await page.mouse.move(c.x, c.y)
  await page.mouse.down()
  await page.mouse.move(c.x, c.y - 80, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  const after = (await T('panel-b').boundingBox()).height
  await sep.dblclick()
  await page.waitForTimeout(300)
  const reset = (await T('panel-b').boundingBox()).height
  if (after <= before)
    throw new Error(`dock did not grow: ${before} → ${after}`)
  return `dock ${before} → ${after} → dbl ${reset}`
})
await stalls()

// ---------- 6 place ----------
chapter = 'place'
await step('select spread 1', async () => {
  await page
    .locator('[data-testid="spreads-list"] [role=option]')
    .nth(1)
    .click()
  await page.waitForTimeout(800)
  return `${await visibleFrames().count()} frames visible`
})
await step('drop photo on empty frame', async () => {
  const f = visibleFrames().first()
  const c = await center(f)
  await dropAsset(0, c.x, c.y)
  await page.waitForTimeout(800)
  await shot('06-placed', T('canvas'))
  const placed = await T('filmstrip-placed').count()
  if (placed < 1) throw new Error('no placed badge after drop')
  return `${placed} placed badges; placed-count "${await T('placed-count')
    .innerText()
    .catch(() => '')}"`
})
await step('drop on filled frame replaces', async () => {
  const f = visibleFrames().first()
  const c = await center(f)
  await dropAsset(1, c.x, c.y)
  await page.waitForTimeout(800)
  return `${await T('filmstrip-placed').count()} placed badges (expect 1)`
})

const txt = async (loc) =>
  (await loc.first().innerText()).replace(/\s+/g, ' ').trim()
const rows = () => page.locator('[data-testid="spreads-list"] [role=option]')
const menuItems = async () =>
  (await page.getByRole('menuitem').allInnerTexts()).map((s) =>
    s.replace(/\s+/g, ' ').trim(),
  )
const curFrames = () =>
  page.locator(
    '[data-testid="pasteboard-slot"][data-active="true"] [data-testid="spread-frame"]',
  )
const imgs = () =>
  page.evaluate(() =>
    [
      ...document.querySelectorAll(
        '[data-testid="pasteboard-slot"][data-active="true"] [data-testid="spread-frame"]',
      ),
    ].map((e) => e.querySelector('img')?.currentSrc?.slice(-8) ?? null),
  )

await step('placed badge → Show in the book', async () => {
  await rows().nth(0).click()
  await page.waitForTimeout(500)
  const badge = page.getByRole('button', { name: 'Show in the book' }).first()
  await badge.click()
  await page.waitForTimeout(800)
  const sel = await page
    .locator(
      '[data-testid="spreads-list"] [data-selected="true"] [role=option]',
    )
    .first()
    .getAttribute('data-item')
  const pressed = await page
    .locator('[data-testid="spread-frame"][aria-pressed="true"]')
    .count()
  return `selected row ${sel}, pressed frames ${pressed}`
})
await step('swap: drag placed photo onto another frame', async () => {
  await rows().nth(1).click()
  await page.waitForTimeout(500)
  const f = curFrames()
  const c0 = await center(f.nth(0))
  await dropAsset(5, c0.x, c0.y)
  const c2 = await center(f.nth(1))
  await dropAsset(2, c2.x, c2.y)
  await page.waitForTimeout(1500)
  await page.keyboard.press('Escape')
  const before = await imgs()
  const c1 = await center(f.nth(0))
  await page.mouse.move(c1.x, c1.y)
  await page.mouse.down()
  await page.mouse.move(c1.x + 20, c1.y + 10, { steps: 4 })
  await page.mouse.move(c2.x, c2.y, { steps: 12 })
  await page.waitForTimeout(200)
  await shot('06-swap-hover', T('canvas'))
  await page.mouse.up()
  await page.waitForTimeout(700)
  const after = await imgs()
  return `before ${JSON.stringify(before)} after ${JSON.stringify(after)}`
})
await step('context menu: Place photo… on an empty frame', async () => {
  // a spread row that reports "N empty"
  const emptyRow = page
    .locator('[data-testid="spreads-list"] [role=option]')
    .filter({ hasText: /empty/ })
    .first()
  await emptyRow.click()
  await page.waitForTimeout(600)
  const f = curFrames()
  const n = await f.count()
  let empty = null
  for (let i = 0; i < n; i += 1)
    if ((await f.nth(i).getByTestId('frame-empty-label').count()) > 0) {
      empty = f.nth(i)
      break
    }
  if (!empty)
    throw new Error(`no empty frame on the current spread (${n} frames)`)
  await clickBox(empty, { button: 'right' })
  await page.waitForTimeout(300)
  const items = await menuItems()
  await shot('06-frame-menu-empty')
  const place = page.getByRole('menuitem', { name: /Place photo/ })
  if ((await place.count()) === 0) {
    await page.keyboard.press('Escape')
    throw new Error(`no Place photo… item: ${items.join(' | ')}`)
  }
  await place.click()
  await page.waitForTimeout(300)
  await T('filmstrip-item').nth(3).click()
  await page.waitForTimeout(800)
  return `menu: ${items.join(' | ')}; now ${await T('placed-count').innerText()}`
})
await step('drop between spreads (Drop here for a new spread)', async () => {
  const before = await rows().count()
  const stage = page
    .locator(
      '[data-testid="pasteboard-slot"][data-active="true"] [data-testid="spread-view"]',
    )
    .first()
  const b = await stage.boundingBox()
  const id = await T('filmstrip-item').nth(4).getAttribute('data-asset-id')
  const pt = { x: b.x + b.width / 2, y: b.y + b.height + 14 }
  const hint = await page.evaluate(
    ({ id, x, y }) => {
      const dt = new DataTransfer()
      dt.setData('application/x-photobooks-asset', id)
      window.__qaDt = dt
      const s = document.querySelector('[data-testid="pasteboard-scroll"]')
      document.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }),
      )
      s.dispatchEvent(
        new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientX: x,
          clientY: y,
        }),
      )
      return new Promise((r) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            r(document.body.innerText.includes('Drop here for a new spread')),
          ),
        ),
      )
    },
    { id, ...pt },
  )
  await shot('06-new-spread-hint', T('canvas'))
  await page.evaluate(({ x, y }) => {
    const s = document.querySelector('[data-testid="pasteboard-scroll"]')
    s.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: window.__qaDt,
        clientX: x,
        clientY: y,
      }),
    )
    document.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
  }, pt)
  await page.waitForTimeout(800)
  const after = await rows().count()
  if (!hint)
    throw new Error(
      `no "Drop here for a new spread" hint 14 px below the spread (rows ${before} → ${after})`,
    )
  return `hint shown; rows ${before} → ${after}`
})
await stalls()

// ---------- 7 layouts ----------
chapter = 'layouts'
await step('inspector layout section', async () => {
  await page.keyboard.press('Escape')
  await rows().nth(1).click()
  await page.waitForTimeout(600)
  const vis = await T('layout-section').isVisible()
  if (!vis)
    throw new Error(
      `no layout section after clicking a spread row; inspector: ${(await txt(T('inspector'))).slice(0, 200)}`,
    )
  await shot('07-inspector-layouts', T('inspector'))
  return `chips: ${await txt(T('tpl-chips'))}; tiles ${await T('layout-tile').count()}`
})
await step('Photos filter chip 2', async () => {
  const all = await T('layout-tile').count()
  await T('tpl-chips').getByText('2', { exact: true }).click()
  await page.waitForTimeout(300)
  const two = await T('layout-tile').count()
  await T('tpl-chips').getByText('Any', { exact: true }).click()
  if (two >= all) throw new Error(`filter did not narrow: ${all} → ${two}`)
  return `${all} → ${two}`
})
await step('apply a tile', async () => {
  const before = await imgs()
  await T('layout-tile').nth(3).click()
  await page.waitForTimeout(700)
  const after = await imgs()
  return `frames ${JSON.stringify(before)} → ${JSON.stringify(after)}`
})
await step('layout cycle pill ‹ › + Shift+]', async () => {
  await expectVisible(T('layout-cycle'))
  const p0 = await txt(T('layout-cycle'))
  await T('layout-cycle').getByRole('button').last().click()
  await page.waitForTimeout(400)
  const p1 = await txt(T('layout-cycle'))
  await page.keyboard.press('Shift+BracketRight')
  await page.waitForTimeout(400)
  const p2 = await txt(T('layout-cycle'))
  await page.keyboard.press('Shift+BracketLeft')
  await page.waitForTimeout(400)
  const p3 = await txt(T('layout-cycle'))
  await shot('07-layout-pill', T('canvas'))
  if (p0 === p1) throw new Error(`› did not change: ${p0}`)
  if (p1 === p2) throw new Error(`Shift+] did not change: ${p1}`)
  return `${p0} → › ${p1} → ⇧] ${p2} → ⇧[ ${p3}`
})
await step('Save as template', async () => {
  await rows().nth(1).click()
  await T('tpl-save-button').click()
  await page.waitForTimeout(400)
  const dlg = page.getByRole('dialog')
  if ((await dlg.count()) > 0) {
    await shot('07-save-template', dlg.first())
    const input = dlg.first().getByRole('textbox').first()
    if ((await input.count()) > 0) await input.fill('QA layout')
    await dlg.first().getByRole('button', { name: /Save/ }).last().click()
  }
  await page.waitForTimeout(500)
  await T('tab-mine').click()
  await page.waitForTimeout(300)
  const mine = await T('layout-tile').count()
  const tab = await txt(T('tab-mine'))
  await T('tab-all').click()
  if (mine < 1) throw new Error('My templates empty after save')
  return `My templates tiles ${mine}, tab "${tab}"`
})
await step('Contact sheet', async () => {
  const cs = page.getByLabel('Contact sheet')
  await cs.scrollIntoViewIfNeeded()
  await shot('07-contact-sheet', cs)
  const before = await curFrames().count()
  await T('layout-contact-apply').click()
  await page.waitForTimeout(700)
  const after = await curFrames().count()
  await pressMod('z')
  await page.waitForTimeout(500)
  return `frames ${before} → ${after} → undo ${await curFrames().count()}; tab "${await txt(T('tab-mine'))}"`
})
await stalls()

// ---------- 8 spreads ----------
chapter = 'spreads'
await step('row menu: Add after / Duplicate / Delete', async () => {
  const openRowMenu = async (i, what) => {
    const row = rows().nth(i)
    await row.scrollIntoViewIfNeeded()
    await row.hover()
    const id = await row.getAttribute('data-item')
    try {
      await T(`spread-menu-${id}`).click({ timeout: 3000 })
    } catch (e) {
      throw new Error(
        `${what}: ••• of row ${i} (${id}) not clickable: ${String(e.message).split('\n')[0]}`,
      )
    }
    await page.waitForTimeout(300)
  }
  const n0 = await rows().count()
  await openRowMenu(1, 'open')
  const items = await menuItems()
  await shot('08-row-menu', T('spreads-panel'))
  await T('spread-menu-add').click()
  await page.waitForTimeout(500)
  const n1 = await rows().count()
  await openRowMenu(1, 'duplicate')
  await T('spread-menu-duplicate').click()
  await page.waitForTimeout(500)
  const n2 = await rows().count()
  await openRowMenu(n2 - 2, 'delete')
  await T('spread-menu-delete').click()
  await page.waitForTimeout(400)
  const confirm = page.getByRole('alertdialog')
  let ask = 'no confirm'
  if ((await confirm.count()) > 0) {
    ask = await txt(confirm)
    await shot('08-delete-confirm', confirm.first())
    await confirm.first().getByRole('button').last().click()
  }
  await page.waitForTimeout(500)
  const n3 = await rows().count()
  if (n3 !== n2 - 1)
    throw new Error(`delete: rows ${n2} → ${n3}; confirm "${ask}"`)
  return `menu ${items.join(' | ')}; rows ${n0} → add ${n1} → dup ${n2} → del ${n3}; confirm "${ask}"`
})
await step('Ctrl+D duplicates selected row', async () => {
  const n0 = await rows().count()
  await rows().nth(1).click()
  await pressMod('d')
  await page.waitForTimeout(500)
  const n1 = await rows().count()
  if (n1 !== n0 + 1) throw new Error(`rows ${n0} → ${n1}`)
  return `rows ${n0} → ${n1}`
})
await step('drag a row to reorder', async () => {
  const ids0 = await rows().evaluateAll((es) =>
    es.map((e) => e.getAttribute('data-item')),
  )
  const a = await center(rows().nth(1))
  const b = await center(rows().nth(3))
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(a.x, a.y + 8, { steps: 3 })
  await page.mouse.move(b.x, b.y + b.b.height * 0.4, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(600)
  const ids1 = await rows().evaluateAll((es) =>
    es.map((e) => e.getAttribute('data-item')),
  )
  if (JSON.stringify(ids0) === JSON.stringify(ids1))
    throw new Error('order unchanged after pointer drag')
  return `${ids0.length} rows reordered`
})
await step(
  'page count in top bar',
  async () => `top bar "${await txt(T('book-size'))}"`,
)
await stalls()

// ---------- 9 frames ----------
chapter = 'frames'
const firstPhotoFrame = async () => {
  await page.keyboard.press('Escape')
  await rows().nth(0).click()
  await page.waitForTimeout(500)
  return curFrames().first()
}
await step('select + move', async () => {
  const f = await firstPhotoFrame()
  // drag 60,40 px from a fraction of the frame; report frame and photo deltas, then undo
  const trial = async (label, fx, fy, select) => {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    if (select) {
      await clickBox(f, { fx, fy })
      await page.waitForTimeout(800)
    }
    const b0 = await f.boundingBox()
    const i0 = await f.locator('img').first().boundingBox()
    const x = b0.x + b0.width * fx
    const y = b0.y + b0.height * fy
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 60, y + 40, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(400)
    const b1 = await f.boundingBox()
    const i1 = await f.locator('img').first().boundingBox()
    const r = {
      label,
      frame: [Math.round(b1.x - b0.x), Math.round(b1.y - b0.y)],
      photo: [Math.round(i1.x - i0.x), Math.round(i1.y - i0.y)],
    }
    if (label === 'selected body') await shot('09-frame-selected', T('canvas'))
    await pressMod('z')
    await page.waitForTimeout(300)
    return r
  }
  // filled frame: body drag is the photo drag (spec pasteboard: never a frame move); grabber pans the photo
  const a = await trial('filled unselected body', 0.5, 0.5, false)
  const c = await trial('filled selected grabber', 0.5, 0.5, true)
  // empty frame: body drag moves it (guide: "Click a frame; drag to move")
  const emptyRow = page
    .locator('[data-testid="spreads-list"] [role=option]')
    .filter({ hasText: /empty/ })
    .first()
  await page.keyboard.press('Escape')
  await emptyRow.click()
  await page.waitForTimeout(600)
  const e = curFrames()
    .filter({ has: page.getByTestId('frame-empty-label') })
    .first()
  const eb0 = await e.boundingBox()
  await page.mouse.move(eb0.x + eb0.width * 0.3, eb0.y + eb0.height * 0.3)
  await page.mouse.down()
  await page.mouse.move(
    eb0.x + eb0.width * 0.3 + 60,
    eb0.y + eb0.height * 0.3 + 40,
    { steps: 10 },
  )
  await page.mouse.up()
  await page.waitForTimeout(400)
  const eb1 = await e.boundingBox()
  await shot('09-frame-selected', T('canvas'))
  const em = [Math.round(eb1.x - eb0.x), Math.round(eb1.y - eb0.y)]
  await pressMod('z')
  const s = `${[a, c].map((t) => `${t.label}: frame ${t.frame} photo ${t.photo}`).join('; ')}; empty body drag: frame ${em}`
  if (em[0] === 0 && em[1] === 0)
    throw new Error(`empty frame did not move: ${s}`)
  if (c.photo[0] === 0 && c.photo[1] === 0)
    throw new Error(`grabber did not pan the photo: ${s}`)
  return s
})
await step('frame context menu items', async () => {
  const f = await firstPhotoFrame()
  await clickBox(f, { button: 'right' })
  await page.waitForTimeout(300)
  const items = await menuItems()
  await shot('09-frame-menu')
  await page.keyboard.press('Escape')
  const need = [
    'Crop',
    'Cut',
    'Copy',
    'Paste',
    'Duplicate',
    'Bring to front',
    'Send to back',
    'Lock',
    'Delete',
  ]
  const miss = need.filter((w) => !items.some((i) => i.includes(w)))
  if (miss.length)
    throw new Error(`missing ${miss.join(', ')}; got ${items.join(' | ')}`)
  return items.join(' | ')
})
await step('Ctrl+C / Ctrl+V / Ctrl+D', async () => {
  const f = await firstPhotoFrame()
  await clickBox(f)
  const n0 = await curFrames().count()
  await pressMod('c')
  await pressMod('v')
  await page.waitForTimeout(400)
  const n1 = await curFrames().count()
  await pressMod('d')
  await page.waitForTimeout(400)
  const n2 = await curFrames().count()
  if (n1 !== n0 + 1 || n2 !== n1 + 1)
    throw new Error(`frames ${n0} → paste ${n1} → dup ${n2}`)
  return `frames ${n0} → paste ${n1} → dup ${n2}`
})
await step('Alt + drag drops a copy', async () => {
  const n0 = await curFrames().count()
  const c = await center(curFrames().first())
  await page.keyboard.down('Alt')
  await page.mouse.move(c.x, c.y)
  await page.mouse.down()
  await page.mouse.move(c.x + 40, c.y + 30, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await page.waitForTimeout(400)
  const n1 = await curFrames().count()
  if (n1 !== n0 + 1) throw new Error(`frames ${n0} → ${n1}`)
  return `frames ${n0} → ${n1}`
})
await step('Ctrl+X cut', async () => {
  const n0 = await curFrames().count()
  await clickBox(curFrames().last())
  await pressMod('x')
  await page.waitForTimeout(400)
  const n1 = await curFrames().count()
  if (n1 !== n0 - 1) throw new Error(`frames ${n0} → ${n1}`)
  return `frames ${n0} → ${n1}`
})
await step('marquee select from the grey', async () => {
  await page.keyboard.press('Escape')
  const st = await page
    .locator(
      '[data-testid="pasteboard-slot"][data-active="true"] [data-testid="spread-view"]',
    )
    .first()
    .boundingBox()
  await page.mouse.move(st.x - 20, st.y - 20)
  await page.mouse.down()
  await page.mouse.move(st.x + st.width * 0.7, st.y + st.height * 0.7, {
    steps: 10,
  })
  await page.mouse.up()
  await page.waitForTimeout(300)
  const pressed = await page
    .locator('[data-testid="spread-frame"][aria-pressed="true"]')
    .count()
  await shot('09-marquee', T('inspector'))
  const insp = await txt(T('inspector'))
  if (pressed < 2) throw new Error(`pressed ${pressed}`)
  return `${pressed} selected; inspector: ${insp.slice(0, 120)}`
})
await step('direct crop: double-click → pinned crop, Esc ends', async () => {
  const f = await firstPhotoFrame()
  await clickBox(f, { clickCount: 2 })
  await page.waitForTimeout(500)
  await shot('09-crop', T('canvas'))
  const done = page.getByRole('button', { name: 'Done' })
  const has = await done.count()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  const after = await done.count()
  if (!has) throw new Error('no "Done" button in crop mode')
  return `Done visible ${has}, after Esc ${after}`
})
await step('rotate knob', async () => {
  const f = await firstPhotoFrame()
  await clickBox(f)
  const knob = page.locator('[data-testid*="rotat"]:visible').first()
  if ((await knob.count()) === 0) throw new Error('no rotate knob testid')
  return `knob ${await knob.getAttribute('data-testid')}`
})
await stalls()

// ---------- 10 text ----------
chapter = 'text'
await step('Text tool → click on page → type', async () => {
  await page.keyboard.press('Escape')
  await rows().nth(2).click()
  await page.waitForTimeout(500)
  await T('tool-text').click()
  const st = await page
    .locator(
      '[data-testid="pasteboard-slot"][data-active="true"] [data-testid="spread-view"]',
    )
    .first()
    .boundingBox()
  await page.mouse.click(st.x + st.width * 0.25, st.y + st.height * 0.2)
  await page.waitForTimeout(400)
  await page.keyboard.type(
    'Summer in the mountains with a very long caption that keeps going and going so it overflows the frame for sure, more words, more words, more words, more words.',
  )
  await page.waitForTimeout(400)
  await shot('10-text', T('canvas'))
  // spec pasteboard: the Overflow chip is hidden while the frame is edited
  const editing = await page.locator('.text-overflow-chip:visible').count()
  const insp = await txt(T('inspector'))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const grown = await page.locator('.text-overflow-chip:visible').count()
  // the frame grows while typing: shrink it from the bottom-mid handle to force overflow
  const tb = await curFrames().last().boundingBox()
  const hx = tb.x + tb.width / 2
  const hy = tb.y + tb.height
  await page.mouse.move(hx, hy)
  await page.mouse.down()
  await page.mouse.move(hx, hy - tb.height * 0.6, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(500)
  const tb2 = await curFrames().last().boundingBox()
  const after = await page.locator('.text-overflow-chip:visible').count()
  await shot('10-text-overflow', T('canvas'))
  if (after < 1)
    throw new Error(
      `no Overflow chip after shrinking the text frame ${Math.round(tb.height)} → ${Math.round(tb2.height)} px (editing ${editing}, after Esc ${grown})`,
    )
  return `Overflow chip: editing ${editing}, after Esc ${grown}, after shrink ${Math.round(tb.height)} → ${Math.round(tb2.height)} px: ${after}; inspector ${insp}`
})
await step('live text options in inspector', async () => {
  const live = await page.getByText(/Live from photo metadata/).count()
  await shot('10-text-inspector', T('inspector'))
  await page.keyboard.press('Escape')
  return `"Live from photo metadata" ${live}`
})
await step('photo Caption field', async () => {
  const f = await firstPhotoFrame()
  await clickBox(f)
  await page.waitForTimeout(300)
  const cap = await T('inspector').getByText('Caption').count()
  if (!cap) throw new Error('no Caption in photo inspector')
  return 'Caption present'
})
await stalls()

// ---------- 11 masters ----------
chapter = 'masters'
await step('Masters mode', async () => {
  await page.keyboard.press('Escape')
  await T('mode-seg').getByText('Masters').click()
  await page.waitForTimeout(600)
  await expectVisible(T('masters-panel'))
  await shot('11-masters')
  const insp = await txt(T('inspector'))
  return `masters ${await T('masters-list').locator('[role=option]').count()}; inspector: ${insp.slice(0, 160)}`
})
await step('page numbers control', async () => {
  const pn = await T('inspector')
    .getByText(/Page numbers/)
    .count()
  await T('mode-seg').getByText('Pages').click()
  await page.waitForTimeout(400)
  return `page numbers control ${pn}`
})
await stalls()

// ---------- 12 cover ----------
chapter = 'cover'
await step('Cover selected', async () => {
  await T('cover-list-item').first().click()
  await page.waitForTimeout(800)
  await shot('12-cover', T('canvas'))
  return `inspector: ${(await txt(T('inspector'))).slice(0, 200)}`
})
await step('drop photo on cover front', async () => {
  // the cover is its own stage: aim at the middle of the "Front" panel (label under it)
  const label = await T('canvas')
    .getByText('Front', { exact: true })
    .boundingBox()
  const cv = await T('canvas').boundingBox()
  const pt = { x: label.x + label.width / 2, y: cv.y + cv.height * 0.45 }
  const hit = await page.evaluate(
    ({ x, y }) =>
      document
        .elementFromPoint(x, y)
        ?.closest('[data-testid]')
        ?.getAttribute('data-testid'),
    pt,
  )
  await dropAsset(10, pt.x, pt.y, true)
  await page.waitForTimeout(800)
  await shot('12-cover-photo', T('canvas'))
  const front = await txt(T('inspector'))
  if (/No photo yet/.test(front))
    throw new Error(
      `cover still "No photo yet" after drop on the Front panel (hit ${hit})`,
    )
  return `hit ${hit}; Wrap labels ${await page.getByText(/Wrap/).count()}`
})
await stalls()

// ---------- 13 book-settings ----------
chapter = 'book-settings'
await step('click title → Book settings', async () => {
  await T('book-title').first().click()
  await page.waitForTimeout(500)
  await shot('13-book-settings', T('inspector'))
  const t = await txt(T('inspector'))
  if (!/Printer|PRINT/i.test(t)) throw new Error(`no Printer section: ${t}`)
  return t.slice(0, 220)
})
await stalls()

// ---------- 14 check / preview ----------
chapter = 'check'
await step('Preview + Esc', async () => {
  await page.keyboard.press('Escape')
  await T('present').click()
  await page.waitForTimeout(5000)
  await shot('14-preview')
  const inEditor = await T('editor-shell').isVisible()
  // cover photo in the reader: any decoded <img>/<canvas> drawn inside the book block
  const media = await page.evaluate(() =>
    [...document.querySelectorAll('img,canvas')]
      .filter((e) => e.getBoundingClientRect().width > 200)
      .map(
        (e) =>
          `${e.tagName}${e.closest('[data-testid]')?.getAttribute('data-testid') ?? ''} ${Math.round(e.getBoundingClientRect().width)}w ${e.tagName === 'IMG' ? e.naturalWidth : ''}`,
      ),
  )
  log('note', `preview media: ${media.slice(0, 3).join(' | ')}`)
  const fronts = await page.evaluate(() =>
    [...document.querySelectorAll('.cover-front-photo')].map((e) => {
      const r = e.getBoundingClientRect()
      const bg = getComputedStyle(e).backgroundImage
      return `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}×${Math.round(r.height)} bg ${bg.slice(0, 40)}`
    }),
  )
  log(
    'note',
    `cover-front-photo elements while Preview is open: ${JSON.stringify(fronts)}`,
  )
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)
  const back = await T('editor-shell').isVisible()
  if (!back) throw new Error('editor not back after Esc')
  return `editor hidden in preview: ${!inEditor}; back after Esc: ${back}`
})
await stalls()

// ---------- 15 print-shop ----------
chapter = 'print-shop'
await step('Print dialog + Check', async () => {
  await T('print').click()
  await expectVisible(T('print-dialog'))
  await page.waitForTimeout(800)
  await shot('15-print-dialog', T('print-dialog'))
  return `dialog: ${await txt(T('print-dialog'))}`
})
await step('Export PDF 1 per sheet → pages + cover', async () => {
  const t0 = Date.now()
  await T('print-go').click()
  await expectVisible(T('print-done'), 180000)
  const ms = Date.now() - t0
  await shot('15-print-done', T('print-dialog'))
  const cover = await T('print-done-cover').count()
  const files = await opfsList('qa-library')
  await T('print-dialog').getByRole('button', { name: 'Done' }).click()
  await page.waitForTimeout(800)
  const still = await T('print-dialog').isVisible()
  if (still) {
    // second attempt, then Esc, to tell a dead button from a slow close
    await T('print-dialog').getByRole('button', { name: 'Done' }).click()
    await page.waitForTimeout(800)
    const still2 = await T('print-dialog').isVisible()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    const still3 = await T('print-dialog').isVisible()
    throw new Error(
      `"Done" did not close PDF ready (after 2nd click open=${still2}, after Esc open=${still3}); ${ms} ms; exports ${files.join(', ')}`,
    )
  }
  return `${ms} ms; cover row ${cover}; exports: ${files.filter((f) => f.includes('export')).join(', ')}`
})
await stalls()

// ---------- 16 print-home ----------
chapter = 'print-home'
await step('2-up imposition export', async () => {
  await T('print').click()
  await expectVisible(T('print-dialog'))
  await page.waitForTimeout(500)
  if (await T('print-done').isVisible()) {
    await shot('16-print-reopen-stale', T('print-dialog'))
    const t = await txt(T('print-dialog'))
    const go = await T('print-go').count()
    // spec print-dialog: the pill stays "done" for 4 s and opens the run's current step
    log(
      'note',
      `Print reopened within 4 s shows the previous "PDF ready" (print-go ${go}): ${t.slice(0, 120)}`,
    )
    await T('print-dialog').getByRole('button', { name: 'Done' }).click()
    await page.waitForTimeout(4500)
    await T('print').click()
    await expectVisible(T('print-dialog'))
    await page.waitForTimeout(500)
    log(
      'note',
      `after Done + 4.5 s Print shows done=${await T('print-done').isVisible()}`,
    )
  }
  const seg = await txt(T('print-imposition'))
  const two = T('print-imposition').getByRole('radio', { name: /2.up/ })
  if ((await two.count()) === 0)
    throw new Error(`no 2-up radio; imposition control reads "${seg}"`)
  await two.click({ force: true })
  await page.waitForTimeout(400)
  await shot('16-print-2up', T('print-dialog'))
  await T('print-go').click()
  await expectVisible(T('print-done'), 180000)
  const done = await txt(T('print-done'))
  const files = await opfsList('qa-library')
  await T('print-dialog').getByRole('button', { name: 'Done' }).click()
  return `${done.slice(0, 160)}; exports: ${files.filter((f) => f.includes('export')).join(', ')}`
})
await stalls()

// ---------- 17 site ----------
chapter = 'site'
await step('Export site to folder', async () => {
  const btn = page.getByRole('button', { name: /Export site/ })
  if ((await btn.count()) === 0)
    throw new Error('no "Export site" button visible in the editor')
  await btn.first().click()
  await expectVisible(T('export-site-dialog'))
  await page.evaluate(() => {
    window.__qaPick = 'qa-site'
  })
  await T('export-site-choose').click()
  await T('export-site-go').click()
  await page.waitForTimeout(8000)
  await shot('17-export-site', T('export-site-dialog'))
  const files = await opfsList('qa-site')
  await T('export-site-close')
    .click()
    .catch(() => {})
  return `${files.length} files, e.g. ${files.slice(0, 4).join(', ')}`
})
await stalls()

// ---------- 20 publish ----------
chapter = 'publish'
await step('Publish without hosting', async () => {
  await T('publish').click()
  await page.waitForTimeout(600)
  const d = page.getByRole('dialog').first()
  await shot('20-publish-nohost', d)
  const t = await txt(d)
  const open = await d.getByText(/Open Settings/).count()
  await page.keyboard.press('Escape')
  if (!open) throw new Error(`no "Open Settings → Hosting": ${t}`)
  return t
})

// ---------- 18/19/21 settings ----------
chapter = 'site-texts'
await step('Settings → Site fields', async () => {
  await T('editor-settings-open').click()
  await expectVisible(T('editor-settings'))
  const nav = await T('editor-settings')
    .locator('[data-testid^="settings-nav-"]')
    .evaluateAll((es) => es.map((e) => e.textContent.trim()))
  await T('settings-nav-site').click()
  await expectVisible(T('site-settings'))
  const title = page.getByLabel('Site title')
  await title.fill('QA bookcase')
  await title.press('Enter')
  const intro = page.getByLabel('Intro')
  await intro.fill('x'.repeat(170))
  const len = (await intro.inputValue()).length
  await intro.press('Tab')
  await shot('18-site-settings', T('site-settings'))
  return `nav ${nav.join(' | ')}; intro accepted ${len} chars`
})
chapter = 'hosting'
await step('Settings → Hosting (no token)', async () => {
  await T('settings-nav-hosting').click()
  await page.waitForTimeout(500)
  await shot('19-hosting', T('editor-settings'))
  const create = await page.getByText(/Create a setup token/).count()
  const manual = await page.getByText(/Enter R2 keys yourself/).count()
  return `setup token link ${create}; manual keys ${manual}`
})
chapter = 'settings'
await step('Interface size 125 / 150 %', async () => {
  await T('settings-nav-interface').click()
  await expectVisible(T('interface-settings'))
  const out = []
  for (const v of ['125%', '150%', '100%']) {
    await T('interface-size-row').getByText(v, { exact: true }).click()
    await page.waitForTimeout(500)
    const m = await page.evaluate(() => ({
      back:
        Math.round(
          document
            .querySelector('[data-testid="editor-settings-back"]')
            .getBoundingClientRect().height * 10,
        ) / 10,
      zooms: ['html', 'body', '#root']
        .map((s) => getComputedStyle(document.querySelector(s)).zoom)
        .join('/'),
      hint: document
        .querySelector('[data-testid="interface-settings"]')
        .innerText.replace(/\s+/g, ' ')
        .match(/Window[^.]*\./)?.[0],
    }))
    out.push(`${v}: back h ${m.back}, zoom ${m.zooms}, ${m.hint ?? 'no hint'}`)
    if (v === '150%') await shot('21-interface-150')
  }
  // canvas chrome leaking onto Settings
  const pill = await T('layout-cycle')
    .isVisible()
    .catch(() => false)
  if (pill) {
    const b = await T('layout-cycle').boundingBox()
    const topId = await page.evaluate(
      ({ x, y }) =>
        document
          .elementFromPoint(x, y)
          ?.closest('[data-testid]')
          ?.getAttribute('data-testid'),
      { x: b.x + b.width / 2, y: b.y + b.height / 2 },
    )
    throw new Error(
      `layout-cycle pill painted over Settings at ${Math.round(b.x)},${Math.round(b.y)} (${Math.round(b.width)}×${Math.round(b.height)}), top element ${topId}; ${out.join('; ')}`,
    )
  }
  return out.join('; ')
})
await step('Back to the book', async () => {
  await T('editor-settings-back').click()
  await expectVisible(T('editor-shell'))
})
await stalls()

// ---------- fill book ----------
chapter = 'add-photos'
await step('Fill book: plan → confirm → one Undo', async () => {
  const n0 = await rows().count()
  const used0 = await txt(T('placed-count'))
  await T('film-fill-book').click()
  await expectVisible(T('fill-book-popover'))
  await shot('05-fill-book', T('fill-book-popover'))
  const plan = await txt(T('fill-book-popover'))
  await T('fill-book-confirm').click()
  await page.waitForTimeout(1500)
  const used1 = await txt(T('placed-count'))
  const n1 = await rows().count()
  await pressMod('z')
  await page.waitForTimeout(800)
  const used2 = await txt(T('placed-count'))
  return `plan "${plan}"; ${used0} → ${used1} (rows ${n0} → ${n1}) → undo ${used2} (rows ${await rows().count()})`
})
await stalls()

// ---------- 2 your-books ----------
chapter = 'your-books'
await step('back to library, card menu, search, sort', async () => {
  await T('go-library').click()
  await expectVisible(T('library-screen'))
  await page.waitForTimeout(800)
  await T('book-card').first().hover()
  await page.locator('[data-testid^="book-menu-"]').first().click()
  await page.waitForTimeout(300)
  const items = await menuItems()
  await shot('02-book-menu')
  await page.getByRole('menuitem', { name: 'Duplicate' }).click()
  await page.waitForTimeout(1500)
  const count = await T('book-card').count()
  await T('lib-search-input').fill('zzz')
  await page.waitForTimeout(300)
  const none = await T('lib-no-results').count()
  await T('lib-search-input').fill('')
  await T('lib-sort').click()
  await page.waitForTimeout(200)
  const sorts = await page
    .getByRole('menuitem')
    .or(page.getByRole('option'))
    .or(page.getByRole('menuitemradio'))
    .allInnerTexts()
  await page.keyboard.press('Escape')
  return `menu ${items.join(' | ')}; cards after Duplicate ${count}; no-results ${none}; sorts ${sorts.join(' | ')}`
})
await step('Remove asks first', async () => {
  await T('book-card').last().hover()
  await page.locator('[data-testid^="book-menu-"]').last().click()
  await page.getByRole('menuitem', { name: /Remove/ }).click()
  await page.waitForTimeout(300)
  const d = page.getByRole('alertdialog').or(page.getByRole('dialog'))
  const asked = await d.count()
  await shot('02-remove-confirm')
  if (!asked) throw new Error('Remove did not ask')
  const t = await txt(d)
  await page.keyboard.press('Escape')
  return t
})
await stalls()

// ---------- persistence: reload, reopen the book ----------
chapter = 'persistence'
await step('reload → library → open book', async () => {
  await page.reload({ waitUntil: 'load' })
  await page.waitForTimeout(2000)
  if (
    await T('allow-library-access')
      .isVisible()
      .catch(() => false)
  ) {
    await T('allow-library-access').click()
    await page.waitForTimeout(1000)
  }
  await expectVisible(T('library-screen').or(T('editor-shell')), 15000)
  await shot('22-after-reload')
  let cards = 'restored straight into the editor'
  if (await T('library-screen').isVisible()) {
    cards = `${await T('book-card').count()} cards`
    await T('book-card').first().click()
    await expectVisible(T('editor-shell'), 20000)
  }
  await page.waitForTimeout(2500)
  await rows().nth(1).click()
  await page.waitForTimeout(600)
  const used = await txt(T('placed-count'))
  const mine = await txt(T('tab-mine')).catch(() => '(no tab-mine)')
  return `${cards}; reopened: ${await txt(T('book-size'))}; ${used}; ${mine}; rows ${await rows().count()}`
})
await stalls()

// ---------- stale chunk after a deploy (QA-1 repro) ----------
// Prod answers a missing /assets/*.js with index.html (200, text/html). Serve that for the lazy
// SitePreview chunk, which is what a tab opened before a redeploy gets, then press Preview.
chapter = 'stale-chunk'
await step('Preview after a redeploy (lazy chunk → index.html)', async () => {
  const html = await (await fetch(PROD)).text()
  await page.route(/\/assets\/SitePreview-[^/]+\.js$/, (r) =>
    r.fulfill({ status: 200, contentType: 'text/html', body: html }),
  )
  await expectVisible(T('editor-shell'))
  await T('present').click()
  await page.waitForTimeout(3000)
  const rootKids = await page.evaluate(
    () => document.getElementById('root')?.childElementCount ?? -1,
  )
  const shell = await T('editor-shell')
    .isVisible()
    .catch(() => false)
  await shot('23-stale-chunk-blank')
  await page.unroute(/\/assets\/SitePreview-[^/]+\.js$/)
  if (!shell && rootKids === 0)
    throw new Error('blank page: #root empty, editor gone, no error message')
  return `editor visible ${shell}; #root children ${rootKids}`
})

writeFileSync(
  join(OUT, 'results.json'),
  JSON.stringify({ headers, vw, vh, dpr, results, events }, null, 2),
)
console.log(
  `\n${results.filter((r) => r.ok).length}/${results.length} ok; ${events.length} events → ${OUT}`,
)
await browser.close()
