import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { assertDocumentFitsViewport } from './fixtures/assertDocumentFitsViewport'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'
import { readZoomPercent } from './fixtures/zoomMenu'

// Owner Musts, round 7, relayed by Designer 2026-11-01 (on prod 68639a0).
// Kit values were measured on the rendered kit `uikit#/demo` (v0.10.0, built
// dist) at 1440 × 900 with the demo-capture walk and the DOM reads below
// (getBoundingClientRect / getComputedStyle):
//
// M47 kit `tpl-suggested` (context-inspector.tsx:143): the first three kit
//     catalogue layouts whose slot count equals the photo count; tiles
//     131 × 88.625, thumbs 123 × 61.5. Kit 1-photo lists: p0 (Framed single)
//     [Full bleed, Panorama], p1 (Full bleed) [Panorama, Framed single]. The
//     kit "One per page" (data.ts t-pair) is one frame per page: page-relative
//     10 % insets (p0 after apply: 339.19 × 481.30 at 42.39 / 60.16 in a
//     424 × 601.61 page). The app's page 1 is a single page, where One per
//     page is that one framed photo; the Owner Must keeps it listed in its
//     catalogue place (2nd) even as the current layout, so page 1 reads
//     [Full bleed, One per page, Panorama]. App insets follow the book's
//     layout-grid margins (21.19 px of a 424 px page), not the kit's fixed 10 %.
// M48 step 26 (editor-endpaper-selected): the inspector (left 1140, top 48)
//     opens on `inspector-head` (px-4 pt-4 pb-1 → padding 16 16 4), height
//     57.64; title "Endpaper · front" at 1156 / 64, 268 × 18.84 (13 px / 18.85,
//     weight 500); subline top 84.84, height 16.8; first section top 105.64.
//     Nothing sits above the head.
// M50 kit filmstrip (912 × 88 at 220 / 808): the kit leaves a vertical wheel
//     to the browser (scrollLeft stays 0). The Owner Must replaces that: the
//     wheel scrolls the strip sideways, never the page or the canvas zoom.
// M53 step 34 (editor-preview): Preview opens on the cover (`site-cover`,
//     indicator "Cover · 1 / 20"); Next shows the first spread.
// M54 the kit inspector still draws "Hide inspector (I)"; the Owner Must
//     removes it. The top-bar toggle `inspector-toggle` stays.

const KIT = {
  suggested: {
    labels: ['Full bleed', 'One per page', 'Panorama'],
    tile: { width: 131, height: 88.625 },
    thumb: { width: 123, height: 61.5 },
  },
  endpaper: {
    panelTop: 48,
    head: { height: 57.640625, padding: '16px 16px 4px' },
    title: {
      left: 1156,
      top: 64,
      width: 268,
      height: 18.84375,
      font: '13px',
      lineHeight: '18.85px',
      weight: '500',
    },
    subTop: 84.84375,
    subHeight: 16.796875,
    sectionTop: 105.640625,
  },
} as const

test.use({ viewport: { width: 1440, height: 900 } })

function near(actual: number, expected: number, tolerance: number): void {
  expect(
    Math.abs(actual - expected),
    `${String(actual)} vs ${String(expected)}`,
  ).toBeLessThanOrEqual(tolerance)
}

async function rectOf(locator: Locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return {
      left: r.left,
      top: r.top,
      right: r.right,
      width: r.width,
      height: r.height,
    }
  })
}

test.describe('M47 "One per page" is suggested for 1 photo', () => {
  async function pageFrame(page: Page) {
    const view = page.locator(
      '[data-testid="spread-view"][data-spread-id="spread-1"]',
    )
    const pageBox = await rectOf(view)
    const frame = await rectOf(view.locator('[data-frame-id]').first())
    return {
      page: pageBox,
      x: frame.left - pageBox.left,
      y: frame.top - pageBox.top,
      width: frame.width,
      height: frame.height,
    }
  }

  test('page 1 lists it in kit order and kit tile size; applying it restores the framed page', async ({
    page,
  }) => {
    await openSessionEditor(page)
    await page.locator('[data-testid^="spread-list-item-"]').first().click()
    const suggested = page.getByTestId('tpl-suggested')
    await expect(suggested).toContainText('Suggested for 1 photo')
    const tiles = suggested.getByTestId('layout-suggested-tile')
    await expect(tiles).toHaveCount(KIT.suggested.labels.length)
    expect(
      await tiles.evaluateAll((els) =>
        els.map((el) => el.getAttribute('aria-label')),
      ),
    ).toEqual(
      KIT.suggested.labels.map((label) => `Apply suggested layout ${label}`),
    )
    await expect(tiles.getByTestId('tpl-name')).toHaveText(KIT.suggested.labels)
    // The default page layout stays listed, pressed like its All-grid tile.
    await expect(tiles.nth(1)).toHaveAttribute('aria-pressed', 'true')
    for (let i = 0; i < KIT.suggested.labels.length; i++) {
      const tile = await rectOf(tiles.nth(i))
      near(tile.width, KIT.suggested.tile.width, 0.5)
      near(tile.height, KIT.suggested.tile.height, 0.5)
      const thumb = await rectOf(tiles.nth(i).getByTestId('layout-thumb'))
      near(thumb.width, KIT.suggested.thumb.width, 0.5)
      near(thumb.height, KIT.suggested.thumb.height, 0.5)
    }

    const framed = await pageFrame(page)
    await page
      .getByRole('button', { name: 'Apply layout Full bleed', exact: true })
      .click()
    await expect(tiles.nth(1)).toHaveAttribute('aria-pressed', 'false')
    expect((await pageFrame(page)).x).toBeLessThan(0)

    await page
      .getByRole('button', {
        name: 'Apply suggested layout One per page',
        exact: true,
      })
      .click()
    await expect(tiles.nth(1)).toHaveAttribute('aria-pressed', 'true')
    const applied = await pageFrame(page)
    // One frame inset by the page margins on every side.
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      near(applied[key], framed[key], 0.5)
    }
    expect(applied.x).toBeGreaterThan(0)
    near(applied.y, applied.x, 0.5)
    near(applied.x + applied.width + applied.x, applied.page.width, 0.5)
    near(applied.y + applied.height + applied.y, applied.page.height, 0.5)
  })
})

test.describe('M48 the Endpaper inspector opens on its own head', () => {
  test('title, padding and head height equal the kit; nothing above', async ({
    page,
  }) => {
    await openSessionEditor(page)
    await page.getByTestId('endpaper-list-item-front').click()
    const panel = page.getByTestId('inspector-panel')
    await expect(panel).toHaveAttribute('data-inspector-view', 'endpaper')
    const head = panel.getByTestId('inspector-head')
    const title = head.getByTestId('inspector-context')
    await expect(title).toHaveText('Endpaper · front')

    const panelBox = await rectOf(panel)
    expect(panelBox.top).toBe(KIT.endpaper.panelTop)
    const headBox = await rectOf(head)
    expect(headBox.top).toBe(panelBox.top)
    near(headBox.height, KIT.endpaper.head.height, 0.5)
    await expect(head).toHaveCSS('padding', KIT.endpaper.head.padding)
    const titleBox = await rectOf(title)
    near(titleBox.left, KIT.endpaper.title.left, 0.5)
    near(titleBox.top, KIT.endpaper.title.top, 0.5)
    near(titleBox.width, KIT.endpaper.title.width, 0.5)
    near(titleBox.height, KIT.endpaper.title.height, 0.5)
    await expect(title).toHaveCSS('font-size', KIT.endpaper.title.font)
    await expect(title).toHaveCSS('line-height', KIT.endpaper.title.lineHeight)
    await expect(title).toHaveCSS('font-weight', KIT.endpaper.title.weight)
    const sub = await rectOf(head.locator('p'))
    near(sub.top, KIT.endpaper.subTop, 0.5)
    near(sub.height, KIT.endpaper.subHeight, 0.5)
    const fill = await rectOf(
      page.getByTestId('insp-endpaper').locator(':scope > div').nth(1),
    )
    near(fill.top, KIT.endpaper.sectionTop, 0.5)

    // No empty block (header bar, collapse icon) above the title.
    await expect(panel.getByTestId('inspector-header')).toHaveCount(0)
    const above = await panel.evaluate((el, top) => {
      return [...el.querySelectorAll('*')].filter((child) => {
        const r = child.getBoundingClientRect()
        return r.height > 0 && r.bottom <= top
      }).length
    }, titleBox.top)
    expect(above).toBe(0)
  })
})

test.describe('M50 the mouse wheel over the filmstrip scrolls it sideways', () => {
  test.beforeAll(() => {
    ensurePhotoFixtures({ includeLargeJpeg: false })
  })

  test('wheel(0, 300) moves scrollLeft; zoom and window scroll stay', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await installPhotoDirectoryPickerStub(page)
    await openSessionEditor(page)
    await choosePhotoFolder(
      page,
      Array.from({ length: 24 }, () => photoFixturePaths.samplePng),
    )
    await expect
      .poll(
        async () =>
          page.getByTestId('filmstrip').getAttribute('data-gallery-count'),
        { timeout: 90_000 },
      )
      .toBe('24')
    const scroll = page.getByTestId('filmstrip-scroll')
    await expect
      .poll(() => scroll.evaluate((el) => el.scrollWidth - el.clientWidth))
      .toBeGreaterThan(300)
    expect(await scroll.evaluate((el) => el.scrollLeft)).toBe(0)

    const zoom = await readZoomPercent(page)
    const port = page.getByTestId('pasteboard-scroll')
    const portScroll = () =>
      port.evaluate((el) => [el.scrollLeft, el.scrollTop])
    const before = await portScroll()
    const windowScroll = () =>
      page.evaluate(() => [
        window.scrollX,
        window.scrollY,
        document.scrollingElement?.scrollTop ?? 0,
      ])

    const box = await rectOf(scroll)
    await page.mouse.move(box.left + box.width / 2, box.top + box.height / 2)
    await page.mouse.wheel(0, 300)
    await expect.poll(() => scroll.evaluate((el) => el.scrollLeft)).toBe(300)
    await page.mouse.wheel(0, -120)
    await expect.poll(() => scroll.evaluate((el) => el.scrollLeft)).toBe(180)

    expect(await readZoomPercent(page)).toBe(zoom)
    expect(await portScroll()).toEqual(before)
    expect(await windowScroll()).toEqual([0, 0, 0])
    await assertDocumentFitsViewport(page)
  })
})

test.describe('M53 the preview starts from the cover', () => {
  async function openPreview(page: Page): Promise<Locator> {
    await openSessionEditor(page)
    // A selected later spread must not change where the show starts.
    await page.locator('[data-testid^="spread-list-item-"]').nth(1).click()
    await page.getByTestId('present').click()
    const stage = page.getByTestId('presentation')
    await expect(stage).toBeVisible()
    return stage
  }

  const activeSlide = (stage: Locator) =>
    stage.locator('[data-testid="presentation-slide"][data-active="true"]')

  test('the first item is the cover; next goes to page 1', async ({ page }) => {
    const stage = await openPreview(page)
    await expect(page.getByTestId('pager-position')).toHaveText('Cover')
    const first = activeSlide(stage)
    await expect(first.getByTestId('presentation-cover')).toBeVisible()
    await expect(first.locator('.cover-spread')).toHaveCount(1)
    await expect(first.getByTestId('spread-view')).toHaveCount(0)

    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('pager-position')).toHaveText('1 / 3')
    const next = activeSlide(stage)
    await expect(next.getByTestId('presentation-cover')).toHaveCount(0)
    await expect(next.getByTestId('spread-view')).toHaveAttribute(
      'data-spread-id',
      'spread-1',
    )

    await page.keyboard.press('ArrowLeft')
    await expect(page.getByTestId('pager-position')).toHaveText('Cover')
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByTestId('pager-position')).toHaveText('Cover')
  })
})

test.describe('M54 the inspector has no hide button of its own', () => {
  async function groupCentre(page: Page): Promise<number> {
    return page
      .getByRole('toolbar', { name: 'Editor' })
      .locator(':scope > *')
      .evaluateAll((els) => {
        const boxes = els
          .map((el) => el.getBoundingClientRect())
          .filter((b) => b.width > 0 && b.height > 0)
        const left = Math.min(...boxes.map((b) => b.left))
        const right = Math.max(...boxes.map((b) => b.right))
        return (left + right) / 2
      })
  }

  test('no hide button in any context; the top-bar toggle hides and shows it', async ({
    page,
  }) => {
    await openSessionEditor(page)
    const panel = page.getByTestId('panel-r')
    await expect(panel).toHaveAttribute('data-open', 'true')
    const hideInPanel = panel.getByRole('button', { name: /Hide inspector/ })
    // Spread, Cover, Endpaper and Book contexts.
    await expect(page.getByTestId('inspector-context')).toHaveText('Spread')
    await expect(hideInPanel).toHaveCount(0)
    await expect(page.getByTestId('panel-collapse-right')).toHaveCount(0)
    for (const [item, view] of [
      ['cover-list-item', 'cover'],
      ['endpaper-list-item-front', 'endpaper'],
    ] as const) {
      await page.getByTestId(item).click()
      await expect(page.getByTestId('inspector-panel')).toHaveAttribute(
        'data-inspector-view',
        view,
      )
      await expect(hideInPanel).toHaveCount(0)
    }

    const left = await rectOf(page.getByTestId('panel-l'))
    const open = await rectOf(panel)
    const centre = await groupCentre(page)
    near(centre, (left.right + open.left) / 2, 1)

    const toggle = page.getByTestId('toggle-r')
    await expect(toggle).toHaveAccessibleName(/Hide inspector/)
    await toggle.click()
    await expect(panel).toHaveAttribute('data-open', 'false')
    await expect.poll(async () => (await rectOf(panel)).width).toBe(0)
    await expect(toggle).toHaveAccessibleName(/Show inspector/)

    await toggle.click()
    await expect(panel).toHaveAttribute('data-open', 'true')
    await expect.poll(async () => (await rectOf(panel)).width).toBe(300)
    // M39: the tool group is centred on the canvas area again.
    near(await groupCentre(page), (left.right + open.left) / 2, 1)
    near(await groupCentre(page), centre, 0.5)
  })
})
