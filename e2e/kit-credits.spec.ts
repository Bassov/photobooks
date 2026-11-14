import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit photo credits (moved from uikit/scripts/qa.mjs v0.6.0, uikit-qa-split-1;
// v7 / v8, uikit-qa-split-3): credit links in the kit chrome, #/full has no kit
// credit line, the #/credits page, the index footer link and PHOTO-CREDITS.md
// cover every bundled hi/ photo; the in-product CC BY-SA caption.

test.use({ viewport: { width: 1440, height: 900 } })

const UIKIT = path.resolve(process.cwd(), 'uikit')
const credit = '[data-testid="kit-photo-credits"] [data-testid="photo-credit"]'

interface DemoApi {
  reset: () => void
  state: () => { path: string }
  go: (view: string) => void
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

/** every in-product screen credit: size, colour, contrast on its backdrop, placement, capsule look */
function screenCredits() {
  const cs = [
    ...document.querySelectorAll<HTMLElement>(
      '[data-testid="demo"] [data-testid="screen-credit"]',
    ),
  ]
  /** [relative luminance, alpha] of an rgb()/rgba() colour */
  const lum = (c: string): [number, number] => {
    const [r = 0, g = 0, b = 0, a = 1] = (c.match(/[\d.]+/g) ?? []).map(Number)
    const f = (v: number) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return [0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b), a]
  }
  return cs.map((e) => {
    const s = getComputedStyle(e)
    let bg: string | null = null
    for (let a: HTMLElement | null = e; a; a = a.parentElement) {
      const b = getComputedStyle(a).backgroundColor
      if (b && lum(b)[1] >= 0.5) {
        bg = b
        break
      }
      if (getComputedStyle(a).backgroundImage !== 'none') break
    }
    const L1 = lum(s.color)[0]
    const L2 = bg ? lum(bg)[0] : lum('rgb(200,202,203)')[0]
    const r = e.getBoundingClientRect()
    const host = (
      e.closest('[data-demo-stage]') ?? e.closest('[data-testid="demo"]')
    )?.getBoundingClientRect() ?? { top: 0, right: 0 }
    const cn = (e.getAttribute('class') ?? '').replace(/\[&_a\]:[^\s]+/g, '')
    const pill =
      /\b(?:rounded-(?:full|md|lg|xl|2xl)|bg-\[|#E1E1E1)|\bshadow-(?:sm|md|lg|pill|hairline)\b/.test(
        cn,
      ) || parseFloat(s.backgroundColor.match(/[\d.]+/g)?.[3] ?? '0') > 0.2
    return {
      fs: s.fontSize,
      c: s.color,
      cr: +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2),
      topRight: r.top - host.top < 48 && host.right - r.right < 48,
      underExample:
        !!e.closest('figcaption') &&
        !!e.closest('[data-testid="example-book"]'),
      pill,
      txt: e.textContent,
      links: [...e.querySelectorAll('a')].map((a) => getComputedStyle(a).color),
    }
  })
}

test('v6 credit links underline on hover only', async ({ page }) => {
  await page.goto('/uikit/#/screen/library')
  const a = page.locator(`${credit} a`).first()
  await expect(a).toHaveCSS('text-decoration-line', 'none')
  await a.hover()
  await expect(a).toHaveCSS('text-decoration-line', 'underline')
})

test('v6→v8 #/full/library: no kit credit line, only the in-product Welcome caption', async ({
  page,
}) => {
  await page.goto('/uikit/#/full/library')
  await expect(page.locator('[data-testid="screen-credit"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="photo-credit"]')).toHaveCount(0)
})

test('v6 #/credits page lists the 10 Commons photos + the CC0 set', async ({
  page,
}) => {
  await page.goto('/uikit/#/credits')
  await expect(
    page.locator('[data-testid="credits-hi"] [data-testid="photo-credit"]'),
  ).toHaveCount(10)
  expect(
    await page.locator('[data-testid="credits-cc0"] li').count(),
  ).toBeGreaterThanOrEqual(20)
})

test('v6 index footer links to Photo credits', async ({ page }) => {
  await page.goto('/uikit/#/')
  await expect(page.locator('[data-testid="footer-credits"]')).toHaveAttribute(
    'href',
    '#/credits',
  )
})

test('v6 PHOTO-CREDITS.md: a TASL row per bundled hi/ photo; files present, nothing extra', () => {
  const md = fs.readFileSync(path.join(UIKIT, 'PHOTO-CREDITS.md'), 'utf8')
  const hi = path.join(UIKIT, 'public', 'photos', 'hi')
  const ids = [
    'c18',
    'c18b',
    'c13',
    'r2',
    'x-tatra',
    'r7',
    'c25',
    'r8',
    'r6',
    'x-valley',
  ]
  expect(ids.filter((i) => !md.includes(`hi/${i}.jpg`))).toEqual([])
  expect(ids.filter((i) => !fs.existsSync(path.join(hi, `${i}.jpg`)))).toEqual(
    [],
  )
  expect(fs.readdirSync(hi)).toHaveLength(ids.length)
})

// ───────── v7 / v8 (uikit-qa-split-3) ─────────

test('v7 credits page: links #393738, no underline at rest, no lines', async ({
  page,
}) => {
  await page.goto('/uikit/#/credits')
  await expect(
    page.locator('[data-testid="credits-hi"] [data-testid="photo-credit"]'),
  ).toHaveCount(10)
  await settled(page)
  const r = await page.evaluate(() => {
    const a = document.querySelector('main a[href^=http], table a')
    const s = a && getComputedStyle(a)
    const lines = [...document.querySelectorAll('main *, table *')].filter(
      (e) => {
        const c = getComputedStyle(e)
        return (
          parseFloat(c.borderTopWidth) > 0 &&
          c.borderTopStyle !== 'none' &&
          !c.borderTopColor.includes('rgba(0, 0, 0, 0)')
        )
      },
    ).length
    return { c: s?.color, d: s?.textDecorationLine, lines }
  })
  expect(r.c, JSON.stringify(r)).toBe('rgb(57, 55, 56)')
  expect(r.d, JSON.stringify(r)).not.toMatch(/underline/)
  expect(r.lines, JSON.stringify(r)).toBe(0)
})

test('v0.9 §1 CC BY-SA caption: Welcome top-right plain, empty library under EXAMPLE, 11px #535152, no capsule, contrast ≥4.5', async ({
  page,
}) => {
  const shown = page.locator(
    '[data-testid="demo"] [data-testid="screen-credit"]',
  )
  await page.goto('/uikit/#/screen/library')
  await expect(shown.first()).toBeVisible()
  await settled(page)
  const out = await page.evaluate(screenCredits)
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(() => {
    const d = (window as unknown as { __demo: DemoApi }).__demo
    d.reset()
    d.state().path = '~/Pictures/Photobooks'
    d.go('library')
  })
  await expect(
    page.locator('[data-testid="demo"] [data-testid="example-book"]'),
  ).toBeVisible()
  await expect(shown.first()).toBeVisible()
  await settled(page)
  out.push(...(await page.evaluate(screenCredits)))
  const info = JSON.stringify(
    out.map((x) => [
      x.fs,
      x.c,
      x.cr,
      x.topRight,
      x.underExample,
      x.pill,
      x.txt,
    ]),
  )
  expect(out, info).toHaveLength(2)
  for (const x of out) {
    expect(x.fs, info).toBe('11px')
    expect(x.c, info).toBe('rgb(83, 81, 82)')
    expect(x.cr, info).toBeGreaterThanOrEqual(4.5)
    expect(x.pill, info).toBe(false)
    expect(x.txt, info).toMatch(/CC BY-SA/)
    expect(
      x.links.every((l) => l === 'rgb(83, 81, 82)'),
      info,
    ).toBe(true)
  }
  const [welcome, empty] = out
  expect(welcome?.topRight, info).toBe(true)
  expect(empty?.underExample, info).toBe(true)
})
