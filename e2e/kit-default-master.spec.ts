import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit default master (moved from uikit/scripts/qa.mjs default-master, uikit-qa-split-6; Designer
// spec 2026-11-04 + Owner amendment: the Master control is always a select): on #/demo, one A5
// book with endpapers, the spread Master select and status, Edit master, the Masters intro and
// Default tag, Make default. One stateful walk, like qa.mjs. The test also fails on a console
// error / warning, page error or failed request, like qa.mjs (qa.mjs runs with scrollbars shown,
// so this spec does too).

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

const BOOK = { endp: true, endpSame: true, w: 14.8, h: 21, preset: 'A5' }

interface DemoApi {
  reset: () => void
  state: () => {
    path: string
    books: { id: string; title: string; book: typeof BOOK }[]
    open: string
  }
  go: (view: string) => void
}

test('default-master (Designer spec 2026-11-04): spread Master select + status, Edit master, Default tag, Make default', async ({
  page,
}) => {
  const errs = watchErrors(page)
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate((book) => {
    const d = (window as unknown as { __demo: DemoApi }).__demo
    d.reset()
    d.state().path = '~/Pictures/Photobooks'
    d.state().books = [{ id: 's1', title: 'Default master', book }]
    d.state().open = 's1'
    d.go('editor')
  }, BOOK)
  const L = (s: string) => page.locator(`${DEMO} ${s}`)
  await expect(L('[data-item="p1"]')).toBeVisible()
  await settled(page)
  const click = async (s: string) => {
    await L(s).click()
    await settled(page)
  }
  await click('[data-item="p1"]')
  const sel = L('[data-testid="spread-master-select"]')
  const status = () =>
    L('[data-testid="spread-master-status"]').evaluate((e) => ({
      t: e.firstElementChild?.textContent,
      h: e.getBoundingClientRect().height,
      edit: !!e.querySelector('[data-testid="spread-master-edit"]'),
    }))
  const opts = await sel.locator('option').allTextContents()
  const w = await sel.evaluate((e) => e.getBoundingClientRect().width)
  const s0 = await status()
  const col = await L('[data-testid="spread-spacing"]').evaluate(
    (e) => e.getBoundingClientRect().width,
  )
  const radios = await L('[role=radiogroup][aria-label="Master"]').count()
  expect(
    opts.join('|') === 'Master A · default|Master B|None' &&
      Math.abs(w - col) <= 0.5 &&
      w > 250 &&
      radios === 0,
    `default-master S1: spread 2–3 Master is a select (Master A · default, Master B, None), full section width (prod 268), no radiogroup — ${opts.join('|')} w=${String(w)} col=${String(col)}`,
  ).toBe(true)
  expect(
    s0.t === 'Book default' && Math.abs(s0.h - 16.8) < 0.05 && s0.edit,
    `default-master S2/S3: status "Book default" 16.8 tall with Edit master — ${JSON.stringify(s0)}`,
  ).toBe(true)
  await sel.selectOption('B')
  await settled(page)
  const s1 = await status()
  await sel.selectOption('none')
  await settled(page)
  const s2 = await status()
  expect(
    s1.t === 'Instead of Master A' &&
      s1.edit &&
      s2.t === 'No master on this spread' &&
      !s2.edit,
    `default-master S2: "Instead of Master A", then "No master on this spread" without Edit master — ${String(s1.t)} | ${String(s2.t)} edit=${String(s2.edit)}`,
  ).toBe(true)
  await sel.selectOption('A')
  await settled(page)
  await click('[data-testid="spread-master-edit"]')
  const intro = await L('[data-testid="masters-intro"]').textContent()
  const tagOn = await L(
    '[data-item="mA"] [data-testid="master-default-tag"]',
  ).count()
  const head = await L('[data-testid="master-usage"]').textContent()
  const makeDefault = await L('[data-testid="master-make-default"]').count()
  expect(
    !!intro?.includes('Spreads use the default, Master A, unless') &&
      tagOn === 1 &&
      /^Default · all \d+ pages$/.test(head ?? '') &&
      makeDefault === 0,
    `default-master S3/P1/P2/I1: Edit master opens Masters on Master A; the note names it; Master A tagged Default; head "Default · all N pages" — ${String(intro)} tag=${String(tagOn)} head=${String(head)}`,
  ).toBe(true)
  await click('[data-testid="master-menu-A"]')
  const aMenu = {
    make: await page.getByTestId('master-menu-make-default').count(),
    del: await page
      .getByTestId('master-menu-delete')
      .getAttribute('aria-disabled'),
  }
  await page.keyboard.press('Escape')
  await settled(page)
  expect(
    aMenu.make === 0 && aMenu.del === 'true',
    `default-master P3: the default's row menu has no Make default and a disabled Delete — ${JSON.stringify(aMenu)}`,
  ).toBe(true)
  await click('[data-item="mB"]')
  const hb = await L('[data-testid="master-usage"]').textContent()
  const hint = await L('[data-testid="master-hint"]').count()
  await click('[data-testid="master-make-default"]')
  const after = {
    tag: await L('[data-item="mB"] [data-testid="master-default-tag"]').count(),
    tagA: await L(
      '[data-item="mA"] [data-testid="master-default-tag"]',
    ).count(),
    intro: await L('[data-testid="masters-intro"]').textContent(),
    button: await L('[data-testid="master-make-default"]').count(),
    order: await L('[data-testid="list"] [data-item]').evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.item).join(),
    ),
  }
  expect(
    hb === 'Not used yet' &&
      hint === 1 &&
      after.tag === 1 &&
      after.tagA === 0 &&
      !!after.intro?.includes('default, Master B,') &&
      after.button === 0 &&
      after.order === 'mA,mB',
    `default-master I2/I3/P2: Master B "Not used yet" + hint; Make default moves the tag and the note, list order kept, button gone — ${JSON.stringify({ hb, hint, ...after })}`,
  ).toBe(true)
  await L('[data-testid="mode-seg"] button').nth(0).click()
  await settled(page)
  await click('[data-item="p1"]')
  const follow = {
    v: await sel.inputValue(),
    opts: (await sel.locator('option').allTextContents()).join('|'),
    s: (await status()).t,
  }
  expect(
    follow.v === 'B' &&
      follow.opts === 'Master A|Master B · default|None' &&
      follow.s === 'Book default',
    `default-master: spread 2–3 follows the new default Master B — ${JSON.stringify(follow)}`,
  ).toBe(true)
  // default-master: no console errors
  expect(errs).toEqual([])
})
