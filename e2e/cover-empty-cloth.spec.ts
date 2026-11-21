import { expect, test, type Locator, type Page } from '@playwright/test'
import { openLibraryBook } from './fixtures/openLibraryBook'
import { pixelsAt } from './fixtures/paintProbe'

// Designer walkthrough-polish P1: a front without a photo is the cloth
// (`cover.style.backFill`, default #3E3C3B) in the library card, the
// spread-list Cover row and the editor front; the title takes the book's
// Title font (serif-italic → "Lora Cover" italic) in D38 ink (#3E3C3B is dark
// → #F5F5F5). P5: library cards on the --shadow-book tokens.

const CLOTH = [62, 60, 59]
const LIGHT_INK = 'rgb(245, 245, 245)'

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('not visible')
  return box
}

/** RGB at the locator's centre, from a clipped screenshot. */
async function centre(box: Locator): Promise<number[]> {
  const size = await boxOf(box)
  const [rgba = []] = await pixelsAt(box, [
    { x: size.width / 2, y: size.height / 2 },
  ])
  return rgba.slice(0, 3)
}

function expectCloth(rgb: number[]): void {
  rgb.forEach((v, k) => {
    expect(Math.abs(v - (CLOTH[k] ?? 0))).toBeLessThanOrEqual(2)
  })
}

async function expectTitleFace(em: Locator): Promise<void> {
  await expect(em).toHaveCSS('font-family', /^"Lora Cover"/)
  await expect(em).toHaveCSS('font-style', 'italic')
  await expect(em).toHaveCSS('color', LIGHT_INK)
}

/** The computed box-shadow a token resolves to, on a probe element. */
function tokenShadow(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.body.appendChild(document.createElement('div'))
    probe.style.boxShadow = `var(${name})`
    const value = getComputedStyle(probe).boxShadow
    probe.remove()
    return value
  }, token)
}

test('empty cover is cloth with the Title font on the library card', async ({
  page,
}) => {
  await openLibraryBook(page)
  await page.evaluate(async () => {
    await window.__photobooksProject?.leaveEditorForLibrary()
  })
  await expect(page.getByTestId('library-screen')).toBeVisible({
    timeout: 15_000,
  })
  await page.mouse.move(1, 1)

  const card = page
    .getByTestId('book-card')
    .filter({ has: page.getByRole('button', { name: /^Open Lake trip/ }) })
  await expect(card).toHaveCount(1)
  const shell = card.getByTestId('book-object-cover-shell')
  await expect(card.getByTestId('book-object-cover')).toHaveCount(0)
  expectCloth(await centre(shell))
  await expectTitleFace(card.getByTestId('book-object-ink').locator('em'))

  const rest = await tokenShadow(page, '--shadow-book')
  expect(rest).not.toBe('none')
  await expect(shell).toHaveCSS('box-shadow', rest)
  await card.locator('.pb-lib-book').hover()
  await expect(shell).toHaveCSS(
    'box-shadow',
    await tokenShadow(page, '--shadow-book-hover'),
  )
})

test('empty cover is cloth in the Cover row and the editor front; the drop box shows on hover / drag-over only', async ({
  page,
}) => {
  await openLibraryBook(page)
  const row = page.getByTestId('cover-list-item').locator('.cover-front')
  expectCloth(await centre(row))

  await page.getByTestId('cover-list-item').click()
  await expect(page.getByTestId('cover-sheet')).toBeVisible()
  await page.mouse.move(1439, 899)
  const front = page.getByTestId('cover-front')
  const drop = page.getByTestId('cover-front-drop')
  await expect(drop).toBeHidden()
  expectCloth(await centre(front))
  await expectTitleFace(page.getByTestId('cover-front-text').locator('em'))

  await front.hover()
  await expect(drop).toBeVisible()
  await expect(drop).toHaveText('Drop a photo for the front')
  const f = await boxOf(front)
  const d = await boxOf(drop)
  expect(d.y - f.y).toBeCloseTo(44, 0)
  expect(d.x - f.x).toBeCloseTo(14, 0)
  expect(f.x + f.width - (d.x + d.width)).toBeCloseTo(14, 0)
  expect(f.y + f.height - (d.y + d.height)).toBeCloseTo(14, 0)
  await expect(drop).toHaveCSS('border-radius', '4px')
  await expect(drop).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.08)')
  await expect(drop).toHaveCSS(
    'box-shadow',
    'rgba(255, 255, 255, 0.35) 0px 0px 0px 1px inset',
  )
  await expect(drop).toHaveCSS('color', 'rgba(245, 245, 245, 0.85)')
  await expect(drop).toHaveCSS('font-size', '11px')
  await expect(drop).toHaveCSS('line-height', '14px')

  await page.mouse.move(1439, 899)
  await expect(drop).toBeHidden()
  const sheet = page.getByTestId('cover-sheet')
  await sheet.dispatchEvent('dragover', {
    clientX: f.x + f.width / 2,
    clientY: f.y + f.height / 2,
    dataTransfer: await page.evaluateHandle(() => {
      const data = new DataTransfer()
      data.setData('application/x-photobooks-asset', 'a1')
      return data
    }),
  })
  await expect(drop).toBeVisible()
  await sheet.dispatchEvent('drop', { clientX: 0 })
  await expect(drop).toBeHidden()
})
