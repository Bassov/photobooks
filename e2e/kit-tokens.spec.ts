import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit tokens and surfaces (moved from uikit/scripts/qa.mjs §4 / v5 / v6 / v6.1,
// uikit-qa-split-1): duration tokens under reduced motion, text contrast on every
// surface, no blue (source + built CSS + rendered), the #232223 primary button and
// its focus ring, the 3-level surfaces (canvas #C8CACB · chrome #E1E1E1 · field
// #D7D7D7 · white = paper) in tokens and as rendered.
// v7–v0.10 (uikit-qa-split-2): editor borders / blue / surfaces, scrollbars,
// #232223 reserved for selection, rendered borders on every page, near-black
// chips, DPI badge, dashed guides carry data-allow-border, kit versions.

test.use({ viewport: { width: 1440, height: 900 } })

const SRC = path.resolve(process.cwd(), 'uikit', 'src')
const rel = (f: string) => f.split('/src/')[1] ?? f
const walk = (d: string): string[] =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? walk(`${d}/${e.name}`)
        : /\.(tsx?|css)$/.test(e.name)
          ? [`${d}/${e.name}`]
          : [],
    )

const readJson = (f: string) =>
  JSON.parse(fs.readFileSync(path.join(SRC, 'kit', f), 'utf8')) as {
    id?: string
    slug?: string
  }[]
const screenIds = readJson('screens.json').map((s) => s.id ?? '')
const featureSlugs = readJson('pages.json').map((p) => p.slug ?? p.id ?? '')

const feat = (s: string) => `#/feature/${s}`
const scr = (s: string) => `#/screen/${s}`

async function open(page: Page, hash: string) {
  await page.goto(`/uikit/${hash}`)
  await expect(page.getByTestId('demo')).toBeVisible()
}

/** no finite animation still running (enter transitions done; spinners loop forever) */
async function settled(page: Page) {
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

/** any route: its known root rendered (#/ footer, #/components sections, else the demo), animations done */
async function visit(page: Page, hash: string) {
  await page.goto(`/uikit/${hash}`)
  const root =
    hash === '#/'
      ? '[data-testid="footer-credits"]'
      : hash === '#/components'
        ? '[data-testid^="cmp-"]'
        : hash.startsWith('#/full/')
          ? '[data-testid="full"]'
          : '[data-testid="demo"]'
  await expect(page.locator(root).first()).toBeVisible()
  await settled(page)
}

/** contrast of on-primary on primary (rest, hover) and the --select token */
function primaryContrast(): [number, number, string] {
  const px = document
    .createElement('canvas')
    .getContext('2d', { willReadFrequently: true })
  if (!px) throw new Error('no 2d context')
  const rgb = (c: string) => {
    px.clearRect(0, 0, 1, 1)
    px.fillStyle = c
    px.fillRect(0, 0, 1, 1)
    return [...px.getImageData(0, 0, 1, 1).data].slice(0, 3).map((x) => x / 255)
  }
  const lum = (c: string) => {
    const [r = 0, g = 0, b = 0] = rgb(c).map((x) =>
      x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4,
    )
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const cr = (a: string, b: string) => {
    const [x = 0, y = 0] = [lum(a), lum(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }
  const v = (n: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(n).trim()
  return [
    cr(v('--primary-foreground'), v('--primary')),
    cr(v('--primary-foreground'), v('--primary-hover')),
    v('--select'),
  ]
}

/** rendered text in the --muted-foreground colour below 4.5:1 on its opaque surface */
function lowSecondaryText(): string[] {
  const cv = document.createElement('canvas').getContext('2d')
  const px = document.createElement('canvas')
  px.width = px.height = 1
  const pc = px.getContext('2d', { willReadFrequently: true })
  if (!cv || !pc) throw new Error('no 2d context')
  const rgba = (c: string) => {
    pc.clearRect(0, 0, 1, 1)
    pc.fillStyle = c
    pc.fillRect(0, 0, 1, 1)
    const [r = 0, g = 0, b = 0, a = 0] = pc.getImageData(0, 0, 1, 1).data
    return { c: [r, g, b].map((x) => x / 255), a: a / 255 }
  }
  const lum = ([r = 0, g = 0, b = 0]: number[]) => {
    const f = (x: number) =>
      x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const bgOf = (el: Element) => {
    for (let e: Element | null = el; e; e = e.parentElement) {
      const b = rgba(getComputedStyle(e).backgroundColor)
      if (b.a > 0.9 && !getComputedStyle(e).backgroundImage.includes('url'))
        return b.c
    }
    return [1, 1, 1]
  }
  cv.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue('--muted-foreground')
    .trim()
  const mh = cv.fillStyle
  const mutedRgb = [1, 3, 5].map((i) => parseInt(mh.slice(i, i + 2), 16))
  const out: string[] = []
  for (const el of document.querySelectorAll('[data-testid="demo"] *')) {
    if (
      !(el as HTMLElement).offsetParent ||
      ![...el.childNodes].some(
        (n) => n.nodeType === 3 && (n.textContent ?? '').trim(),
      )
    )
      continue
    if (el.closest('[aria-disabled="true"], [disabled], [data-disabled]'))
      continue
    const f = rgba(getComputedStyle(el).color)
    if (f.a < 0.95) continue
    const isMuted = f.c.every(
      (x, i) => Math.abs(x * 255 - (mutedRgb[i] ?? 0)) < 2,
    )
    if (!isMuted) continue
    const [x = 0, y = 0] = [lum(f.c), lum(bgOf(el))].sort((p, q) => q - p)
    const r = (x + 0.05) / (y + 0.05)
    if (r < 4.5)
      out.push(`${el.textContent.trim().slice(0, 24)} ${r.toFixed(2)}`)
  }
  return out
}

/** surface tokens normalised to #rrggbb */
function surfaceTokens(): Record<string, string> {
  const cv = document.createElement('canvas').getContext('2d')
  if (!cv) throw new Error('no 2d context')
  const hex = (c: string) => {
    cv.fillStyle = '#000'
    cv.fillStyle = c
    return cv.fillStyle
  }
  const v = (n: string) =>
    hex(getComputedStyle(document.documentElement).getPropertyValue(n).trim())
  const surf = [
    '--t-bar',
    '--t-panel',
    '--t-raised',
    '--t-field',
    '--chrome',
    '--background',
    '--card',
    '--popover',
    '--field',
    '--secondary',
    '--subtle',
    '--muted',
    '--accent',
    '--border',
    '--control',
    '--input',
    '--cover-empty',
    '--paper',
    '--placeholder',
    '--placeholder-border',
    '--placeholder-block',
  ]
  const out: Record<string, string> = {}
  for (const n of [...surf, '--t-canvas', '--t-bg']) out[n] = v(n)
  return out
}

/** every text token against the 4 surfaces: canvas, chrome, field, paper */
function textContrast(): [string, string, number][] {
  const cv = document.createElement('canvas').getContext('2d')
  if (!cv) throw new Error('no 2d context')
  const rgb = (c: string) => {
    cv.fillStyle = '#000'
    cv.fillStyle = c
    const h = cv.fillStyle
    return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  }
  const lum = (c: string) => {
    const [r = 0, g = 0, b = 0] = rgb(c).map((x) =>
      x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4,
    )
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const cr = (a: string, b: string) => {
    const [x = 0, y = 0] = [lum(a), lum(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }
  const v = (n: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(n).trim()
  const out: [string, string, number][] = []
  for (const fg of [
    '--foreground',
    '--muted-foreground',
    '--muted-foreground-on-app',
    '--accent-text',
  ])
    for (const bg of ['#C8CACB', '#E1E1E1', '#D7D7D7', '#FFFFFF'])
      out.push([fg, bg, cr(v(fg), bg)])
  return out
}

/** opaque backgrounds: W = white off paper, T = tinted near-grey off the site; [kind, rgb, who] */
function offToneSurfaces(): [string, string, string][] {
  return [...document.querySelectorAll('body *')].flatMap(
    (e): [string, string, string][] => {
      const m = /rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?/.exec(
        getComputedStyle(e).backgroundColor,
      )
      if (!m || (m[4] !== undefined && +m[4] < 1)) return []
      const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])]
      const k = `${String(r)},${String(g)},${String(b)}`
      // qa.mjs read className.toString(): an SVG className is an SVGAnimatedString
      const cls =
        e instanceof SVGElement
          ? '[object SVGAnimatedString]'
          : (e.getAttribute('class') ?? '')
      const tid = e.getAttribute('data-testid')
      const who = (tid ?? cls).slice(0, 50)
      if (r === 255 && g === 255 && b === 255) {
        const st = (e as HTMLElement).style
        const paper =
          /bg-paper|bg-white|shadow-(thumb|stage|hairline)|\bspread\b/.test(
            cls,
          ) ||
          e.closest(
            '[data-testid="spread"],[data-testid="site"],.site,[class*="shadow-thumb"],[class*="bg-paper"],[class*="shadow-stage"]',
          ) !== null ||
          st.background !== '' ||
          st.backgroundColor !== '' ||
          /swatch|handle|cursor-/.test(cls + (tid ?? ''))
        return paper ? [] : [['W', k, who]]
      }
      // the personal site's paper (rgb 244 243 240, page stock) is site content (Spec personal-site D34)
      const tinted =
        !(r === g && g === b) &&
        Math.max(r, g, b) - Math.min(r, g, b) <= 14 &&
        Math.min(r, g, b) >= 112 &&
        !e.closest('[data-testid="site"]')
      return tinted ? [['T', k, who]] : []
    },
  )
}

/** v6 no blue: blue-hue hex / rgb literals, blue Tailwind classes, the retired accent in src css + tsx */
function blueInSource() {
  // features/site/sample*: book cloth colours of the personal-site sample books are content, like the photos (Spec site-awards)
  const all = walk(SRC).filter((f) => !f.includes('/features/site/sample'))
  const hue = (r: number, g: number, b: number) => {
    const mx = Math.max(r, g, b)
    const mn = Math.min(r, g, b)
    const d = mx - mn
    if (d < 24) return null
    let h =
      mx === r
        ? ((g - b) / d) % 6
        : mx === g
          ? (b - r) / d + 2
          : (r - g) / d + 4
    h *= 60
    return h < 0 ? h + 360 : h
  }
  const blue = (h: number | null) => h !== null && h >= 180 && h <= 260
  const bad: string[] = []
  for (const f of all) {
    const t = fs.readFileSync(f, 'utf8')
    const n = rel(f)
    for (const m of t.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
      const raw = m[1] ?? ''
      const x =
        raw.length === 3
          ? raw
              .split('')
              .map((c) => c + c)
              .join('')
          : raw
      const [r = 0, g = 0, b = 0] = [0, 2, 4].map((k) =>
        parseInt(x.slice(k, k + 2), 16),
      )
      if (blue(hue(r, g, b))) bad.push(`${n}:#${raw}`)
    }
    for (const m of t.matchAll(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/g))
      if (blue(hue(Number(m[1]), Number(m[2]), Number(m[3]))))
        bad.push(`${n}:${m[0]}`)
    for (const m of t.matchAll(
      /\b(?:text|bg|border|ring|outline|fill|stroke|from|to|via|decoration|accent|caret)-(?:blue|sky|indigo|cyan)-\d+/g,
    ))
      bad.push(`${n}:${m[0]}`)
    if (/3a8afa|2b73db|--t-accent/i.test(t)) bad.push(`${n}:retired accent`)
  }
  return { files: all.length, bad }
}

/** v6 primary buttons on one route: [buttons seen, problems] */
async function primaryButtonIssues(
  page: Page,
  h: string,
): Promise<[number, string[]]> {
  await visit(page, h)
  const r = await page.evaluate(() =>
    [...document.querySelectorAll('button, a[role=button], [role=button]')]
      .filter((b) =>
        getComputedStyle(b).backgroundColor.includes('rgb(35, 34, 35)'),
      )
      .map(
        (b) =>
          [
            b.textContent.trim().slice(0, 30),
            b.querySelectorAll('svg').length,
            getComputedStyle(b).color,
          ] as const,
      ),
  )
  const bad: string[] = []
  for (const [t, n, c] of r) {
    if (n) bad.push(`${h} "${t}" svg`)
    if (c !== 'rgb(242, 242, 242)') bad.push(`${h} "${t}" ${c}`)
  }
  return [r.length, bad]
}

/** v6 source: default-variant <Button>s that wrap an icon element */
function iconButtonsInSource() {
  return walk(SRC)
    .filter((f) => f.endsWith('.tsx') && !f.includes('disclosure'))
    .flatMap((f) =>
      [
        ...fs
          .readFileSync(f, 'utf8')
          .matchAll(/<Button\b((?:[^>{]|\{[^}]*\})*)>([\s\S]*?)<\/Button>/g),
      ]
        .filter((m) => {
          const attrs = m[1] ?? ''
          return (
            (!attrs.includes('variant=') ||
              /variant=\{[^}]*"default"/.test(attrs)) &&
            /<[A-Z][\w.]*(\s[^>]*)?\/>/.test(m[2] ?? '')
          )
        })
        .map((m) => `${rel(f)}:${(m[2] ?? '').trim().slice(0, 30)}`),
    )
}

const isActiveDemoButton = () =>
  Boolean(
    document.activeElement?.closest('[data-testid=demo]') &&
    document.activeElement.matches('button'),
  )

/** Tab (≤ 41 presses) until a button inside the demo has focus */
async function tabToDemoButton(page: Page) {
  await page.keyboard.press('Tab')
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(isActiveDemoButton)) return
    await page.keyboard.press('Tab')
  }
}

/** v6.1 rendered scan over `hashes`: tinted near-grey and off-paper white surfaces */
async function scanSurfaces(page: Page, hashes: string[]) {
  // canvas; paper-stock + site-theme + token swatches (content)
  const CONTENT = new Set([
    '200,202,203',
    '246,242,234',
    '236,231,223',
    '250,248,245',
    '163,161,162',
  ])
  const tint: string[] = []
  const white: string[] = []
  for (const h of hashes) {
    await visit(page, h)
    for (const [w, k, s] of await page.evaluate(offToneSurfaces)) {
      if (w === 'W') white.push(`${h} ${s}`)
      else if (!CONTENT.has(k)) tint.push(`${h} ${k} ${s}`)
    }
  }
  return { tint, white }
}

test('reduced motion: duration tokens resolve to 0', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, feat('recents-home'))
  const dur = await page.evaluate(() =>
    ['--duration-fast', '--duration-base', '--duration-exit'].map((n) =>
      getComputedStyle(
        document.querySelector('[data-testid="home"]') ??
          document.documentElement,
      )
        .getPropertyValue(n)
        .trim(),
    ),
  )
  for (const d of dur) expect(d, dur.join(' / ')).toMatch(/^0(m?s)?$/)
})

test('v6 primary button label ≥ 4.5:1 (rest and hover); selection #232223 since v7', async ({
  page,
}) => {
  await visit(page, '#/')
  const [rest, hover, select] = await page.evaluate(primaryContrast)
  expect(rest).toBeGreaterThanOrEqual(4.5)
  expect(hover).toBeGreaterThanOrEqual(4.5)
  expect(select).toMatch(/232223|t-ink/i)
})

for (const id of ['library', 'editor-chrome', 'settings'])
  test(`screen ${id}: rendered secondary text ≥ 4.5:1 on its surface`, async ({
    page,
  }) => {
    await open(page, scr(id))
    await settled(page)
    expect(await page.evaluate(lowSecondaryText)).toEqual([])
  })

test.describe('v6 no blue, primary buttons', () => {
  test('v6 no blue: no blue-hue hex/rgb, no blue Tailwind classes, no #3A8AFA/#2B73DB/--t-accent in src css/tsx', () => {
    const { files, bad } = blueInSource()
    expect(files).toBeGreaterThan(0)
    expect(bad).toEqual([])
  })

  test('v6 no retired blue in the built stylesheet', async ({ page }) => {
    await open(page, feat('recents-home'))
    const st = await page.evaluate(() => {
      let n = 0
      for (const sh of document.styleSheets) {
        try {
          for (const r of sh.cssRules) if (/3a8afa|2b73db/i.test(r.cssText)) n++
        } catch {
          // cross-origin sheet: no rules to read
        }
      }
      return n
    })
    expect(st).toBe(0)
  })

  test('v6 primary buttons: #232223 bg, #F2F2F2 label, no icons (rendered, kit-wide sample)', async ({
    page,
  }) => {
    const routes = [scr('library')].concat(
      [
        'open-save-project',
        'recents-home',
        'editor-shell-filmstrip',
        'spread-list-panel',
        'crop-in-frame',
        'inspector',
        'in-app-publish',
        'pdf-export',
        'editor-chrome-toolbar',
      ].map(feat),
      ['#/components'],
    )
    const bad: string[] = []
    let seen = 0
    for (const h of routes) {
      const [n, b] = await primaryButtonIssues(page, h)
      seen += n
      bad.push(...b)
    }
    expect(bad).toEqual([])
    expect(seen).toBeGreaterThan(0)
  })

  test('v6 source: no icon element inside a default-variant <Button>', () => {
    expect(iconButtonsInSource()).toEqual([])
  })

  test('v6 primary rest #232223, hover #3A3839; tokens; keyboard focus ring', async ({
    page,
  }) => {
    await open(page, feat('recents-home'))
    const nb = page.locator('[data-testid=demo] [data-testid=new-book]').first()
    // v6 primary rest #232223, hover #3A3839
    expect(await nb.evaluate((b) => getComputedStyle(b).backgroundColor)).toBe(
      'rgb(35, 34, 35)',
    )
    await nb.hover()
    await expect
      .poll(() => nb.evaluate((b) => getComputedStyle(b).backgroundColor))
      .toBe('rgb(58, 56, 57)')
    await page.mouse.move(1, 1)
    // v6 tokens: ring #3A3839, select #232223 (v7), secondary #535152, on-primary #F2F2F2
    const tok = await page.evaluate(() =>
      ['--ring', '--select', '--muted-foreground', '--primary-foreground'].map(
        (n) => {
          const px = document.createElement('canvas').getContext('2d')
          if (!px) throw new Error('no 2d context')
          px.fillStyle = getComputedStyle(document.documentElement)
            .getPropertyValue(n)
            .trim()
          return px.fillStyle
        },
      ),
    )
    expect(tok.join()).toBe('#3a3839,#232223,#535152,#f2f2f2')
    // v6 keyboard focus on a demo button: 2px #3A3839 ring
    await tabToDemoButton(page)
    expect(await page.evaluate(isActiveDemoButton)).toBe(true)
    await expect
      .poll(() =>
        page.evaluate(() => {
          const e = document.activeElement as HTMLElement
          return `${e.dataset.focusVisible ?? '-'} ${getComputedStyle(e).boxShadow}`
        }),
      )
      .toMatch(/rgb\(58, 56, 57\) 0px 0px 0px [24]px/)
  })
})

test.describe('v6.1 3-level surfaces', () => {
  test('v6.1 no #D8DBE1 anywhere in src', () => {
    const hits = walk(SRC)
      .filter((f) =>
        /d8dbe1|216,\s*219,\s*225/i.test(fs.readFileSync(f, 'utf8')),
      )
      .map(rel)
    expect(hits).toEqual([])
  })

  test('v6.1 tokens: chrome / input tone, canvas, neutral surfaces, text contrast on the 4 surfaces', async ({
    page,
  }) => {
    await visit(page, '#/')
    const t = await page.evaluate(surfaceTokens)
    const chrome = [
      '--t-bar',
      '--t-panel',
      '--t-raised',
      '--chrome',
      '--background',
    ]
    // v6.1 chrome tone: bars, panels, raised, background tokens = #E1E1E1
    expect(chrome.map((n) => `${n}=${String(t[n])}`)).toEqual(
      chrome.map((n) => `${n}=#e1e1e1`),
    )
    // v6.1 input tone: --t-field / --field / --secondary = #D7D7D7
    expect([t['--t-field'], t['--field'], t['--secondary']]).toEqual([
      '#d7d7d7',
      '#d7d7d7',
      '#d7d7d7',
    ])
    // v6.1 canvas #C8CACB (user-specified; the one exemption from R=G=B)
    expect([t['--t-canvas'], t['--t-bg']]).toEqual(['#c8cacb', '#c8cacb'])
    // v6.1 surface tokens are pure neutral greys (R=G=B; canvas exempt)
    const nonNeutral = Object.entries(t).filter(
      ([n, h]) =>
        !/--t-(canvas|bg)/.test(n) &&
        !(h.slice(1, 3) === h.slice(3, 5) && h.slice(3, 5) === h.slice(5, 7)),
    )
    expect(nonNeutral).toEqual([])
    // v6.1 contrast: every text token ≥ 4.5:1 on canvas, chrome, field and paper
    const c = await page.evaluate(textContrast)
    expect(c.filter((x) => x[2] < 4.5)).toEqual([])
  })

  const surfaceRoutes = [...screenIds.map(scr), ...featureSlugs.map(feat)]
  for (let i = 0; i < surfaceRoutes.length; i += 10) {
    const chunk = surfaceRoutes.slice(i, i + 10)
    test(`v6.1 rendered (routes ${String(i + 1)}–${String(i + chunk.length)}): no tinted near-grey surfaces, white only on paper / thumbnails / content swatches`, async ({
      page,
    }) => {
      const { tint, white } = await scanSurfaces(page, chunk)
      expect(tint).toEqual([])
      expect(white).toEqual([])
    })
  }

  test('v6.1 library top bar, kit header and inputs render in tone', async ({
    page,
  }) => {
    await open(page, feat('recents-home'))
    // v6.1 library top bar renders in the chrome tone rgb(225,225,225)
    await expect(
      page.locator('[data-testid="demo"] [data-testid="library-bar"]'),
    ).toHaveCSS('background-color', 'rgb(225, 225, 225)')
    await open(page, feat('editor-chrome-toolbar'))
    // v6.1 kit header renders in the chrome tone
    await expect(page.locator('header').first()).toHaveCSS(
      'background-color',
      'rgb(225, 225, 225)',
    )
    await open(page, feat('inspector'))
    const bookTab = page
      .locator('[data-testid="scenarios"]')
      .getByRole('tab', { name: 'Book settings' })
    await bookTab.click()
    await expect(bookTab).toHaveAttribute('aria-selected', 'true')
    await expect(
      page.locator('[data-testid="demo"] input:not([type=checkbox])').first(),
    ).toBeVisible()
    // v6.1 inputs render in the field tone rgb(215,215,215)
    const inputs = await page
      .locator(
        'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color])',
      )
      .evaluateAll((els) =>
        els.map((e) => {
          let x: Element | null = e
          while (
            x &&
            getComputedStyle(x).backgroundColor === 'rgba(0, 0, 0, 0)'
          )
            x = x.parentElement
          return x ? getComputedStyle(x).backgroundColor : ''
        }),
      )
    expect(inputs.length).toBeGreaterThan(0)
    expect([...new Set(inputs)]).toEqual(['rgb(215, 215, 215)'])
  })
})

// ───────── v7–v0.10 (uikit-qa-split-2) ─────────

const UIKIT = path.resolve(process.cwd(), 'uikit')
const readSrc = (f: string) => fs.readFileSync(path.join(SRC, f), 'utf8')
const E = (page: Page, s: string) =>
  page.locator(`[data-testid="demo"] [data-testid="editor7"] ${s}`)

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

/** qa.mjs scen(): the old editor scenario `tab` now lives on feature page `slug` */
async function scen(page: Page, slug: string, tab: string) {
  await open(page, feat(slug))
  const t = page
    .locator('[data-testid="scenarios"]')
    .getByRole('tab', { name: tab, exact: true })
  await t.click()
  await expect(t).toHaveAttribute('aria-selected', 'true')
  await settled(page)
}

/** smokeS("…", "canvas"): the canvas screen with its editor rendered; console errors collected from here on */
async function openCanvas(page: Page) {
  const errs = watchErrors(page)
  await open(page, scr('canvas'))
  await expect(
    E(page, '[data-testid="panel-l"] [role=row]').first(),
  ).toBeVisible()
  await settled(page)
  return errs
}

/** v7 editor: rendered borders, blue colours, header / aside surfaces */
function editorSurfaces() {
  const root = document.querySelector('[data-testid="editor7"]')
  const bad: string[] = []
  const blue: string[] = []
  const bgs = new Set<string>()
  for (const e of root?.querySelectorAll('*') ?? []) {
    const s = getComputedStyle(e)
    if (
      e.closest(
        '[data-testid="grid-overlay"],[data-testid="print-overlay"],[data-allow-border]',
      )
    )
      continue
    for (const k of ['top', 'right', 'bottom', 'left'])
      if (
        parseFloat(s.getPropertyValue(`border-${k}-width`)) > 0 &&
        s.getPropertyValue(`border-${k}-style`) !== 'none' &&
        !s.getPropertyValue(`border-${k}-color`).includes('rgba(0, 0, 0, 0)')
      )
        bad.push(e.tagName)
    for (const c of [s.color, s.backgroundColor]) {
      const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c)
      if (m && +(m[3] ?? 0) - Math.max(+(m[1] ?? 0), +(m[2] ?? 0)) > 12)
        blue.push(c)
    }
    if (['HEADER', 'ASIDE'].includes(e.tagName)) bgs.add(s.backgroundColor)
  }
  return { bad: bad.length, blue: blue.length, bgs: [...bgs] }
}

/** #232223 anywhere in the editor except canvas selection, primary (bottom panel icon) buttons and used-photo badges */
function blackOutsideSelection() {
  const root = document.querySelector('[data-testid="editor7"]')
  const bad: string[] = []
  for (const e of root?.querySelectorAll('*') ?? []) {
    const s = getComputedStyle(e)
    const hit =
      [
        s.backgroundColor,
        s.color,
        s.outlineStyle !== 'none' ? s.outlineColor : '',
      ].some((c) => c === 'rgb(35, 34, 35)') ||
      /rgb\(35, 34, 35\)(?! 0px 0px 0px 0px)/.test(s.boxShadow)
    if (!hit) continue
    if (
      e.closest('[data-testid="sel-outline"],[data-testid="sel-handle"]') ||
      e.matches('[data-testid="sel-outline"],[data-testid="sel-handle"]')
    )
      continue
    if (e.closest('[data-testid="panel-b"]') && e.querySelector('svg')) continue
    if (e.closest('[data-photo][data-selected]') && e.tagName === 'SPAN')
      continue
    bad.push(
      `${e.tagName}.${String((e as unknown as { className: unknown }).className).slice(0, 30)}`,
    )
  }
  return bad
}

/** every rendered border on the page, outside the canvas print / grid guide overlays */
function renderedBorders() {
  const out: string[] = []
  for (const e of document.querySelectorAll('body *')) {
    if (
      e.closest(
        '[data-testid="grid-overlay"],[data-testid="print-overlay"],[data-allow-border]',
      )
    )
      continue
    const s = getComputedStyle(e)
    for (const k of ['top', 'right', 'bottom', 'left'])
      if (
        parseFloat(s.getPropertyValue(`border-${k}-width`)) > 0 &&
        s.getPropertyValue(`border-${k}-style`) !== 'none' &&
        !/rgba\(\d+, \d+, \d+, 0\)/.test(
          s.getPropertyValue(`border-${k}-color`),
        ) &&
        e.getClientRects().length
      ) {
        out.push(
          `${e.tagName.toLowerCase()}.${String(
            (e as unknown as { className: unknown }).className,
          )
            .split(' ')
            .filter((c) => c.includes('border'))
            .join('.')}`,
        )
        break
      }
  }
  return out
}

/** near-black fills outside selection, primary buttons, used badges, lightbox, list rows, cover / endpaper paper, swatches */
function nearBlackChips() {
  return [...document.querySelectorAll('[data-testid="demo"] *, #root *')]
    .filter((e) => {
      const s = getComputedStyle(e)
      const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/.exec(
        s.backgroundColor,
      )
      if (!m || (m[4] !== undefined && +m[4] < 0.9)) return false
      const r = e.getBoundingClientRect()
      return (
        r.width &&
        +(m[1] ?? 0) < 70 &&
        +(m[2] ?? 0) < 70 &&
        +(m[3] ?? 0) < 70 &&
        !e.closest(
          '[data-testid="sel-outline"],[data-testid="sel-chip"],[data-primary],[data-variant="primary"],.bg-primary,[data-used-badge],[data-testid="lightbox"],pre,[role=row],[role=gridcell],[data-testid="canvas-cover"],[data-testid="canvas-endpaper"],[data-swatch]',
        ) &&
        !/bg-primary|bg-select|bg-tag/.test(
          String((e as unknown as { className: unknown }).className),
        )
      )
    })
    .map(
      (e) =>
        `${e.tagName.toLowerCase()}:"${e.textContent.trim().slice(0, 20)}"`,
    )
}

const borderRoutes = [
  ...screenIds.map(scr),
  ...featureSlugs.map(feat),
  '#/',
  '#/components',
]

test.describe('v7–v0.10 tokens and surfaces', () => {
  test('v7 editor: no borders, no blue, 3 surfaces only', async ({ page }) => {
    const errs = await openCanvas(page)
    const r = await page.evaluate(editorSurfaces)
    expect(r.bad).toBe(0)
    expect(r.blue).toBe(0)
    expect(
      r.bgs.filter(
        (b) => b !== 'rgb(225, 225, 225)' && b !== 'rgba(0, 0, 0, 0)',
      ),
    ).toEqual([])
    expect(errs).toEqual([])
  })

  test('v7 scrollbars: thin 4/6/8 px thumbs #A8A8A8/#969696/#7E7E7E, transparent track', async ({
    page,
  }) => {
    const errs = await openCanvas(page)
    const t = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement)
      return ['--scroll-thumb-rest', '--scroll-thumb', '--scroll-thumb-hover']
        .map((n) => s.getPropertyValue(n).trim().toUpperCase())
        .join()
    })
    expect(t).toBe('#A8A8A8,#969696,#7E7E7E')
    expect(readSrc('index.css')).toMatch(
      /scrollbar-thumb \{[^}]*border: 3px solid transparent/,
    )
    expect(errs).toEqual([])
  })

  test('v7 black #232223 only on canvas selection, primary button and used-photo badges', async ({
    page,
  }) => {
    const errs = await openCanvas(page)
    await scen(page, 'frame-selection-handles', 'Frame selected')
    expect(await page.evaluate(blackOutsideSelection)).toEqual([])
    expect(errs).toEqual([])
  })

  test('v7.4 P2-1: low-DPI badge and filmstrip Low-res chip use the field grey, not near-black', async ({
    page,
  }) => {
    const errs = await openCanvas(page)
    await scen(page, 'pasteboard-workspace', 'Spread')
    await page.keyboard.press('d')
    await expect(
      page.locator('[data-testid="demo"] [data-testid="lowres-chip"]').first(),
    ).toBeAttached()
    const cols = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          '[data-testid="demo"] [data-testid="dpi-badge"], [data-testid="demo"] [data-testid="lowres-chip"]',
        ),
      ].map(
        (e) =>
          `${e.getAttribute('data-testid') ?? ''}=${getComputedStyle(e).backgroundColor}`,
      ),
    )
    const src = readSrc('sandbox/canvas.tsx') + readSrc('sandbox/chrome.tsx')
    expect(src).not.toMatch(
      /bg-dpi-low|bg-dpi-warn|bg-black\/60 px-1 py-px text-2xs font-medium text-white"><AlertTriangle/,
    )
    expect(src).toMatch(/data-testid="lowres-chip"/)
    expect(
      cols.filter(
        (c) =>
          Math.max(...(c.match(/\d+/g) ?? []).slice(0, 3).map(Number)) < 128,
      ),
    ).toEqual([])
    expect(cols.some((c) => c.startsWith('lowres-chip'))).toBe(true)
    expect(errs).toEqual([])
  })

  test('v7 no bg-primary outside buttons (black reserved)', () => {
    const ink = walk(SRC)
      .filter(
        (f) =>
          !/button\.tsx|editor7\.tsx|toast\.tsx|index\.css/.test(f) &&
          /bg-primary(?![-\w])/.test(fs.readFileSync(f, 'utf8')),
      )
      .map(rel)
    expect(ink).toEqual([])
  })

  test('kit version checks v7 … v0.10.0', () => {
    const { version } = JSON.parse(
      fs.readFileSync(path.join(UIKIT, 'package.json'), 'utf8'),
    ) as { version: string }
    expect(version, 'v7 version 0.7.x+').toMatch(/^0\.([789]|10)\./)
    expect(version, 'v7.1 version 0.7.x+').toMatch(/^0\.([789]|10)\./)
    expect(version, 'v7.2 version 0.7.x+').toMatch(/^0\.([789]|10)\./)
    expect(version, 'v7.3 version 0.7.x+').toMatch(/^0\.([789]|10)\./)
    expect(version, 'v7.4 version 0.7.4+').toMatch(/^0\.(7\.4|[89]\.|10\.)/)
    expect(version, 'v0.9 version 0.9.x').toMatch(/^0\.(9|10)\./)
    expect(version, 'v0.9.1 version 0.9.x+').toMatch(/^0\.(9|10)\./)
    expect(version, 'v0.9.2+ version 0.9.x').toMatch(/^0\.(9|10)\./)
    expect(version, 'v0.10.0 version 0.10.0').toBe('0.10.0')
  })

  test('v7.1 P2 #7: global `* { border-color }` is transparent (was var(--border) #CDCDCD)', () => {
    const css = readSrc('index.css')
    expect(css).toMatch(
      /\*, ::before, ::after \{ border-color: transparent; \}/,
    )
    expect(css).not.toMatch(
      /\*, ::before, ::after \{ border-color: var\(--border\)/,
    )
  })

  // one test per 10 routes keeps each under the default timeout
  for (let i = 0; i < borderRoutes.length; i += 10) {
    const chunk = borderRoutes.slice(i, i + 10)
    test(`v7.1 P2 #7: rendered borders = 0 on every kit page (exceptions: canvas print/grid guide overlays) — routes ${String(i + 1)}–${String(i + chunk.length)}`, async ({
      page,
    }) => {
      const bad: string[] = []
      for (const h of chunk) {
        await visit(page, h)
        bad.push(
          ...(await page.evaluate(renderedBorders)).map((b) => `${h} ${b}`),
        )
      }
      expect(bad).toEqual([])
    })
  }

  test('v7.2 P2-8: DPI badge has no inset-shadow ring', () => {
    expect(readSrc('index.css')).toMatch(/\.pb-badge \{ box-shadow: none; \}/)
  })

  test('v7.2 P2-9: no extra near-black chips (Preview · Panorama, Crop chip are light grey)', async ({
    page,
  }) => {
    const bad: string[] = []
    for (const h of [scr('canvas'), '#/full/canvas', feat('crop-in-frame')]) {
      await visit(page, h)
      bad.push(
        ...(await page.evaluate(nearBlackChips)).map((b) => `${h}: ${b}`),
      )
    }
    expect(bad).toEqual([])
    expect(readSrc('sandbox/canvas.tsx')).not.toMatch(/bg-tag[^"]*">Preview ·/)
  })

  test('v7.2 P2-11: bleed and safe guides carry data-allow-border', () => {
    expect(
      readSrc('sandbox/canvas.tsx').match(
        /data-allow-border className="absolute border border-(bleed|dashed border-guide)"/g,
      ) ?? [],
    ).toHaveLength(2)
  })

  test('v7.2 P2-6: npm run shots captures every editor scenario and writes editor-scenarios.md5', () => {
    const sh = fs.readFileSync(path.join(UIKIT, 'scripts', 'shots.mjs'), 'utf8')
    expect(sh).toMatch(/editor-scenarios\.md5/)
    expect(sh).toMatch(/screen-editor--/)
  })

  test('v7.4 P2-3: dashed guides (master items, master margin, cover safe area) carry data-allow-border', () => {
    const c = readSrc('sandbox/canvas.tsx')
    const v = readSrc('sandbox/v7.tsx')
    // master items inherited from the parent
    expect(c).toMatch(
      /p\.inherited && !st\.view\.preview && <div data-allow-border[^>]*\[outline-style:dashed\]/,
    )
    // cover safe area
    expect(v).toMatch(
      /<div data-allow-border key=\{s\} data-testid=\{`cover-safe-\$\{s\}`\}[^>]*1px dashed/,
    )
    // master margin
    expect(v).toMatch(
      /<div data-allow-border className="absolute inset-0" style=\{\{ outline: "1px dashed/,
    )
  })

  test('v0.9.3 dead amber --crop removed from index.css', () => {
    const css = readSrc('index.css')
    expect(css).not.toMatch(/--crop:\s*#e0a33a/)
    expect(css).toMatch(/--crop:\s*#6b696a/)
  })
})
