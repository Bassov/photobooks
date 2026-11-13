import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import { addSpreads } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import { topAt } from './fixtures/paintProbe'
import {
  browserAssertNoLoaf,
  browserBeginLoafScenarioWindow,
  clearPerfScenario,
  collectFrameStatsArtifact,
  enablePerfScenario,
} from './perf/perfFixture'

// Designer spec site-preview-mode: Preview opens the site's book room of the
// live book under a 48 px bar; the editor stays mounted, inert, unchanged.

const ACTIVE_SPREAD = '[data-active="true"] [data-testid="spread-view"]'

interface Box {
  x: number
  y: number
  width: number
  height: number
}

async function box(locator: Locator): Promise<Box> {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
}

function near(actual: number, expected: number, label: string): void {
  expect(
    Math.abs(actual - expected),
    `${label}: ${String(actual)}`,
  ).toBeLessThanOrEqual(0.5)
}

async function openPreview(page: Page): Promise<Locator> {
  await page.getByTestId('present').click()
  const preview = page.getByTestId('site-preview')
  await expect(preview.getByTestId('ps-reader')).toBeVisible()
  return preview
}

/** One view on in the room's reader, at rest. */
async function next(page: Page): Promise<void> {
  const reader = page.getByTestId('site-preview').getByTestId('ps-reader')
  const view = Number(await reader.getAttribute('data-view'))
  await page.keyboard.press('ArrowRight')
  await expect(reader).toHaveAttribute('data-view', String(view + 1))
  await expect(reader).toHaveAttribute('data-turn', 'rest')
}

async function noDocumentScroll(page: Page): Promise<void> {
  const doc = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    sh: document.documentElement.scrollHeight,
    w: innerWidth,
    h: innerHeight,
  }))
  expect(doc.sw).toBe(doc.w)
  expect(doc.sh).toBe(doc.h)
  await assertDocumentFitsViewport(page)
}

/** Frames / photos painted in a spread: the edit fingerprint Preview mirrors. */
async function paint(spread: Locator): Promise<string> {
  const frames = await spread.getByTestId('spread-frame').count()
  const photos = await spread.getByTestId('spread-frame-image').count()
  return `${String(frames)} frames / ${String(photos)} photos`
}

test('Preview opens the site book room of the current book on the cover (1440 × 900)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSessionEditor(page)
  // A selected later spread must not change where the preview starts.
  await page.locator('[data-testid^="spread-list-item-"]').nth(1).click()
  const preview = await openPreview(page)
  await expect(preview).toHaveAttribute('role', 'dialog')
  await expect(preview).toHaveAttribute('aria-modal', 'true')
  await expect(preview).toHaveAttribute('aria-label', 'Site preview')
  await expect(page.getByTestId('editor-shell')).toHaveAttribute('inert', '')

  const bar = await box(preview.getByTestId('site-preview-bar'))
  near(bar.y, 0, 'bar y')
  near(bar.height, 48, 'bar h')
  const back = preview.getByTestId('site-preview-back')
  await expect(back).toHaveText('Back to the editor')
  await expect(back).toHaveAttribute('title', 'Back to the editor (Esc)')
  await expect(back).toHaveAttribute('aria-keyshortcuts', 'Escape')
  const backBox = await box(back)
  near(backBox.x, 12, 'back x')
  near(backBox.y, 8, 'back y')
  near(backBox.height, 32, 'back h')
  const label = preview.getByTestId('site-preview-label')
  await expect(label).toHaveText('Site preview')
  near((await box(label)).x, backBox.x + backBox.width + 8, 'label x')

  // The room fills the box under the bar; its foot row sits 54 px off the bottom.
  const site = preview.getByTestId('site-preview-scroll')
  const room = await box(site.getByTestId('site-room'))
  near(room.y, 48, 'room y')
  near(room.height, 852, 'room h')
  await expect(site.getByTestId('site-about')).toContainText(/\d+ pages/)
  // Nothing published: no site name, no "All books", no Share.
  await expect(site.getByTestId('site-name')).toHaveCount(0)
  await expect(site.getByTestId('site-all-books')).toHaveCount(0)
  await expect(site.getByTestId('site-share')).toHaveCount(0)
  const play = await box(site.getByTestId('site-play'))
  near(play.y, 846, 'foot y')
  near(play.height, 44, 'foot h')
  near(play.x + play.width, 1416, 'play right')
  const fullscreen = await box(site.getByTestId('site-fullscreen-btn'))
  near(fullscreen.x + fullscreen.width, play.x - 24, 'fullscreen right')
  const pager = await box(site.getByTestId('site-pager'))
  near(pager.y, 846, 'pager y')
  near(pager.x + pager.width / 2, 720, 'pager centre')
  const reader = await box(site.getByTestId('ps-reader'))
  expect(reader.y).toBeGreaterThan(48)
  expect(reader.y + reader.height).toBeLessThan(846)
  // Painted on top: the reader and the editor's Library link under Back.
  expect((await topAt(site.getByTestId('ps-reader')))[0]).toContain(
    'site-preview',
  )
  expect((await topAt(page.getByTestId('go-library')))[0]).toContain(
    'site-preview-back',
  )

  await expect(site.getByTestId('site-label')).toHaveText('Cover')
  await expect(
    site.getByTestId('ps-reader').getByTestId('spread-view'),
  ).toHaveCount(0)
  await next(page)
  await expect(site.getByTestId('site-label')).toHaveText(/^Page 1 of \d+$/)
  await expect(
    site.getByTestId('ps-reader').getByTestId('spread-view').first(),
  ).toBeVisible()
  await page.keyboard.press('End')
  await expect(site.getByTestId('site-label')).toHaveText('Back cover')
  await page.keyboard.press('Home')
  await expect(site.getByTestId('site-label')).toHaveText('Cover')
  await noDocumentScroll(page)
  // The preview never writes the URL.
  expect(new URL(page.url()).hash).toBe('')
})

test('at 1280 × 720 the room fits under the bar without any scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSessionEditor(page)
  const preview = await openPreview(page)

  await page.setViewportSize({ width: 1280, height: 720 })
  const scroll = preview.getByTestId('site-preview-scroll')
  await expect
    .poll(async () => (await box(preview.getByTestId('site-play'))).y)
    .toBeCloseTo(720 - 54, 0)
  const room = await box(preview.getByTestId('site-room'))
  near(room.height, 672, 'room h')
  const reader = await box(preview.getByTestId('ps-reader'))
  expect(reader.y + reader.height).toBeLessThan(720 - 54)
  const over = await scroll.evaluate((el) => el.scrollHeight - el.clientHeight)
  expect(over).toBeLessThanOrEqual(0)
  await noDocumentScroll(page)
})

test('Preview shows unsaved edits: a removed photo / frame and a new title', async ({
  page,
}) => {
  await openSessionEditor(page)
  const preview = page.getByTestId('site-preview')
  const editorSpread = page.locator(ACTIVE_SPREAD)
  const frame = editorSpread.getByTestId('spread-frame').first()

  await openPreview(page)
  await next(page)
  // Page 1 is one right page: one face paints the spread.
  const before = await paint(preview.getByTestId('ps-reader'))
  expect(before).toBe(await paint(editorSpread))
  await page.keyboard.press('Escape')
  await expect(preview).toHaveCount(0)

  await frame.click()
  await expect(frame).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Delete')
  await expect.poll(() => paint(editorSpread)).not.toBe(before)
  await page.evaluate(() => {
    const api = window.__photobooksProject
    if (!api?.dispatchBookOpForTests) {
      throw new Error('dispatchBookOpForTests missing')
    }
    api.dispatchBookOpForTests({ type: 'setTitle', title: 'Lake trip' })
  })

  await openPreview(page)
  await expect(preview.getByTestId('site-about')).toContainText('Lake trip')
  await next(page)
  await expect
    .poll(() => paint(preview.getByTestId('ps-reader')))
    .toBe(await paint(editorSpread))
})

test('editor keys are inert in the preview; Esc returns the editor unchanged', async ({
  page,
}) => {
  await openSessionEditor(page)
  await page.locator('[data-testid^="spread-list-item-"]').nth(1).click()
  const frame = page.locator(ACTIVE_SPREAD).getByTestId('spread-frame').first()
  await frame.click()
  await expect(frame).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('zoom-in').click()
  const scroll = page.getByTestId('pasteboard-scroll')
  await scroll.evaluate((el) => {
    el.scrollTop += 37
    el.scrollLeft += 11
  })
  const state = async () => ({
    spread: await page.locator(ACTIVE_SPREAD).getAttribute('data-spread-id'),
    pressed: await frame.getAttribute('aria-pressed'),
    frame: await box(frame),
    paint: await paint(page.locator(ACTIVE_SPREAD)),
    zoom: await page.getByTestId('zoom-label').textContent(),
    scroll: await scroll.evaluate((el) => [el.scrollTop, el.scrollLeft]),
    url: page.url(),
  })
  const before = await state()

  const preview = await openPreview(page)
  for (const key of [
    'Delete',
    'Backspace',
    'Control+z',
    'Meta+z',
    'Control+Shift+z',
    'Control+d',
    'ArrowUp',
    'ArrowDown',
    '+',
    '-',
    'v',
    't',
    'Shift+R',
  ]) {
    await page.keyboard.press(key)
  }
  // A held Space never arms the editor's pan.
  await page.keyboard.down('Space')
  await page.keyboard.up('Space')
  // Modifiers never step the views.
  await page.keyboard.press('Alt+ArrowRight')
  await expect(preview.getByTestId('site-label')).toHaveText('Cover')

  await page.keyboard.press('Escape')
  await expect(preview).toHaveCount(0)
  await expect(page.getByTestId('present')).toBeFocused()
  await expect(page.getByTestId('editor-shell')).not.toHaveAttribute(
    'inert',
    '',
  )
  expect(await state()).toEqual(before)
  await expect(frame.getByTestId('sel-handle')).toHaveCount(8)
})

test('Back closes the preview; Fullscreen closes first on Esc; Tab stays inside', async ({
  page,
}) => {
  await openSessionEditor(page)
  let preview = await openPreview(page)
  await preview.getByTestId('site-preview-back').click()
  await expect(preview).toHaveCount(0)
  await expect(page.getByTestId('present')).toBeFocused()

  preview = await openPreview(page)
  const focusInside = () =>
    page.evaluate(
      () =>
        document.activeElement?.closest('[data-testid="site-preview"]') != null,
    )
  expect(await focusInside()).toBe(true)
  for (const key of [
    ...Array<string>(10).fill('Tab'),
    ...Array<string>(10).fill('Shift+Tab'),
  ]) {
    await page.keyboard.press(key)
    expect(await focusInside(), key).toBe(true)
  }

  await preview.getByTestId('site-fullscreen-btn').click()
  const lightbox = page.getByTestId('lightbox')
  await expect(lightbox).toBeVisible()
  const indicator = page.getByTestId('site-fullscreen-indicator')
  await expect(indicator).toHaveText(/^Page 1 of \d+$/)
  await page.keyboard.press('ArrowRight')
  await expect(indicator).toHaveText(/^Pages 2–3 of \d+$/)
  await page.keyboard.press('Escape')
  await expect(lightbox).toHaveCount(0)
  await expect(preview).toBeVisible()
  // The lightbox's spread comes back to the room.
  await expect(preview.getByTestId('site-label')).toHaveText(
    /^Pages 2–3 of \d+$/,
  )
  await expect(preview.getByTestId('site-fullscreen-btn')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(preview).toHaveCount(0)
  await expect(page.getByTestId('present')).toBeFocused()
})

test.describe('frame-budget gates', () => {
  test('opening the preview and stepping views and Fullscreen stays within frame-budget gates', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000)
    await enablePerfScenario(page, '/?perf=1')
    await addSpreads(page, 9)
    await expect(page.getByTestId('pasteboard-scroll')).toHaveAttribute(
      'data-spread-count',
      '12',
    )
    const previewChunk = () =>
      page.evaluate(
        () =>
          performance
            .getEntriesByType('resource')
            .filter((entry) => /\/SitePreview[-.][^/]*$/.test(entry.name))
            .length,
      )
    // Lazy: the preview chunk is not part of the editor's initial JS.
    expect(await previewChunk()).toBe(0)
    const step = async (key: string): Promise<void> => {
      await page.keyboard.press(key)
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              resolve()
            })
          }),
      )
    }

    // Warm-up open (chunk load), then the measured window.
    const preview = await openPreview(page)
    expect(await previewChunk()).toBeGreaterThan(0)
    await page.keyboard.press('Escape')
    await expect(preview).toHaveCount(0)
    await page.waitForTimeout(250)
    await clearPerfScenario(page)
    await page.evaluate(browserBeginLoafScenarioWindow)

    await openPreview(page)
    for (let i = 0; i < 10; i += 1) await next(page)
    await expect(page.getByTestId('site-label')).toHaveText(
      /^Pages 18–19 of \d+$/,
    )
    await page.getByTestId('site-fullscreen-btn').click()
    await expect(page.getByTestId('lightbox')).toBeVisible()
    for (let i = 0; i < 5; i += 1)
      await step(i % 2 === 0 ? 'ArrowRight' : 'ArrowLeft')
    await step('Escape')
    await expect(page.getByTestId('lightbox')).toHaveCount(0)
    await step('Escape')
    await expect(page.getByTestId('site-preview')).toHaveCount(0)

    await page.evaluate(browserAssertNoLoaf, 0)
    await collectFrameStatsArtifact(page, testInfo)
  })
})
