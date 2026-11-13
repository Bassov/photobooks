import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'

// site-settings (kit): Settings → Site is the editable card (Site title, Author,
// Intro ≤ 160, Theme Light · Dark); the site home lead reads it per D37 and the
// Dark theme paints the kit site (home, room, editor Preview).

const KIT = '/uikit/#/full/site-settings'
const INTRO =
  'Photographs of lakes, coasts and the people I travel with, made into books.'
const DARK_BG = [17, 17, 16]
const LIGHT_BG = [244, 243, 240]

interface Texts {
  title: string
  author: string
  intro: string
  theme: 'light' | 'dark'
}
interface Demo {
  reset: () => void
  go: (stage: string) => void
  state: () => {
    path: string
    books: { id: string; title: string; published?: boolean }[]
    open: string | null
    site: Texts
  }
}

test.use({ viewport: { width: 1440, height: 900 } })

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b
}

/** the site-settings feature page on the given scenario tab */
async function scenario(page: Page, name: string) {
  await page.goto(KIT)
  await page
    .getByTestId('scenarios')
    .getByRole('tab', { name, exact: true })
    .click()
  await expect(page.getByTestId('site-settings')).toBeVisible()
}

/** #/demo Settings → Site; returns a reader of the session's Site values */
async function settings(page: Page) {
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(() => {
    const d = (window as unknown as { __demo: Demo }).__demo
    d.reset()
    d.state().path = '~/Pictures/Photobooks'
    d.go('settings')
  })
  await page.getByTestId('settings-nav-site').click()
  return () =>
    page.evaluate(
      () => (window as unknown as { __demo: Demo }).__demo.state().site,
    )
}

/** #/demo site with one published book and the given Settings → Site values */
async function site(page: Page, texts: Partial<Texts>) {
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate((t) => {
    const d = (window as unknown as { __demo: Demo }).__demo
    d.reset()
    const s = d.state()
    s.path = '~/Pictures/Photobooks'
    s.books = [
      {
        id: 's1',
        title: 'Fog',
        published: true,
        book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: 'A5' },
      } as never,
    ]
    s.open = 's1'
    s.site = { ...s.site, ...t }
    d.go('site')
  }, texts)
  await expect(page.getByTestId('site-case')).toBeVisible()
}

/** the site root's paper (a corner pixel) and the html / body bars */
async function sitePaint(page: Page, root: Locator) {
  const [px] = await pixelsAt(root, [{ x: 3, y: 3 }])
  const bars = await page.evaluate(() =>
    [document.documentElement, document.body].map(
      (e) => getComputedStyle(e).backgroundColor,
    ),
  )
  return { px: px?.slice(0, 3), bars }
}

test.describe('kit Settings → Site card (K1)', () => {
  test('rows: Hosting field-row heights, Inter 13, the sample values', async ({
    page,
  }) => {
    await scenario(page, 'Site')
    const heights = await Promise.all(
      [
        'site-title-row',
        'site-author-row',
        'site-intro-row',
        'site-theme-row',
      ].map(async (id) => (await box(page.getByTestId(id))).height),
    )
    const want = [68.8, 68.8, 115.3, 124.5]
    for (const [i, h] of want.entries())
      expect(Math.abs((heights[i] ?? 0) - h)).toBeLessThanOrEqual(0.5)
    const title = page.getByTestId('site-title')
    await expect(title).toHaveValue('Aleksandr’s photobooks')
    await expect(title).toHaveCSS('font-size', '13px')
    await expect(title).toHaveCSS('font-family', /^"Inter Variable", Inter,/)
    await expect(page.getByTestId('site-intro')).toHaveValue(INTRO)
    await expect(page.getByTestId('site-intro-count')).toHaveText(
      `${String(INTRO.length)} / 160`,
    )
    await expect(page.getByLabel('Site title')).toHaveAttribute(
      'maxlength',
      '80',
    )
  })

  test('no values: the placeholders are the fallbacks, counter 0 / 160', async ({
    page,
  }) => {
    await scenario(page, 'No values')
    await expect(page.getByTestId('site-title')).toHaveAttribute(
      'placeholder',
      'Photobooks',
    )
    await expect(page.getByTestId('site-author')).toHaveAttribute(
      'placeholder',
      'Your name',
    )
    await expect(page.getByTestId('site-intro')).toHaveAttribute(
      'placeholder',
      'A line or two about your books',
    )
    const count = page.getByTestId('site-intro-count')
    await expect(count).toHaveText('0 / 160')
    await expect(count).toHaveCSS('font-weight', '400')
    // an author makes the intro fallback "Photobooks by {author}."
    await page.getByTestId('site-author').fill('Ann Lee')
    await page.getByTestId('site-author').press('Enter')
    await expect(page.getByTestId('site-intro')).toHaveAttribute(
      'placeholder',
      'Photobooks by Ann Lee.',
    )
  })

  test('Dark: a 152-character intro turns the counter ink 500', async ({
    page,
  }) => {
    await scenario(page, 'Dark')
    const count = page.getByTestId('site-intro-count')
    await expect(count).toHaveText('152 / 160')
    await expect(count).toHaveCSS('color', 'rgb(57, 55, 56)')
    await expect(count).toHaveCSS('font-weight', '500')
    await expect(page.getByTestId('site-theme-dark')).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
})

test.describe('kit Settings → Site commit (K3)', () => {
  test('Enter and blur commit the cleaned value; Esc reverts and keeps focus', async ({
    page,
  }) => {
    const stored = await settings(page)
    const title = page.getByTestId('site-title')
    await title.fill('  Lakes   and coasts ')
    await title.press('Enter')
    await expect(title).toHaveValue('Lakes and coasts')
    expect((await stored()).title).toBe('Lakes and coasts')
    await expect(title).toBeFocused()

    await title.fill('Draft')
    await title.press('Escape')
    await expect(title).toHaveValue('Lakes and coasts')
    await expect(title).toBeFocused()
    await expect(page.getByTestId('settings')).toBeVisible()
    expect((await stored()).title).toBe('Lakes and coasts')

    const author = page.getByTestId('site-author')
    await author.fill('Ann Lee')
    await page.getByTestId('site-title').focus()
    expect((await stored()).author).toBe('Ann Lee')
  })

  test('a pasted newline becomes a space; Enter in the intro commits', async ({
    page,
  }) => {
    const stored = await settings(page)
    const intro = page.getByTestId('site-intro')
    await intro.fill('')
    // insertText is one input event with the pasted text, as a paste
    await page.keyboard.insertText('Lakes\nand\r\ncoasts')
    await expect(intro).not.toHaveValue(/\n/)
    await intro.press('Enter')
    expect((await stored()).intro).toBe('Lakes and coasts')
    await expect(page.getByTestId('site-intro-count')).toHaveText('16 / 160')
  })
})

test.describe('kit Settings → Site theme (K2)', () => {
  test('a radiogroup: arrows move and select; roving tabindex', async ({
    page,
  }) => {
    const stored = await settings(page)
    const group = page.getByRole('radiogroup', { name: 'Theme' })
    const light = group.getByRole('radio', { name: 'Light' })
    const dark = group.getByRole('radio', { name: 'Dark' })
    await expect(light).toHaveAttribute('aria-checked', 'true')
    await expect(light).toHaveAttribute('tabindex', '0')
    await expect(dark).toHaveAttribute('tabindex', '-1')
    await light.focus()
    await page.keyboard.press('ArrowRight')
    await expect(dark).toBeFocused()
    await expect(dark).toHaveAttribute('aria-checked', 'true')
    expect((await stored()).theme).toBe('dark')
    await page.keyboard.press('ArrowLeft')
    await expect(light).toBeFocused()
    expect((await stored()).theme).toBe('light')
    // focus-visible: 2 px outline at offset 3 on the tile
    const tile = page.getByTestId('site-theme-tile-light')
    await expect(tile).toHaveCSS('outline-width', '2px')
    await expect(tile).toHaveCSS('outline-offset', '3px')
  })

  test('selected tile paints the 2 px #232223 ring; the other is the hairline', async ({
    page,
  }) => {
    await scenario(page, 'Dark')
    const row = page.getByTestId('site-theme-row')
    const r = await box(row)
    const at = async (id: string) => {
      const t = await box(page.getByTestId(id))
      return { x: t.x - r.x - 1, y: t.y - r.y + t.height / 2 }
    }
    const [sel, rest] = await pixelsAt(row, [
      await at('site-theme-tile-dark'),
      await at('site-theme-tile-light'),
    ])
    expect(sel?.slice(0, 3)).toEqual([35, 34, 35])
    // the rest ring is a .10 black hairline over the card: darker than the card, far from the ink ring
    expect(rest?.[0] ?? 0).toBeGreaterThan(150)
  })

  test('miniature geometry: 120 × 75 tile, case 92 × 37 at (14, 31), theme paper', async ({
    page,
  }) => {
    await scenario(page, 'Site')
    const mini = page.getByTestId('site-theme-mini-dark')
    const m = await box(mini)
    expect([m.width, m.height]).toEqual([120, 75])
    const [paper, kase] = await pixelsAt(mini, [
      { x: 110, y: 10 },
      { x: 16, y: 32 },
    ])
    expect(paper?.slice(0, 3)).toEqual(DARK_BG)
    expect(kase?.slice(0, 3)).toEqual([0xe4, 0xdd, 0xd1])
  })
})

test.describe('kit site theme (S6)', () => {
  test('Light: the site paper and the bars stay #f4f3f0', async ({ page }) => {
    await site(page, { theme: 'light' })
    const root = page.getByTestId('site')
    await expect(root).not.toHaveClass(/ss-dark/)
    const p = await sitePaint(page, root)
    expect(p.px).toEqual(LIGHT_BG)
    expect(p.bars).toEqual(['rgb(244, 243, 240)', 'rgb(244, 243, 240)'])
  })

  test('Dark: home and room paint #111110, html / body too', async ({
    page,
  }) => {
    await site(page, { theme: 'dark' })
    const root = page.getByTestId('site')
    await expect(root).toHaveClass(/ss-dark/)
    const p = await sitePaint(page, root)
    expect(p.px).toEqual(DARK_BG)
    expect(p.bars).toEqual(['rgb(17, 17, 16)', 'rgb(17, 17, 16)'])
    await page.getByTestId('ss9-book').first().click()
    await expect(page.getByTestId('site-room')).toBeVisible()
    expect((await sitePaint(page, root)).px).toEqual(DARK_BG)
  })

  test('Settings → Dark, then the editor Preview paints dark below its bar', async ({
    page,
  }) => {
    await settings(page)
    await page.getByTestId('site-theme-dark').click()
    await page.getByTestId('demo-settings-back').click()
    await page.evaluate(() => {
      const d = (window as unknown as { __demo: Demo }).__demo
      const s = d.state()
      s.books = [
        {
          id: 's1',
          title: 'Fog',
          book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: 'A5' },
        } as never,
      ]
      s.open = 's1'
      d.go('editor')
    })
    await page.getByTestId('demo-preview').click()
    const preview = page.getByTestId('site-preview')
    await expect(preview).toBeVisible()
    const root = preview.getByTestId('site')
    await expect(root).toHaveClass(/ss-dark/)
    expect((await sitePaint(page, root)).px).toEqual(DARK_BG)
  })

  test('personal-site Dark scenario: six books on the dark site', async ({
    page,
  }) => {
    await page.goto('/uikit/#/feature/personal-site')
    await page
      .getByTestId('scenarios')
      .getByRole('tab', { name: 'Dark', exact: true })
      .click()
    const root = page.getByTestId('site')
    await expect(root).toHaveClass(/ss-dark/)
    await expect(root).toHaveAttribute('data-books', '6')
  })
})

test.describe('kit site lead (D37)', () => {
  test('the lead is the intro', async ({ page }) => {
    await site(page, { author: 'Aleksandr Basov', intro: 'Lakes and coasts.' })
    await expect(page.getByTestId('site-lead')).toHaveText('Lakes and coasts.')
  })

  test('no intro: "Photobooks by {author}."', async ({ page }) => {
    await site(page, { author: 'Aleksandr Basov', intro: ' ' })
    await expect(page.getByTestId('site-lead')).toHaveText(
      'Photobooks by Aleksandr Basov.',
    )
  })

  test('no intro, no author: no lead; the case moves up to 104', async ({
    page,
  }) => {
    await site(page, { author: '', intro: '' })
    await expect(page.getByTestId('site-lead')).toHaveCount(0)
    const home = await box(page.getByTestId('site-home'))
    const c = await box(page.getByTestId('site-case'))
    expect(Math.abs(c.y - home.y - 104)).toBeLessThanOrEqual(0.5)
  })

  test('room → Fullscreen opens the lightbox', async ({ page }) => {
    await site(page, { author: 'Aleksandr Basov', intro: INTRO })
    await expect(page.getByTestId('site-lead')).toHaveText(INTRO)
    await page.getByTestId('ss9-book').first().click()
    await page.getByTestId('site-fullscreen-btn').click()
    await expect(page.getByTestId('lightbox')).toBeVisible()
  })
})
