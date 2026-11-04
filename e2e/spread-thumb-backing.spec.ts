import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { addSpreads } from './fixtures/layoutTiles'
import { openLibraryBook } from './fixtures/openLibraryBook'

// spread-thumb-grey-backing (Owner 2026-11-05): on a trim narrower than the
// 1.6:1 thumb box (15 × 21 cm → 1.43:1) the paper is centred in the row-wide
// box. The box paints nothing (no fill, no shadow): the list shows beside the
// paper, and the kit card (2px radius, --spread-card-shadow) is on the paper.
const CARD_SHADOW = 'rgba(0, 0, 0, 0.14) 0px 1px 2px 0px'

test.use({ viewport: { width: 1440, height: 900 } })

async function rect(locator: Locator) {
  const r = await locator.boundingBox()
  if (r === null) throw new Error('not visible')
  return r
}

/**
 * Red channel of the row screenshot along the box's mid line and the line
 * just under it, from the row edge to 3 px left of the paper (outside the
 * paper's own 2px shadow blur).
 */
async function marginPixels(page: Page, row: Locator) {
  const rowRect = await rect(row)
  const paper = await rect(row.locator('.spread-view--thumb'))
  const png = (await page.screenshot({ clip: rowRect })).toString('base64')
  return page.evaluate(
    async ({ png, width, mid, under }) => {
      const blob = await (await fetch(`data:image/png;base64,${png}`)).blob()
      const bitmap = await createImageBitmap(blob)
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const ctx = canvas.getContext('2d')
      if (ctx === null) throw new Error('no 2d context')
      ctx.drawImage(bitmap, 0, 0)
      const line = (y: number) =>
        Array.from(ctx.getImageData(0, y, width, 1).data).filter(
          (_, i) => i % 4 === 0,
        )
      return { mid: line(mid), under: line(under) }
    },
    {
      png,
      width: Math.floor(paper.x - rowRect.x) - 3,
      mid: Math.round(paper.y - rowRect.y + paper.height / 2),
      under: Math.round(paper.y - rowRect.y + paper.height) + 1,
    },
  )
}

async function expectNoBacking(page: Page, row: Locator, at: string) {
  const box = row.locator('.editor-spread-thumb')
  const paper = box.locator('.spread-view--thumb')
  const boxRect = await rect(box)
  const paperRect = await rect(paper)
  // Precondition: the paper is narrower than the box.
  expect(boxRect.width - paperRect.width, at).toBeGreaterThan(10)
  await expect(box, at).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(box, at).toHaveCSS('box-shadow', 'none')
  await expect(paper, at).toHaveCSS('box-shadow', CARD_SHADOW)
  await expect(paper, at).toHaveCSS('border-radius', '2px')
  // Every pixel beside / under the margins is the row background.
  const { mid, under } = await marginPixels(page, row)
  const list = mid[0]
  expect(new Set(mid), `${at} mid line`).toEqual(new Set([list]))
  expect(new Set(under), `${at} under line`).toEqual(new Set([list]))
}

test('a narrow two-page spread and its master show no backing beside the paper', async ({
  page,
}) => {
  await openLibraryBook(page, 'A5', { widthMm: 150, heightMm: 210 })
  await addSpreads(page, 2)
  const rows = page.getByTestId(/^spread-list-item-/)
  // Spread 4–5 selected, spread 2–3 at rest.
  await rows.nth(2).click()
  await expect(rows.nth(2)).toHaveAttribute('aria-selected', 'true')
  await page.mouse.move(700, 450)
  await expectNoBacking(page, rows.nth(1), 'spread 2–3')
  await expectNoBacking(page, rows.nth(2), 'selected spread 4–5')

  await page.getByTestId('left-tab-masters').click()
  const master = page
    .getByRole('listbox', { name: 'Masters' })
    .getByRole('option')
    .first()
  await page.mouse.move(700, 450)
  await expectNoBacking(page, master, 'master')
})
