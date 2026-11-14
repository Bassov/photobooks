import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import {
  clearReactCommits,
  installReactCommitProbe,
  reactCommitsOutside,
} from './fixtures/reactCommits'
import { topAt } from './fixtures/paintProbe'
import { exportToDone, useOpfsFolder } from './fixtures/siteExport'
import { PERF_BUDGETS } from './perf/budgets'
import {
  browserAssertNoLoaf,
  browserBeginLoafScenarioWindow,
  browserStartLoafScripts,
  browserTakeLoafScripts,
  clearPerfScenario,
} from './perf/perfFixture'

// Designer spec site-settings: Settings → Site edits Site title, Author and
// Intro in place (S2–S4); the Preview and the exported site use them.

const TITLE = 'Alps and Sea'
const AUTHOR = 'Ann Lee'
const INTRO = 'Books from the mountains and the coast.'

async function openSite(page: Page): Promise<void> {
  await page.getByTestId('editor-settings-open').click()
  await page.getByTestId('settings-nav-site').click()
  await expect(page.getByTestId('settings-section-title')).toHaveText('Site')
  await expect(page.getByTestId('site-settings')).toBeVisible()
}

async function openLibraryEditor(page: Page): Promise<void> {
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 15_000,
  })
}

/** `library.json` `site` of the OPFS test library. */
async function storedSite(page: Page): Promise<unknown> {
  return page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle('photobooks-e2e-library')
    const file = await (await dir.getFileHandle('library.json')).getFile()
    return (JSON.parse(await file.text()) as { site?: unknown }).site ?? null
  })
}

/** `dist/index.html` of an OPFS export folder. */
async function exportedHome(page: Page, name: string): Promise<string> {
  return page.evaluate(async (name) => {
    const root = await navigator.storage.getDirectory()
    const folder = await root.getDirectoryHandle(name)
    const dist = await folder.getDirectoryHandle('dist')
    return (await (await dist.getFileHandle('index.html')).getFile()).text()
  }, name)
}

test('the site fields save on commit, survive a reload and feed Preview and export', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openLibraryEditor(page)
  await openSite(page)

  await page.getByTestId('site-title').fill(`  ${TITLE} `)
  await page.getByTestId('site-title').press('Enter')
  await page.getByTestId('site-author').fill(AUTHOR)
  await page.getByTestId('site-author').press('Tab')
  await page.getByTestId('site-intro').fill(INTRO)
  await page.getByTestId('site-intro').blur()
  await expect(page.getByTestId('site-title')).toHaveValue(TITLE)
  await expect
    .poll(() => storedSite(page))
    .toEqual({ title: TITLE, author: AUTHOR, intro: INTRO })

  await page.reload()
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 15_000,
  })
  await openSite(page)
  await expect(page.getByTestId('site-title')).toHaveValue(TITLE)
  await expect(page.getByTestId('site-author')).toHaveValue(AUTHOR)
  await expect(page.getByTestId('site-intro')).toHaveValue(INTRO)
  await expect(page.getByTestId('site-intro-count')).toHaveText(
    `${String(INTRO.length)} / 160`,
  )

  await page.getByTestId('editor-settings-back').click()
  await page.getByTestId('present').click()
  const preview = page.getByTestId('site-preview')
  const name = preview.getByTestId('site-name')
  await expect(name).toHaveText(AUTHOR)
  await expect(name).toBeVisible()
  // Paint: the topmost hit at the name's centre is the name (nothing covers it).
  const [top] = await topAt(name)
  expect(top).toContain('site-name')
  await page.keyboard.press('Escape')
  await expect(preview).toHaveCount(0)

  await useOpfsFolder(page, 'site-settings-export')
  await exportToDone(page, true)
  const html = await exportedHome(page, 'site-settings-export')
  expect(html).toContain(`<title>${TITLE}</title>`)
  expect(html).toContain(INTRO)
  expect(html).toContain(AUTHOR)
})

test('Esc reverts a field and keeps focus; empty fields show the site fallbacks', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/?fixture=painter')
  await expect(page.getByTestId('spread-view').first()).toBeVisible()
  await openSite(page)

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
  await expect(page.getByTestId('site-intro-count')).toHaveText('0 / 160')
  for (const [row, h] of [
    ['site-title-row', 68.8],
    ['site-author-row', 68.8],
    ['site-intro-row', 115.3],
  ] as const) {
    const box = await page.getByTestId(row).boundingBox()
    expect(Math.abs((box?.height ?? 0) - h), row).toBeLessThanOrEqual(0.5)
  }

  const author = page.getByTestId('site-author')
  await author.fill('Ann')
  await author.press('Enter')
  await author.fill('Bo')
  await author.press('Escape')
  await expect(author).toHaveValue('Ann')
  await expect(author).toBeFocused()
  await expect(page.getByTestId('site-settings')).toBeVisible()
  await expect(page.getByTestId('site-intro')).toHaveAttribute(
    'placeholder',
    'Photobooks by Ann.',
  )
})

test.describe('frame-budget gates', () => {
  test('typing 20 characters in Intro: zero LoAF, only the Site card commits', async ({
    page,
  }) => {
    await installReactCommitProbe(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?fixture=painter&perf=1')
    await expect(page.getByTestId('spread-view').first()).toBeVisible()
    await openSite(page)
    const intro = page.getByTestId('site-intro')
    await intro.click()

    await clearPerfScenario(page)
    await page.evaluate(browserStartLoafScripts)
    await page.evaluate(browserBeginLoafScenarioWindow)
    await clearReactCommits(page)
    await intro.pressSequentially('Twenty chars of text')
    await expect(intro).toHaveValue('Twenty chars of text')
    await expect(page.getByTestId('site-intro-count')).toHaveText('20 / 160')
    // A late LoAF lands after the last frame: give it time to arrive.
    await page.evaluate(
      () => new Promise((resolve) => setTimeout(resolve, 500)),
    )
    const rows = await page.evaluate(browserTakeLoafScripts)
    console.log(
      `site-intro typing: ${String(rows.length)} LoAF ${JSON.stringify(rows)}`,
    )
    await page.evaluate(browserAssertNoLoaf, PERF_BUDGETS.loafEntriesMax)

    const commits = await reactCommitsOutside(
      page,
      '[data-testid="site-settings"]',
    )
    console.log(`site-intro typing commits: ${JSON.stringify(commits)}`)
    expect(commits.commits).toBeGreaterThanOrEqual(20)
    expect(commits.rendered).toBeGreaterThanOrEqual(20)
    expect(commits.outside).toEqual([])
  })
})
