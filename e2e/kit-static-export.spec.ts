import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit static export (moved from uikit/scripts/qa.mjs static-export, uikit-qa-split-5): the
// Export site pill keeps one rect in every state; the dialog is the kit Publish frame. The test
// also fails on a console error / warning, page error or failed request, like qa.mjs (qa.mjs runs
// with scrollbars shown, so this spec does too).

test.use({
  viewport: { width: 1440, height: 900 },
  // qa.mjs Chrome: scrollbars shown, unhinted (fractional) text widths
  launchOptions: {
    ignoreDefaultArgs: ['--hide-scrollbars'],
    args: ['--font-render-hinting=none'],
  },
})

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

const TABS = {
  'opts-empty': 'Options, no folder',
  'run-hidden': 'Hidden, 42 %',
  done: 'Exported',
  failed: 'Failed',
  opts: 'Options',
}

async function pick(page: Page, id: keyof typeof TABS) {
  await page
    .locator(`[data-testid="scenarios"] [role="tab"]:text-is("${TABS[id]}")`)
    .evaluate((t: HTMLElement) => {
      t.click()
    })
  await settled(page)
}

const pill = (page: Page) =>
  page
    .locator('[data-scenario] [data-testid="demo-export-site"]')
    .first()
    .evaluate((e: HTMLElement) => {
      const r = e.getBoundingClientRect()
      return [
        e.dataset.state,
        +r.x.toFixed(2),
        +r.width.toFixed(2),
        r.height,
      ] as const
    })

test('static-export (Designer static-export §1–2): Export site pill rect, dialog frame, done step gap', async ({
  page,
}) => {
  const errs = watchErrors(page)
  const out: Record<
    string,
    readonly [string | undefined, number, number, number]
  > = {}
  for (const w of [1440, 1200]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.goto('/uikit/#/feature/static-export')
    await expect(page.getByTestId('demo')).toBeVisible()
    await settled(page)
    for (const id of ['opts-empty', 'run-hidden', 'done', 'failed'] as const) {
      await pick(page, id)
      out[`${String(w)} ${id}`] = await pill(page)
    }
  }
  const same = (w: number, ww: number) =>
    Object.entries(out)
      .filter(([k]) => k.startsWith(`${String(w)} `))
      .every(
        ([, [, x, pw, h]]) =>
          Math.abs(x - (out[`${String(w)} opts-empty`]?.[1] ?? NaN)) <= 0.5 &&
          Math.abs(pw - ww) <= 0.5 &&
          h === 32,
      )
  expect(
    Object.values(out)
      .map((v) => v[0])
      .join() === 'idle,running,done,failed,idle,running,done,failed' &&
      same(1440, 112.33) &&
      same(1200, 40),
    `static-export: Export site pill rect identical in idle / running 42 % / done / failed, 112.33 × 32 at 1440, 40 × 32 at 1200 — ${JSON.stringify(out)}`,
  ).toBe(true)
  await page.setViewportSize({ width: 1440, height: 900 })
  await pick(page, 'opts')
  const dlg = await page
    .locator('[data-testid="export-site-dialog"]')
    .evaluate((d) => {
      const cs = getComputedStyle(d)
      const head = d.firstElementChild
      if (!head) throw new Error('no dialog heading')
      const hs = getComputedStyle(head)
      return {
        w: d.closest('[role=dialog]')?.getBoundingClientRect().width,
        pad: `${cs.paddingTop} ${cs.paddingRight}`,
        h: `${hs.fontFamily.split(',')[0]?.replace(/"/g, '') ?? ''} ${hs.fontSize}/${hs.lineHeight} ${hs.fontWeight}`,
        btns: [...d.querySelectorAll('button')]
          .slice(-2)
          .map(
            (b) =>
              `${String(b.getBoundingClientRect().height)} ${getComputedStyle(b).borderRadius}`,
          ),
      }
    })
  expect(
    dlg.w === 480 &&
      dlg.pad === '20px 24px' &&
      dlg.h === 'Lora Variable 21px/26.25px 500' &&
      dlg.btns.join() === '36 8px,36 8px',
    `static-export: dialog 480 wide, padding 20 / 24, heading Lora 21/26.25 500, buttons 36 h r8 — ${JSON.stringify(dlg)}`,
  ).toBe(true)
  // Designer review 2: the done step's "To open it…" block sits 16 px under the summary (kit Publish done mt-4)
  await pick(page, 'done')
  const gap = await page
    .locator('[data-testid="export-site-summary"]')
    .evaluate((s) => {
      const n = s.nextElementSibling
      if (!n) throw new Error('no block after the summary')
      return +(
        n.getBoundingClientRect().top - s.getBoundingClientRect().bottom
      ).toFixed(2)
    })
  expect(
    Math.abs(gap - 16) <= 0.5,
    `static-export: done step's open-it block 16 px under the summary — gap ${String(gap)}`,
  ).toBe(true)
  expect(errs).toEqual([])
})
