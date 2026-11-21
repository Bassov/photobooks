import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { openLibraryBook } from './fixtures/openLibraryBook'

// Designer walkthrough-polish-review (2026-11-20), item 3 polish-surface:
// P4 radii by role, P5 one shadow ink rgb(20 20 19), P7 one warning ink
// #845510. Kit (`uikit/src/index.css`) and prod (`styles/tokens.css`) hold the
// same values; probes resolve each token on a throwaway element.

test.use({ viewport: { width: 1440, height: 900 } })

const RADII = {
  '--radius-2xs': '2px',
  '--radius-xs': '4px',
  '--radius-sm': '6px',
  '--radius-md': '8px',
  '--radius-lg': '10px',
  '--radius-xl': '14px',
  '--radius-full': '9999px',
}
const SHADOWS = [
  '--shadow-xs',
  '--shadow-sm',
  '--shadow-md',
  '--shadow-lg',
  '--shadow-book',
  '--shadow-book-hover',
  '--page-shadow',
]
const WARNING_INK = 'rgb(132, 85, 16)'
const SHADOW_INK = /^rgba\(20, 20, 19, [\d.]+\)$/

async function probeTokens(page: Page) {
  return page.evaluate(
    ({ radii, shadows }) => {
      const el = document.createElement('div')
      document.body.append(el)
      const s = getComputedStyle(el)
      const radius: Record<string, string> = {}
      for (const name of radii) {
        el.style.borderRadius = `var(${name})`
        radius[name] = s.borderTopLeftRadius
      }
      const shadow: Record<string, string> = {}
      for (const name of shadows) {
        el.style.boxShadow = `var(${name})`
        shadow[name] = s.boxShadow
      }
      el.style.color = 'var(--warning-ink)'
      const warning = s.color
      el.className = 'rounded-full'
      el.style.borderRadius = ''
      const roundedFull = s.borderTopLeftRadius
      el.remove()
      return { radius, shadow, warning, roundedFull }
    },
    { radii: Object.keys(RADII), shadows: SHADOWS },
  )
}

function expectSpecTokens(tokens: Awaited<ReturnType<typeof probeTokens>>) {
  expect(tokens.radius).toEqual(RADII)
  expect(tokens.roundedFull).toBe('9999px')
  expect(tokens.warning).toBe(WARNING_INK)
  for (const name of SHADOWS) {
    const inks = tokens.shadow[name]?.match(/rgba?\([^)]*\)/g) ?? []
    expect(inks.length, name).toBeGreaterThan(0)
    for (const ink of inks) expect(ink, name).toMatch(SHADOW_INK)
  }
}

const radiusOf = (locator: Locator) =>
  locator.evaluate((el) => getComputedStyle(el).borderTopLeftRadius)

test('prod: P4 / P5 / P7 tokens and a pill, a control and a dialog on them', async ({
  page,
}) => {
  await openLibraryBook(page)
  expectSpecTokens(await probeTokens(page))

  // Pill: top-bar Print; control: the 32 px title / Book settings button.
  expect(await radiusOf(page.getByTestId('print'))).toBe('9999px')
  const title = page.getByRole('button', { name: 'Book settings', exact: true })
  expect(await radiusOf(title)).toBe('8px')

  await page.getByTestId('print').click()
  await expect(page.getByTestId('print-dialog')).toBeVisible()
  const dialog = page.getByRole('dialog')
  expect(await radiusOf(dialog)).toBe('14px')
})

test('kit: P4 / P5 / P7 tokens equal prod', async ({ page }) => {
  await page.goto('/uikit/')
  await expect(page.locator('body')).toBeVisible()
  expectSpecTokens(await probeTokens(page))
})
