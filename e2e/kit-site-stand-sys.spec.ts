import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'
import { visibleCentres, white } from './fixtures/sitePagePaint'

// site-stand S7 (DEMO branch): demo 6 stands every Book3D on its floor line
// (the contact shadow's centre on the 1 px line, ±1 px; before, thick books
// floated up to ~4 px above it) and reads through the shared room (S6), one
// page at a time on a phone (S5). Demo 7's room is in kit-site-stand-room.

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

/** per book: contact-shadow centre y minus its floor line's centre y */
const seats = (page: Page, scope: string) =>
  page.locator(scope).evaluateAll((els) =>
    els.map((el) => {
      const mid = (n: Element | null) => {
        if (!n) throw new Error('missing')
        const r = n.getBoundingClientRect()
        return r.top + r.height / 2
      }
      const host = el.closest('.ss6-wall, .ss6-screen')
      return (
        mid(el.querySelector('.sd-contact')) -
        mid(host?.querySelector(':scope > .ss6-floor') ?? null)
      )
    }),
  )

async function openRoom(page: Page) {
  await page.goto('/uikit/#/full/site-demo-6')
  await page.getByTestId('ss6-book').first().click()
  await expect(page.getByTestId('ss-open')).toBeFocused()
  await page.getByTestId('ss-open').click()
  await expect(page.getByTestId('ss-reader-page')).toBeVisible()
}

/** RGBA at the centre of the first visible closed book (the host box centre is the cover centre, GL or CSS) */
async function homePaint(page: Page) {
  const books = page.getByTestId('book3d').locator('visible=true')
  await expect(books.first()).toBeVisible()
  const cover = books.first()
  const b = await cover.boundingBox()
  if (!b) throw new Error('no cover box')
  const [c] = await pixelsAt(cover, [{ x: b.width / 2, y: b.height / 2 }])
  return c ?? []
}

for (const [label, viewport, scope] of [
  ['1440×900 wall', { width: 1440, height: 900 }, '.ss6-ex'],
  ['390×844 phone', { width: 390, height: 844 }, '.ss6-screen'],
] as const) {
  test.describe(label, () => {
    test.use({ viewport })

    test('demo 6 (CSS book): every contact shadow is centred on the floor line ±1 px', async ({
      page,
    }) => {
      const errors = collectErrors(page)
      // the CSS book's contact layer; the GL book bakes its shadow into the canvas
      await page.goto('/uikit/#/full/site-demo-6?gl=0')
      await expect(page.getByTestId('ss6-book').first()).toBeVisible()
      const d = await seats(page, scope)
      test.info().annotations.push({
        type: 'seat',
        description: d.map((x) => x.toFixed(2)).join(', '),
      })
      expect(d.length).toBeGreaterThanOrEqual(6)
      for (const x of d) expect(Math.abs(x)).toBeLessThanOrEqual(1)
      await page.screenshot({
        path: test
          .info()
          .outputPath(`demo6-${String(viewport.width)}-home.png`),
      })
      expect(errors).toEqual([])
    })

    for (const [name, slug, row] of [
      ['demo 6: the home', 'site-demo-6', 'ss6-book'],
      // demo 7's phone index lists covers as thumbs: check its book page
      ['demo 7: the book page', 'site-demo-7', 'ss7-book'],
    ] as const) {
      test(`${name}'s closed book paints its cover`, async ({ page }) => {
        const errors = collectErrors(page)
        await page.goto(`/uikit/#/full/${slug}`)
        await page.getByTestId(row).locator('visible=true').first().click()
        const c = await homePaint(page)
        test
          .info()
          .annotations.push({ type: 'paint', description: JSON.stringify(c) })
        expect(white(c)).toBe(false)
        expect(errors).toEqual([])
      })
    }
  })
}

test.describe('phone 390×844: demo 6 reads one page at a time', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })

  test('demo 6: one page ≥ 0.45 × 844; Cover → Page 1 → Page 2; pages paint', async ({
    page,
  }) => {
    const errors = collectErrors(page)
    await openRoom(page)
    await expect(page.getByTestId('ss-reader-page')).toHaveAttribute(
      'data-mode',
      'page',
    )
    const label = page.getByTestId('ss-label')
    const reader = page.getByTestId('ps-pager').getByTestId('ps-reader')
    await expect(label).toHaveText(/^Page 1 of \d+$/)
    const pg = await reader.locator('.sd-pg').nth(1).boundingBox()
    expect(pg?.height ?? 0).toBeGreaterThanOrEqual(0.45 * 844)
    expect(
      Math.abs((pg?.x ?? 0) + (pg?.width ?? 0) / 2 - 195),
    ).toBeLessThanOrEqual(1)

    const seen: string[] = []
    await page.getByTestId('ss-prev').click()
    await expect(label).toHaveText('Cover')
    seen.push((await label.textContent()) ?? '')
    await page.getByTestId('ss-next').click()
    await expect(label).toHaveText(/^Page 1 of \d+$/)
    seen.push((await label.textContent()) ?? '')
    await page.getByTestId('ss-next').click()
    await expect(label).toHaveText(/^Page 2 of \d+$/)
    seen.push((await label.textContent()) ?? '')
    await expect(reader).toHaveAttribute('data-view', '2')

    const centres = await visibleCentres(page.getByTestId('ps-pager'))
    expect(centres.length).toBeGreaterThan(0)
    for (const c of centres) expect(white(c)).toBe(false)
    await page.screenshot({
      path: test.info().outputPath('demo6-390-room.png'),
    })
    test.info().annotations.push({
      type: 'paint',
      description: `page ${String(pg?.width.toFixed(1))}×${String(pg?.height.toFixed(1))}; ${seen.join(' → ')}; centre ${JSON.stringify(centres)}`,
    })
    expect(errors).toEqual([])
  })
})

test.describe('desktop 1440×900: demo 6 reading room', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('demo 6: the room book is 1157 × 723 and its pages paint; Esc returns focus', async ({
    page,
  }) => {
    const errors = collectErrors(page)
    await openRoom(page)
    const reader = page.getByTestId('ps-reader')
    await expect(reader).toHaveAttribute('data-view', '1')
    const r = await reader.boundingBox()
    expect(Math.abs((r?.width ?? 0) - 1157)).toBeLessThanOrEqual(2)
    expect(Math.abs((r?.height ?? 0) - 723)).toBeLessThanOrEqual(2)
    await page.getByTestId('ss-next').click()
    await expect(reader).toHaveAttribute('data-view', '2')
    await expect(page.getByTestId('ps-leaf')).toHaveCount(0)
    const centres = await visibleCentres(reader)
    expect(centres.length).toBeGreaterThan(0)
    for (const c of centres) expect(white(c)).toBe(false)
    await page.screenshot({
      path: test.info().outputPath('demo6-1440-room.png'),
    })
    test.info().annotations.push({
      type: 'paint',
      description: `centre ${JSON.stringify(centres)}`,
    })

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('ss-reader-page')).toHaveCount(0)
    await expect(page.getByTestId('ss-open')).toBeFocused()
    expect(errors).toEqual([])
  })
})
