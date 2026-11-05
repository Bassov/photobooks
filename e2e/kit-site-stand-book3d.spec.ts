import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'

// site-stand S1 (DEMO branch): demo 6, demo 7 and fresh C show one closed
// Book3D with one pose from book3d.css — rest ry 30 / rx −14, hover 14 / −9.
// Before, demo 6 stood flat (ry −4), demo 7 and the book page showed only the
// fore-edge (ry −12 / −16), fresh C had no tilt (rx 0).

type Slug = 'site-demo-6'

const pose = (book: Locator) =>
  book.evaluate((el) => {
    const cs = getComputedStyle(el)
    return [
      Number(cs.getPropertyValue('--ry')),
      Number(cs.getPropertyValue('--rx')),
    ]
  })

/** the hover host of each demo's first closed book (demo 7's only closed book
   is its preview, covered by its own test; the book page is gone) */
async function host(page: Page, slug: Slug): Promise<Locator> {
  await page.goto(`/uikit/#/full/${slug}`)
  return page.getByTestId('ss6-book').first()
}

/** no finite animation or transition left on the book, its faces or its layers */
const settle = (book: Locator) =>
  expect
    .poll(() =>
      book.evaluate(
        (el) =>
          document.getAnimations().filter((a) => {
            const t = (a.effect as KeyframeEffect | null)?.target
            const finite = a.effect?.getComputedTiming().endTime !== Infinity
            return finite && a.playState === 'running' && t
              ? t.contains(el) || el.contains(t)
              : false
          }).length,
      ),
    )
    .toBe(0)

/**
 * Pixels of a 9×9 grid over the face's box that change when the face is
 * hidden (the head is a slanted sliver: a few px tall on a phone).
 */
async function paints(face: Locator) {
  const b = await face.boundingBox()
  if (b === null) throw new Error('no face box')
  const at = Array.from({ length: 81 }, (_, i) => ({
    x: (((i % 9) + 0.5) * (b.width - 1)) / 9,
    y: ((Math.floor(i / 9) + 0.5) * (b.height - 1)) / 9,
  }))
  const shown = await pixelsAt(face, at)
  await face.evaluate((el) => (el.style.visibility = 'hidden'))
  const hidden = await pixelsAt(face, at)
  await face.evaluate((el) => (el.style.visibility = ''))
  return shown.filter((c, i) => c.join() !== hidden[i]?.join()).length
}

const SLUGS: Slug[] = ['site-demo-6']

test('demo 7 preview rests in the shared pose', async ({ page }) => {
  await page.goto('/uikit/#/full/site-demo-7')
  const book = page.getByTestId('ss7-preview').getByTestId('book3d')
  expect(await pose(book)).toEqual([30, -14])
})

for (const slug of SLUGS) {
  test(`${slug}: rest ry 30 / rx −14, hover ry 14 / rx −9`, async ({
    page,
  }) => {
    const h = await host(page, slug)
    const book = h.getByTestId('book3d')
    await expect(book).toBeVisible()
    expect(await pose(book)).toEqual([30, -14])
    await h.hover()
    await expect.poll(() => pose(book)).toEqual([14, -9])
  })
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`${String(viewport.width)}×${String(viewport.height)}`, () => {
    test.use({ viewport })

    for (const slug of SLUGS) {
      test(`${slug}: the closed book paints its spine and head, no console errors`, async ({
        page,
      }) => {
        const errors: string[] = []
        page.on('console', (m) => {
          if (m.type() === 'error') errors.push(m.text())
        })
        page.on('pageerror', (e) => errors.push(e.message))
        const book = (await host(page, slug)).getByTestId('book3d')
        await expect(book).toBeVisible()
        await settle(book)
        const spine = await paints(book.getByTestId('book3d-spine'))
        const head = await paints(book.getByTestId('book3d-head'))
        test.info().annotations.push({
          type: 'paint',
          description: `spine ${String(spine)}/81, head ${String(head)}/81`,
        })
        expect(spine).toBeGreaterThan(0)
        expect(head).toBeGreaterThan(0)
        expect(errors).toEqual([])
      })
    }
  })
}
