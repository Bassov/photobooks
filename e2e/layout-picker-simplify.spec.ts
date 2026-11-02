import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import {
  assertDocumentFitsViewport,
  assertNamedScrollport,
} from './fixtures/assertDocumentFitsViewport'
import { layoutTile, openSpreadTab } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'

// Owner product decision 2026-11-02 14:11 (a deliberate difference from the
// kit): uncaptioned builtin tiles, one list by photo count without search or
// Suggested, the selected name in the header, Two portraits merged into One
// per page where it only adds margins (two-page spreads).

test.use({ viewport: { width: 1440, height: 900 } })

const section = (page: Page) => page.getByTestId('layout-section')
const tiles = (page: Page) => section(page).getByTestId('layout-tile')

/** [title, aria-label] of every listed tile, in list order. */
const tileLabels = (page: Page) =>
  tiles(page).evaluateAll((els) =>
    els.map((el) => [el.getAttribute('title'), el.getAttribute('aria-label')]),
  )

const named = (names: readonly string[]) =>
  names.map((name) => [name, `Apply layout ${name}`])

async function selectSpread23(page: Page) {
  await page.getByTestId('spread-list-item-spread-2').click()
  await expect(page.getByTestId('inspector-spread-summary')).toHaveText(
    /^Pages 2–3 · \d+ empty$/,
  )
  await openSpreadTab(page)
  // Hover paints tiles; keep the pointer off the panel.
  await page.mouse.move(0, 899)
}

/** Spread 2–3 builtins by photo count (1, 2, 3, 5), kit order inside a count. */
const SPREAD_2_3 = [
  'Full bleed',
  'Panorama',
  'Framed single',
  'One per page',
  'Offset pair',
  'Hero + two',
  'Three across',
  'Landscape + 2 portraits',
  'Hero + grid',
]

test('spread 2–3 lists one uncaptioned grid by photo count; filters and header follow', async ({
  page,
}) => {
  await openSessionEditor(page)
  await selectSpread23(page)

  await expect.poll(() => tileLabels(page)).toEqual(named(SPREAD_2_3))
  await expect(section(page).getByTestId('tpl-grid')).toHaveCount(1)
  await expect(section(page).getByTestId('tpl-suggested')).toHaveCount(0)
  await expect(section(page)).not.toContainText(/Suggested|All layouts/)
  await expect(section(page).getByRole('searchbox')).toHaveCount(0)
  await expect(tiles(page).getByTestId('tpl-name')).toHaveCount(0)
  for (const tile of await tiles(page).all()) {
    await expect(tile).toHaveText('')
  }
  await expect(page.getByTestId('tab-all')).toHaveText('All 9')

  // The header names the pressed layout.
  await expect(layoutTile(page, 'One per page')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByTestId('layout-note')).toHaveText('· One per page')
  await layoutTile(page, 'Hero + two').click()
  await expect(layoutTile(page, 'Hero + two')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByTestId('layout-note')).toHaveText('· Hero + two')

  const chip = (id: string) =>
    page.getByTestId('tpl-chips').locator(`[data-chip="${id}"]`)
  const byChip: [string, string[]][] = [
    ['1', ['Full bleed', 'Panorama', 'Framed single']],
    ['2', ['One per page', 'Offset pair']],
    ['3', ['Hero + two', 'Three across', 'Landscape + 2 portraits']],
    ['4', ['Hero + grid']],
    ['all', SPREAD_2_3],
  ]
  for (const [id, names] of byChip) {
    await chip(id).click()
    await expect(chip(id)).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => tileLabels(page)).toEqual(named(names))
  }

  // My templates: empty, then a saved layout keeps its visible caption.
  await page.getByTestId('tab-mine').click()
  await expect(tiles(page)).toHaveCount(0)
  await expect(page.getByTestId('tpl-empty')).toHaveText(
    'No templates yet. Save a spread you like.',
  )
  await page.getByTestId('tpl-save').click()
  await page.getByTestId('tpl-rename-input').fill('Trip opener')
  await page.getByTestId('tpl-rename-input').press('Enter')
  await expect(tiles(page).getByTestId('tpl-name')).toHaveText(['Trip opener'])
  await page.getByTestId('tab-all').click()
  await expect(page.getByTestId('tab-all')).toHaveText('All 10')
  // Saved from Hero + two (3 photos): after the 3-photo builtins.
  await expect
    .poll(() => tileLabels(page))
    .toEqual(named([...SPREAD_2_3.slice(0, 8), 'Trip opener', 'Hero + grid']))
  await expect(tiles(page).getByTestId('tpl-name')).toHaveText(['Trip opener'])

  await assertDocumentFitsViewport(page)
  await assertNamedScrollport(page, 'inspector-body', { axis: 'vertical' })
})

test('the one-page first spread keeps Two portraits (two photos, not a margin variant)', async ({
  page,
}) => {
  await openSessionEditor(page)
  await openSpreadTab(page)
  await expect(page.getByTestId('tab-all')).toHaveText('All 10')
  await page.getByTestId('tpl-chips').locator('[data-chip="2"]').click()
  await expect
    .poll(() => tileLabels(page))
    .toEqual(named(['Offset pair', 'Two portraits']))
})

/**
 * Spread 2–3 of a 300 × 300 mm book (15 mm margins) as saved before this
 * change with Two portraits: one centred 3:4 frame per 270 × 270 mm page box.
 */
const LEGACY_SPREAD_2 = {
  templateId: 'two-portraits',
  frames: [
    {
      id: 'spread-2-f0',
      rect: { x: 48.75, y: 15, width: 202.5, height: 270 },
      z: 0,
    },
    {
      id: 'spread-2-f1',
      rect: { x: 348.75, y: 15, width: 202.5, height: 270 },
      z: 1,
    },
  ],
}

interface StoredSpread {
  id: string
  templateId?: string
  frames: { id: string; rect: unknown; z: number }[]
}

test('a book saved with Two portraits opens with its frame rects; One per page stands for it', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const folder = `photobooks-e2e-legacy-tpl-${String(process.pid)}-${String(Date.now())}`
  await openSessionEditor(page)
  const bookId = await page.evaluate(async (folderName) => {
    const api = window.__photobooksProject
    if (!api) throw new Error('missing api')
    const attached = await api.attachOpfsTestLibrary(folderName)
    if (!attached.ok) throw new Error(attached.code ?? 'attach')
    const created = await api.createBookInLibrary('Legacy', {
      trim: { widthMm: 300, heightMm: 300 },
    })
    if (!created.ok || !created.value) throw new Error(created.code ?? 'create')
    return created.value.id
  }, folder)
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 15_000,
  })
  await page.getByTestId('go-library').click()
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })

  /** Read (and with `patch`, rewrite) spread 2 of the stored book.json. */
  const storedSpread = (patch?: typeof LEGACY_SPREAD_2) =>
    page.evaluate(
      async ({ folderName, id, next }) => {
        const root = await navigator.storage.getDirectory()
        const lib = await root.getDirectoryHandle(folderName)
        const books = await lib.getDirectoryHandle('books')
        const dir = await books.getDirectoryHandle(id)
        const handle = await dir.getFileHandle('book.json')
        const raw = JSON.parse(await (await handle.getFile()).text()) as {
          spreads: StoredSpread[]
        }
        const spread = raw.spreads[1]
        if (spread === undefined) throw new Error('no spread 2')
        if (next !== null) {
          Object.assign(spread, next)
          const writable = await handle.createWritable()
          await writable.write(JSON.stringify(raw))
          await writable.close()
        }
        return spread
      },
      { folderName: folder, id: bookId, next: patch ?? null },
    )
  const saved = await storedSpread(LEGACY_SPREAD_2)
  expect(saved).toMatchObject({ id: 'spread-2', ...LEGACY_SPREAD_2 })

  await page.evaluate(() => {
    sessionStorage.clear()
  })
  await page.reload()
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.getByTestId(`library-book-${bookId}`).click()
  await expect(page.getByTestId('editor-shell')).toBeVisible({
    timeout: 20_000,
  })
  await selectSpread23(page)

  // Rendered frames sit at the stored rects (mm of the 600 × 300 spread).
  const view = page.locator(
    '[data-testid="spread-view"][data-spread-id="spread-2"]',
  )
  await expect(view.locator('[data-frame-id]')).toHaveCount(2)
  const rendered = await view.evaluate((el) => {
    const box = el.getBoundingClientRect()
    return [...el.querySelectorAll('[data-frame-id]')].map((frame) => {
      const r = frame.getBoundingClientRect()
      return {
        id: frame.getAttribute('data-frame-id'),
        x: ((r.left - box.left) / box.width) * 600,
        y: ((r.top - box.top) / box.height) * 300,
        width: (r.width / box.width) * 600,
        height: (r.height / box.height) * 300,
      }
    })
  })
  expect(rendered.map((frame) => frame.id)).toEqual([
    'spread-2-f0',
    'spread-2-f1',
  ])
  rendered.forEach((frame, index) => {
    const want = LEGACY_SPREAD_2.frames[index]?.rect
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(frame[key] - (want?.[key] ?? NaN))).toBeLessThan(1)
    }
  })

  // The picker shows the merged tile pressed and names it in the header.
  await expect(layoutTile(page, 'Two portraits')).toHaveCount(0)
  await expect(layoutTile(page, 'One per page')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByTestId('layout-note')).toHaveText('· One per page')
  // Opening rewrote nothing: the stored id and frames are unchanged.
  expect(await storedSpread()).toMatchObject(LEGACY_SPREAD_2)
  await assertDocumentFitsViewport(page)
})
