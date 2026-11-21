import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit frame style + photo inspector (moved from uikit/scripts/qa.mjs v7.2 P1-5, v8.2 and the
// kit-sync W3 opening KS6 / KS12, uikit-qa-split-5): Fill / Fit, flip, Adjust, Caption; the
// White mat sliders reset to the style's real default; no Hide inspector in the inspector head;
// prod's flip glyphs. Every test also fails on a console error / warning, page error or failed
// request, like qa.mjs (qa.mjs runs with scrollbars shown, so these specs do too).

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

/** qa.mjs scen("Photo"): the old editor scenario lives on #/feature/frame-selection-handles, tab Frame selected */
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

interface DemoApi {
  reset: () => void
  state: () => {
    path: string
    books: { id: string; title: string; book: Record<string, unknown> }[]
    open: string
  }
  go: (view: string) => void
}

/** qa.mjs v8.2: #/demo with one A5 book open in the editor */
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
  await expect(D(page, '[data-testid="canvas"]')).toBeVisible()
  await settled(page)
}

/** the frame images' transform | filter when a frame is selected */
function frameImgs() {
  if (
    !document.querySelector('[data-testid="demo"] [data-testid="sel-outline"]')
  )
    return ''
  return [
    ...document.querySelectorAll<HTMLElement>(
      '[data-testid="demo"] [data-testid="frame"] img',
    ),
  ]
    .map((x) => x.style.transform + '|' + x.style.filter)
    .join(';')
}

test('v7.2 P1-5 (canvas): Photo inspector has Fill/Fit, Rotate & flip, Adjust, Caption — and they work', async ({
  page,
}) => {
  const errs = await open(page, '#/screen/canvas')
  await scenPhoto(page)
  const titles = (
    await D(page, '[data-testid="ctx-inspector"]').innerText()
  ).toLowerCase()
  const has = ['Fill', 'Fit', 'Adjust', 'Caption'].filter(
    (t) => !titles.includes(t.toLowerCase()),
  )
  // P12: Flip H / Flip V are icon-only segments, named by aria-label.
  for (const name of ['Flip H', 'Flip V']) {
    await expect(
      D(page, '[data-testid="ctx-inspector"]').getByRole('button', {
        name,
        exact: true,
      }),
    ).toBeVisible()
  }
  const img = () => page.evaluate(frameImgs)
  const t0 = await img()
  await D(page, '[data-testid="flip-h"]').click()
  await settled(page)
  const t1 = await img()
  await D(page, '[data-testid="ctx-inspector"]')
    .getByRole('button', { name: 'Caption' })
    .click()
  await settled(page)
  await D(page, '[data-testid="caption-input"]').fill('Sunset at Zoutelande')
  await settled(page)
  const cap = await D(page, '[data-testid="frame-caption"]')
    .first()
    .textContent()
    .catch(() => '')
  await D(page, '[data-testid="ctx-inspector"]')
    .getByRole('button', { name: 'Adjust' })
    .click()
  await settled(page)
  const sl = await D(
    page,
    '[data-testid="adjust"] [role=slider], [data-testid="adjust"] input[type=range]',
  ).count()
  expect(
    has.length === 0 &&
      t0 !== t1 &&
      t1.includes('scale(-') &&
      cap === 'Sunset at Zoutelande' &&
      sl === 3,
    `missing=${has.join(',') || '-'} flip=${String(t1.includes('scale(-'))} caption="${String(cap)}" sliders=${String(sl)}`,
  ).toBe(true)
  expect(errs).toEqual([])
})

test('P12: Rotate & flip is one 28 px row of four 16 px icon segments, Straighten 48 px below', async ({
  page,
}) => {
  const errs = await open(page, '#/screen/canvas')
  await scenPhoto(page)
  const row = D(page, '[data-testid="rotate-row"]')
  const rowBox = await row.boundingBox()
  const top = rowBox?.y ?? Number.NaN
  // Scrollbars are shown here, so the inspector column is narrower than 268.
  expect(rowBox?.height).toBe(28)
  let left = 0
  for (const id of ['rot-left', 'rot-right', 'flip-h', 'flip-v']) {
    const segment = D(page, `[data-testid="${id}"]`)
    const b = await segment.boundingBox()
    // --field track p-0.5 / gap-0.5: (row − 2 × 2 − 3 × 2) / 4 wide, 24 tall
    expect(b).toMatchObject({
      y: top + 2,
      width: ((rowBox?.width ?? 0) - 10) / 4,
      height: 24,
    })
    expect(b?.x ?? 0).toBeGreaterThan(left)
    left = b?.x ?? 0
    expect(await segment.locator('svg').boundingBox()).toMatchObject({
      width: 16,
      height: 16,
    })
  }
  const straighten = await D(page, '[data-testid="ctx-inspector"]')
    .getByText('Straighten', { exact: true })
    .boundingBox()
  expect((straighten?.y ?? 0) - top).toBe(48)
  await D(page, '[data-testid="flip-h"]').click()
  await expect(D(page, '[data-testid="flip-h"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(errs).toEqual([])
})

const DEF = { Mat: 3, Stroke: 0, 'Corner radius': 0 } // "White mat" preset (DEFAULT_STYLES)

/** qa.mjs v8.2 probe: pick White mat, then per slider value → Shift+→ → double-click → value + data-reset */
async function probe(page: Page) {
  await page.locator('[data-testid="frame"]').first().click()
  await settled(page)
  const list = page.locator('[data-testid="style-list"]')
  if (!(await list.isVisible())) {
    await page
      .getByRole('button', { name: /^Frame style/ })
      .first()
      .click()
    await settled(page)
  }
  await list.getByRole('button', { name: 'White mat', exact: true }).click()
  await settled(page)
  const sec = list.locator('xpath=..')
  const out: Record<string, number[]> = {}
  for (const l of Object.keys(DEF)) {
    const sl = sec.locator('[data-reset]').filter({ hasText: l }).first()
    const r = sl.locator('input[type=range]').first()
    const v0 = Number(await r.inputValue())
    await sl.hover()
    await page.keyboard.press('Shift+ArrowRight')
    await settled(page)
    const v1 = Number(await r.inputValue())
    await sl.dblclick()
    await settled(page)
    out[l] = [
      v0,
      v1,
      Number(await r.inputValue()),
      Number(await sl.getAttribute('data-reset')),
    ]
  }
  return out
}

const good = (o: Record<string, number[]>) =>
  Object.entries(DEF).every(([l, d]) => {
    const v = o[l]
    return !!v && v[0] === d && v[1] !== d && v[2] === d && v[3] === d
  })

test('v8.2 frame style Mat / Stroke / Corner radius: change, double-click → the style real default, main editor and #/demo', async ({
  page,
}) => {
  const errs = await open(page, '#/screen/canvas')
  const a = await probe(page)
  await demoBook(page, 'Style probe')
  const b = await probe(page)
  expect(
    good(a) && good(b),
    `v8.2 frame style Mat / Stroke / Corner radius: change, double-click → the style's real default (White mat 3 / 0 / 0), main editor and #/demo — ${JSON.stringify({ editor: a, demo: b })}`,
  ).toBe(true)
  expect(errs).toEqual([])
})

test('kit-sync W3 opening (#/demo): KS6 no Hide inspector in the inspector head, KS12 prod flip glyphs', async ({
  page,
}) => {
  // kit-sync W3 opening: fresh #/demo, library, book "Lake trip", a photo folder
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
  const hide = () =>
    page
      .locator(
        `${DEMO} :is([data-testid="inspector-header"], [data-testid="inspector-legacy"]) [aria-label^="Hide inspector"]`,
      )
      .count()
  const hideSpread = await hide()
  const toggle = await page
    .locator(`${DEMO} [data-testid="toggle-r"][aria-label="Hide inspector"]`)
    .count()
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
  const hidePhoto = await hide()
  expect(
    hideSpread === 0 && hidePhoto === 0 && toggle === 1,
    `kit-sync KS6: inspector head has no Hide inspector button (spread and photo); the top-bar toggle stays — spread ${String(hideSpread)} photo ${String(hidePhoto)} toggle ${String(toggle)}`,
  ).toBe(true)
  const flips = await page.evaluate(() =>
    ['flip-h', 'flip-v'].map((id) =>
      [
        ...document.querySelectorAll(
          `[data-testid="demo"] [data-testid="${id}"] svg path`,
        ),
      ]
        .map((p) => p.getAttribute('d'))
        .join(' '),
    ),
  )
  expect(
    flips[0] ===
      'm3 7 5 5-5 5V7 m21 7-5 5 5 5V7 M12 20v2 M12 14v2 M12 8v2 M12 2v2' &&
      flips[1] ===
        'm17 3-5 5-5-5h10 m17 21-5-5-5 5h10 M4 12H2 M10 12H8 M16 12h-2 M22 12h-2',
    `kit-sync KS12: Flip H / Flip V carry prod's glyphs — ${JSON.stringify(flips)}`,
  ).toBe(true)
  expect(errs).toEqual([])
})
