import type { Locator, Page } from '@playwright/test'
import { existsSync } from 'node:fs'
import { expect, test } from './fixtures/coverage'
import { clearProjectSession } from './fixtures/clearProjectSession'
import { dragPlaceFirstFilmstripItem } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { openLibraryBook } from './fixtures/openLibraryBook'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'

// Owner Musts M59–M61, round 10, relayed by the Designer (review r9 of prod,
// 2026-11-01). Kit values measured on the rendered kit `uikit#/demo` (v0.10.0)
// at 1440 × 900 with getBoundingClientRect / getComputedStyle, replaying the
// demo-capture steps; y is page y (the inspector panel top is y 48).
//
// M59 editor-cover-photo-and-title, insp-cover: head title y 64.00
//     (13px / 500 / rgb(57, 55, 56)), subline 84.84, FRONT 121.64, front text
//     block 148.48, Front title field 231.86, Title font row 275.86 (a 26.84
//     `Val`), SPINE 334.70, Spine text 361.55, Spine width row 405.55,
//     Direction row 436.39, BACK 495.23, Back text 522.08, Fill row 566.08,
//     MATERIAL 624.92, Cover row 651.77, Finish row 690.61.
//     Prod keeps the native 36 px Title font / Cover / Finish selects (open
//     Owner question), so everything below Title font sits SELECT_RESIDUAL
//     (36 − 26.84 = 9.16) lower, and Finish twice that.
// M59 editor-inspector-book, insp-book: head 64.00 / subline 84.84, PAGE SIZE
//     121.64, Page size select 148.48 (32 px), Portrait 194.48, cm 236.48 (26
//     px segments), W / H fields 276.48, size hint 314.48, BINDING 378.48,
//     Style row 405.33, Endpapers row 444.17, Pages row 475.02, pages note
//     507.86, PRINT 554.70, B / S fields 581.55, Paper row 625.55, DEFAULTS
//     684.39, Default master row 711.23, Page colour row 750.08.
// M60 editor-frame-selected: section titles at x 1172 (chevron first), PHOTO
//     105.75, FIT & CROP 272.39, ROTATE & FLIP 495.19, then closed ADJUST
//     698.78, CAPTION 735.78, POSITION & SIZE 772.78, FRAME STYLE 809.78,
//     ARRANGE 846.78 (37 px pitch). File name x 1240 y 134.00, Remove from
//     frame 201.64, Fill 302.64, Zoom label 340.64, Crop 424.44, 90° left
//     523.44, Flip H 563.44, Straighten label 607.44, Quarter turn note 643.23
//     (12px / 400 / rgb(83, 81, 82)).
// M61 segmented labels, both states: Book Portrait / Landscape and cm / mm
//     (editor-inspector-book) 13px / 500; layout picker All / My templates
//     (editor-new-blank-book) 13px / 500; Create dialog Portrait / Landscape
//     (create-book-dialog) 13px / 500; Photo Fill / Fit (editor-frame-selected)
//     12px / 500.

const INK = 'rgb(57, 55, 56)'
const MUTED = 'rgb(83, 81, 82)'
const SELECT_RESIDUAL = 36 - 26.84

const KIT = {
  head: { title: 64, sub: 84.84 },
  cover: {
    front: 121.64,
    frontText: 148.48,
    frontTitle: 231.86,
    titleFontRow: 275.86,
    spine: 334.7,
    spineText: 361.55,
    spineWidthRow: 405.55,
    directionRow: 436.39,
    back: 495.23,
    backText: 522.08,
    fillRow: 566.08,
    material: 624.92,
    coverRow: 651.77,
    finishRow: 690.61,
  },
  book: {
    pageSize: 121.64,
    select: 148.48,
    portrait: 194.48,
    cm: 236.48,
    sizeFields: 276.48,
    hint: 314.48,
    binding: 378.48,
    rows: [405.33, 444.17, 475.02],
    pagesNote: 507.86,
    print: 554.7,
    printFields: 581.55,
    paperRow: 625.55,
    defaults: 684.39,
    defaultRows: [711.23, 750.08],
  },
  photo: {
    titleX: 1172,
    titles: [105.75, 272.39, 495.19, 698.78, 735.78, 772.78, 809.78, 846.78],
    nameX: 1240,
    name: 134,
    remove: 201.64,
    fill: 302.64,
    zoom: 340.64,
    crop: 424.44,
    rotLeft: 523.44,
    flipH: 563.44,
    straighten: 607.44,
    quarterTurn: 643.23,
  },
} as const

async function box(locator: Locator) {
  const b = await locator.boundingBox()
  if (b === null) throw new Error('not visible')
  return b
}

async function near(locator: Locator, kit: number, axis: 'x' | 'y' = 'y') {
  const actual = (await box(locator))[axis]
  expect(
    Math.abs(actual - kit),
    `${axis} ${String(actual)} vs kit ${String(kit)}`,
  ).toBeLessThanOrEqual(0.5)
}

async function type(locator: Locator) {
  return locator.evaluate((el) => {
    const s = getComputedStyle(el)
    return { size: s.fontSize, weight: s.fontWeight, color: s.color }
  })
}

async function expectSegmentType(
  group: Locator,
  labels: readonly string[],
  size: string,
) {
  for (const label of labels) {
    const segment = group.locator('label', { hasText: label })
    const read = await type(segment)
    expect({ size: read.size, weight: read.weight }, label).toEqual({
      size,
      weight: '500',
    })
  }
}

async function selectFilledFrame(page: Page) {
  await choosePhotoFolder(page, [photoFixturePaths.samplePng])
  await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
    timeout: 30_000,
  })
  await dragPlaceFirstFilmstripItem(page, 0)
  await page.getByTestId('spread-frame').first().click()
  await expect(page.getByTestId('inspector-context')).toHaveText('Photo')
  await page.mouse.move(0, 899)
}

test.describe('M59–M61: Cover, Book and Photo inspectors match the kit', () => {
  test.beforeAll(() => {
    if (!existsSync(photoFixturePaths.samplePng)) {
      ensurePhotoFixtures({ includeLargeJpeg: false })
    }
  })

  test.beforeEach(async ({ page }) => {
    await installPhotoDirectoryPickerStub(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openLibraryBook(page)
  })

  test('M59: the Cover inspector is as tight as the kit', async ({ page }) => {
    await page.getByTestId('cover-list-item').click()
    const panel = page.getByTestId('insp-cover')
    await expect(panel).toBeVisible()
    const title = page.getByTestId('inspector-context')
    await near(title, KIT.head.title)
    expect(await type(title)).toEqual({
      size: '13px',
      weight: '500',
      color: INK,
    })
    await near(panel.locator('.inspector-head-sub'), KIT.head.sub)

    const titles = panel.locator('h3')
    await expect(titles).toHaveText(['Front', 'Spine', 'Back', 'Material'])
    const rows = panel.locator('.inspector-row')
    const c = KIT.cover
    await near(titles.nth(0), c.front)
    await near(panel.locator('.cover-front-info'), c.frontText)
    await near(page.getByTestId('cover-text-front'), c.frontTitle)
    await near(rows.nth(0), c.titleFontRow)
    // The Title font select row itself is the only residual (open Owner
    // question): 36 px against the kit 26.84 px `Val` row.
    expect(Math.abs((await box(rows.nth(0))).height - 36)).toBeLessThan(0.01)
    const below = (kit: number) => kit + SELECT_RESIDUAL
    await near(titles.nth(1), below(c.spine))
    await near(page.getByTestId('cover-text-spine'), below(c.spineText))
    await near(rows.nth(1), below(c.spineWidthRow))
    await near(rows.nth(2), below(c.directionRow))
    await near(titles.nth(2), below(c.back))
    await near(page.getByTestId('cover-text-back'), below(c.backText))
    await near(rows.nth(3), below(c.fillRow))
    await near(titles.nth(3), below(c.material))
    await near(rows.nth(4), below(c.coverRow))
    await near(rows.nth(5), c.finishRow + 2 * SELECT_RESIDUAL)
  })

  test('M59: the Book settings inspector is as tight as the kit', async ({
    page,
  }) => {
    await page.getByTestId('book-title').click()
    const panel = page.getByTestId('book-settings')
    await expect(panel).toBeVisible()
    const title = page.getByTestId('inspector-context')
    await near(title, KIT.head.title)
    expect(await type(title)).toEqual({
      size: '13px',
      weight: '500',
      color: INK,
    })
    await near(page.getByTestId('book-settings-subtitle'), KIT.head.sub)

    const b = KIT.book
    const titles = panel.locator('h3')
    await expect(titles).toHaveText([
      'Page size',
      'Binding',
      'Print',
      'Defaults',
    ])
    await near(titles.nth(0), b.pageSize)
    await near(page.getByTestId('size-preset'), b.select)
    await near(panel.locator('label', { hasText: 'Portrait' }), b.portrait)
    await near(panel.locator('label', { hasText: /^cm$/ }), b.cm)
    await near(panel.locator('.insp-size-field').first(), b.sizeFields)
    await near(panel.getByText(/^Size of one page/), b.hint)
    await near(titles.nth(1), b.binding)
    const rows = panel.locator('.inspector-row')
    for (const [at, kit] of b.rows.entries()) {
      await near(rows.nth(at), kit)
    }
    await near(page.getByTestId('book-pages-note'), b.pagesNote)
    await near(titles.nth(2), b.print)
    await near(page.getByTestId('book-bleed'), b.printFields)
    await near(rows.nth(3), b.paperRow)
    await near(titles.nth(3), b.defaults)
    await near(rows.nth(4), b.defaultRows[0])
    await near(rows.nth(5), b.defaultRows[1])
  })

  test('M60: the Photo inspector opens on collapsible kit sections', async ({
    page,
  }) => {
    await selectFilledFrame(page)
    const body = page.getByTestId('inspector-body')
    const titles = body.locator('.pb-disclosure__trigger .inspector-eyebrow')
    await expect(titles).toHaveText([
      'Photo',
      'Fit & crop',
      'Rotate & flip',
      'Adjust',
      'Caption',
      'Position & size',
      'Frame style',
      'Arrange',
    ])
    const p = KIT.photo
    for (const [at, kit] of p.titles.entries()) {
      await near(titles.nth(at), kit)
      await near(titles.nth(at), p.titleX, 'x')
    }
    // ▾ on the three open sections, › on the closed ones.
    const triggers = body.locator('.pb-disclosure__trigger')
    await expect(triggers).toHaveCount(8)
    for (let at = 0; at < 8; at += 1) {
      await expect(triggers.nth(at)).toHaveAttribute(
        'aria-expanded',
        at < 3 ? 'true' : 'false',
      )
      await expect(
        triggers.nth(at).locator('.pb-disclosure__chevron'),
      ).toHaveCSS('transform', at < 3 ? 'matrix(0, 1, -1, 0, 0, 0)' : 'none')
    }

    await near(page.getByTestId('inspector-photo').locator('.truncate'), p.name)
    await near(
      page.getByTestId('inspector-photo').locator('.truncate'),
      p.nameX,
      'x',
    )
    await near(page.getByTestId('photo-remove'), p.remove)
    await near(
      page.getByTestId('inspector-fit-crop').locator('label').first(),
      p.fill,
    )
    await near(page.getByTestId('crop-zoom').locator('.fit-crop-label'), p.zoom)
    await near(page.getByTestId('crop-toggle'), p.crop)
    await near(page.getByTestId('rot-left'), p.rotLeft)
    await near(page.getByTestId('flip-h'), p.flipH)
    await near(
      page.getByTestId('photo-straighten').locator('.fit-crop-label'),
      p.straighten,
    )
    const note = page.getByTestId('rotate-summary')
    await near(note, p.quarterTurn)
    expect(await type(note)).toEqual({
      size: '12px',
      weight: '400',
      color: MUTED,
    })
  })

  test('M60: PHOTO collapses to a 37 px row and reopens', async ({ page }) => {
    await selectFilledFrame(page)
    const photo = page.getByTestId('inspector-photo-disclosure')
    const fitTitle = page
      .getByTestId('inspector-fit-crop-disclosure')
      .locator('.inspector-eyebrow')
    await photo.getByRole('button', { name: 'Photo' }).click()
    await expect(page.getByTestId('inspector-photo')).toBeHidden()
    await near(fitTitle, KIT.photo.titles[0] + 37)
    await photo.getByRole('button', { name: 'Photo' }).click()
    await expect(page.getByTestId('photo-remove')).toBeVisible()
    await near(fitTitle, KIT.photo.titles[1])
  })

  test('M60: Fit & crop and Rotate & flip titles keep crop mode', async ({
    page,
  }) => {
    await selectFilledFrame(page)
    await page.getByTestId('crop-toggle').click()
    await expect(page.getByTestId('crop-toggle')).toHaveText('Done')
    for (const name of ['Rotate & flip', 'Fit & crop']) {
      const header = page.getByRole('button', { name, exact: true })
      await header.click()
      await expect(header).toHaveAttribute('aria-expanded', 'false')
      await header.click()
      await expect(header).toHaveAttribute('aria-expanded', 'true')
    }
    await expect(page.getByTestId('crop-toggle')).toHaveText('Done')
  })

  test('M60: an empty frame keeps the PHOTO section with its hint', async ({
    page,
  }) => {
    await page.getByTestId('spread-frame').first().click()
    await expect(page.getByTestId('inspector-context')).toHaveText('Photo')
    const photo = page.getByTestId('inspector-photo-disclosure')
    await expect(photo.getByRole('button', { name: 'Photo' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await expect(page.getByTestId('inspector-photo-empty')).toHaveText(
      'Empty — drag a photo',
    )
  })

  test('M61: Book and Photo segmented labels are medium in both states', async ({
    page,
  }) => {
    await page.getByTestId('book-title').click()
    await expectSegmentType(
      page.getByTestId('size-orientation'),
      ['Portrait', 'Landscape'],
      '13px',
    )
    await expectSegmentType(page.getByTestId('size-unit'), ['cm', 'mm'], '13px')
    await page.getByTestId('size-orientation').getByText('Landscape').click()
    await expectSegmentType(
      page.getByTestId('size-orientation'),
      ['Portrait', 'Landscape'],
      '13px',
    )

    await selectFilledFrame(page)
    const fit = page.getByRole('radiogroup', { name: 'Photo fit' })
    await expectSegmentType(fit, ['Fill', 'Fit'], '12px')
  })
})

test.describe('M61: layout tabs and Create dialog segments', () => {
  test.afterEach(async ({ page }) => {
    await clearProjectSession(page)
  })

  test('layout picker All / My templates are 13 px medium', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openSessionEditor(page)
    await expect(page.getByTestId('layout-section')).toBeVisible()
    for (const id of ['tab-all', 'tab-mine']) {
      const read = await type(page.getByTestId(id))
      expect({ size: read.size, weight: read.weight }, id).toEqual({
        size: '13px',
        weight: '500',
      })
    }
    await page.getByTestId('tab-mine').click()
    const mine = await type(page.getByTestId('tab-mine'))
    expect([mine.size, mine.weight]).toEqual(['13px', '500'])
  })

  test('Create dialog Portrait / Landscape are 13 px medium', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.getByTestId('welcome-screen')).toBeVisible({
      timeout: 15_000,
    })
    await page.evaluate(async () => {
      const api = window.__photobooksProject
      if (!api) throw new Error('missing api')
      const attached = await api.attachMemoryLibraryForTests()
      if (!attached.ok) throw new Error(attached.code ?? 'attach')
      const created = await api.createBookInLibrary()
      if (!created.ok) throw new Error(created.code ?? 'create')
      await api.leaveEditorForLibrary()
    })
    await page.getByTestId('new-book').click()
    const group = page.getByTestId('create-orientation')
    await expect(group).toBeVisible()
    await expectSegmentType(group, ['Portrait', 'Landscape'], '13px')
  })
})
