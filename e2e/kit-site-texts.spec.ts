import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'

// site-settings (kit): Settings → Site is the editable card (Site title, Author,
// Intro ≤ 160); the site home lead (also in the editor Preview) reads it per
// D37. The site has one look (Owner 2026-11-13: no Theme).

const KIT = '/uikit/#/full/site-settings'
const INTRO =
  'Photographs of lakes, coasts and the people I travel with, made into books.'
const LIGHT_BG = [244, 243, 240]

interface Texts {
  title: string
  author: string
  intro: string
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
      ['site-title-row', 'site-author-row', 'site-intro-row'].map(
        async (id) => (await box(page.getByTestId(id))).height,
      ),
    )
    const want = [68.8, 68.8, 115.3]
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
    await expect(page.getByTestId('site-theme-row')).toHaveCount(0)
    await expect(page.getByRole('radiogroup')).toHaveCount(0)
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

  test('from 150 characters the counter turns ink 500; 160 is the cap', async ({
    page,
  }) => {
    await scenario(page, 'Site')
    const intro = page.getByTestId('site-intro')
    const count = page.getByTestId('site-intro-count')
    await intro.fill('x'.repeat(149))
    await expect(count).toHaveText('149 / 160')
    await expect(count).toHaveCSS('font-weight', '400')
    await intro.fill('x'.repeat(150))
    await expect(count).toHaveText('150 / 160')
    await expect(count).toHaveCSS('color', 'rgb(57, 55, 56)')
    await expect(count).toHaveCSS('font-weight', '500')
    await intro.fill('')
    await page.keyboard.insertText('x'.repeat(170))
    await expect(count).toHaveText('160 / 160')
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

test.describe('kit site look (one look)', () => {
  test('the site paper and the bars are #f4f3f0, home and room', async ({
    page,
  }) => {
    await site(page, {})
    const root = page.getByTestId('site')
    const p = await sitePaint(page, root)
    expect(p.px).toEqual(LIGHT_BG)
    expect(p.bars).toEqual(['rgb(244, 243, 240)', 'rgb(244, 243, 240)'])
    await page.getByTestId('ss9-book').first().click()
    await expect(page.getByTestId('site-room')).toBeVisible()
    expect((await sitePaint(page, root)).px).toEqual(LIGHT_BG)
  })

  test('a Settings intro commit reaches the editor Preview', async ({
    page,
  }) => {
    await settings(page)
    const intro = page.getByTestId('site-intro')
    await intro.fill('Lakes and coasts.')
    await intro.press('Enter')
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
    // the home stays mounted under the start room and leads with the session's intro
    await expect(preview.getByTestId('site-lead')).toHaveText(
      'Lakes and coasts.',
    )
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
