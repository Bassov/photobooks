import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { clearProjectSession } from './fixtures/clearProjectSession'
import { createBookViaLibrary } from './fixtures/createBookViaLibrary'

// Design review r3: the rendered kit v0.10.0 `#/demo` (steps 13, 24) is the
// reference; source uikit/src/sandbox/v7.tsx:65-70,199-216.
const INK = 'rgb(232, 230, 227)'

test.beforeEach(async ({ page }) => {
  await page.goto('/?testLibrary=1')
  await expect(page.getByTestId('book-size')).toContainText(/· saved$/, {
    timeout: 15_000,
  })
  await createBookViaLibrary(page, 'Lake trip')
  if (
    (await page.getByTestId('panel-r').getAttribute('data-open')) !== 'true'
  ) {
    await page.getByTestId('toggle-r').click()
  }
})

test.afterEach(async ({ page }) => {
  await clearProjectSession(page)
})

const rect = (page: Page, id: string) =>
  page
    .getByTestId(id)
    .evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect)

test('M5: a new book shows its title as back text, bottom-left on the back cover', async ({
  page,
}) => {
  await page.getByTestId('cover-list-item').click()
  const field = page.getByTestId('cover-text-back')
  const text = page.getByTestId('cover-back-text')
  await expect(field).toHaveValue('Lake trip')
  await expect(text).toHaveText('Lake trip')
  await expect(text).toHaveCSS('color', INK)
  const [back, label] = await Promise.all([
    rect(page, 'cover-back'),
    rect(page, 'cover-back-text'),
  ])
  // Kit: left 12 %, bottom 10 % of the back panel.
  expect(label.x - back.x).toBeCloseTo(back.width * 0.12, 0)
  expect(back.bottom - label.bottom).toBeCloseTo(back.height * 0.1, 0)

  await field.fill('See you next summer')
  await expect(text).toHaveText('See you next summer')

  // Kit v7.tsx:202: Book settings names the book by its back text.
  await page.getByTestId('book-title').click()
  await expect(page.getByTestId('book-settings-subtitle')).toHaveText(
    'See you next summer · applies to the whole book',
  )
})

const spreadCount = (page: Page) =>
  page.getByTestId('pasteboard-scroll').getAttribute('data-spread-count')

async function typePages(page: Page, value: string): Promise<void> {
  const field = page.getByTestId('book-pages-input')
  await field.fill(value)
  await field.press('Enter')
}

async function trimWidthMm(page: Page): Promise<number> {
  await page.getByTestId('book-title').click()
  return Number(await page.getByTestId('size-w').inputValue()) * 10
}

/** Inspector text and canvas spine / back ratio both follow `mm`. */
async function expectSpine(page: Page, mm: number, trimMm: number) {
  await page.getByTestId('cover-list-item').click()
  await expect(page.getByTestId('cover-spine-width')).toHaveText(
    `${String(mm)} mm`,
  )
  await expect
    .poll(async () => {
      const [back, spine] = await Promise.all([
        rect(page, 'cover-back'),
        rect(page, 'cover-spine'),
      ])
      return spine.width / back.width
    })
    .toBeCloseTo(mm / trimMm, 2)
}

test('Spine width: read-only mm text computed from the page count, drawn on the canvas', async ({
  page,
}) => {
  const trimMm = await trimWidthMm(page)
  expect(trimMm).toBeGreaterThan(0)

  await page.getByTestId('cover-list-item').click()
  const spineWidth = page.getByTestId('cover-spine-width')
  await expect(spineWidth).toHaveCSS('font-family', /mono/i)
  await expect(spineWidth.locator('input')).toHaveCount(0)
  await expect(page.getByTestId('insp-cover').getByRole('slider')).toHaveCount(
    0,
  )
  // 6 pages print padded to the 20-page minimum: 8 + 20 × 0.2 = 12 mm (kit).
  await expectSpine(page, 12, trimMm)

  await page.getByTestId('book-title').click()
  await typePages(page, '40')
  await expectSpine(page, 16, trimMm)

  await page.getByTestId('book-title').click()
  await typePages(page, '120')
  await expectSpine(page, 32, trimMm)
})

test('Pages: kit number box without arrows, 20–120 hint and spreads note', async ({
  page,
}) => {
  await page.getByTestId('book-title').click()
  const field = page.getByTestId('book-pages-input')
  const note = page.getByTestId('book-pages-note')
  await expect(field).toHaveValue('6')
  await expect(field).toHaveAttribute('step', '2')
  await expect(page.getByTestId('book-pages-range')).toHaveText('20–120')
  await expect(note).toHaveText('Add 7 spreads to reach the 20-page minimum')
  // Rendered #/demo step 24 `Val` box: FIELD fill, 6 px radius, 4 / 8 px pad.
  await expect(field).toHaveCSS('background-color', 'rgb(215, 215, 215)')
  await expect(field).toHaveCSS('border-radius', '6px')
  await expect(field).toHaveCSS('padding', '4px 8px')
  await expect(field).toHaveCSS('appearance', 'textfield')
  const box = await rect(page, 'book-pages-input')
  expect(box.height).toBeGreaterThan(25)
  expect(box.height).toBeLessThan(29)
  expect(box.width).toBeLessThan(40)

  await typePages(page, '20')
  await expect(field).toHaveValue('20')
  expect(await spreadCount(page)).toBe('10')
  await expect(note).toHaveText('Pages are added in spreads of 2')
})

test('Pages: typed values clamp to 20–120, round to step 2 and edit the spreads', async ({
  page,
}) => {
  await page.getByTestId('book-title').click()
  const field = page.getByTestId('book-pages-input')

  await typePages(page, '10')
  await expect(field).toHaveValue('20')
  await expect.poll(() => spreadCount(page)).toBe('10')

  await typePages(page, '200')
  await expect(field).toHaveValue('120')
  await expect.poll(() => spreadCount(page)).toBe('60')

  await typePages(page, '33')
  await expect(field).toHaveValue('34')
  await expect.poll(() => spreadCount(page)).toBe('17')

  // Blur commits too; the arrow key steps by 2 natively.
  await field.press('ArrowDown')
  await field.blur()
  await expect(field).toHaveValue('32')
  await expect.poll(() => spreadCount(page)).toBe('16')

  // One undo step per commit.
  await expect(page.getByTestId('undo')).toHaveAttribute(
    'aria-label',
    /Page count/,
  )
  await page.getByTestId('undo').click()
  await expect(field).toHaveValue('34')
  await expect.poll(() => spreadCount(page)).toBe('17')
})

test('Pages: the typed count persists across reload', async ({ page }) => {
  test.setTimeout(60_000)
  await page.getByTestId('book-title').click()
  await typePages(page, '24')
  await expect.poll(() => spreadCount(page)).toBe('12')
  await expect(page.getByTestId('editor-status')).toHaveText('Book saved', {
    timeout: 15_000,
  })

  await page.reload()
  await expect(page.getByTestId('editor-status')).toHaveText('Book restored', {
    timeout: 20_000,
  })
  await expect.poll(() => spreadCount(page)).toBe('12')
  await page.getByTestId('book-title').click()
  await expect(page.getByTestId('book-pages-input')).toHaveValue('24')
  await page.getByTestId('cover-list-item').click()
  await expect(page.getByTestId('cover-spine-width')).toHaveText('12.8 mm')
})
