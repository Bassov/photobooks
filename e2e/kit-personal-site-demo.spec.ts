import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// personal-site D38 (K2): the kit #/demo site is the bookcase of the session's published books; Preview is the room.

interface Demo {
  reset: () => void
  go: (stage: string) => void
  state: () => {
    path: string
    open: string | null
    books: { id: string; title: string; published?: boolean }[]
  }
}

const blank = { endp: true, endpSame: true, w: 14.8, h: 21, preset: 'A5' }

/** a session with one published book, a draft and the open, unpublished "Lake trip" in the editor */
async function seed(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate((book) => {
    const d = (window as unknown as { __demo: Demo }).__demo
    d.reset()
    const s = d.state()
    s.path = '~/Pictures/Photobooks'
    s.books = [
      { id: 's1', title: 'Fog', published: true, book } as never,
      { id: 's2', title: 'Draft', published: false, book } as never,
      { id: 's3', title: 'Lake trip', published: false, book } as never,
    ]
    s.open = 's3'
    d.go('editor')
  }, blank)
}

const published = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __demo: Demo }).__demo
      .state()
      .books.filter((b) => b.published)
      .map((b) => b.title),
  )

test.describe('kit #/demo site', () => {
  test('publish → Open site: the case titles are the published titles', async ({
    page,
  }) => {
    await seed(page)
    await page.getByTestId('demo-publish').click()
    await page.getByTestId('publish-go').click()
    await page.getByTestId('publish-open-site').click()
    const books = page.getByTestId('ss9-book')
    await expect(books.first()).toBeVisible()
    const titles = await books.evaluateAll((els) =>
      els.map((e) => (e.getAttribute('aria-label') ?? '').split(',')[0]),
    )
    const want = await published(page)
    expect(want.sort()).toEqual(['Fog', 'Lake trip'])
    expect(titles.sort()).toEqual(want)
  })

  test('nothing published: the open book alone on the case', async ({
    page,
  }) => {
    await seed(page)
    expect(await published(page)).toEqual(['Fog'])
    await page.evaluate(() => {
      const d = (window as unknown as { __demo: Demo }).__demo
      d.state().books.forEach((b) => (b.published = false))
      d.go('site')
    })
    const books = page.getByTestId('ss9-book')
    await expect(books).toHaveCount(1)
    await expect(books).toHaveAttribute('aria-label', /^Lake trip,/)
  })

  test('Preview is the open book in the reading room, resting on the Cover (Owner M53)', async ({
    page,
  }) => {
    await seed(page)
    await page.getByTestId('demo-preview').click()
    const preview = page.getByTestId('site-preview')
    await expect(preview).toBeVisible()
    await expect(preview.getByTestId('ss-reader-page')).toBeVisible()
    const room = preview.getByTestId('site-room')
    await expect(room).toHaveAttribute('data-view', '0')
    // past the fade + cover delay (360 ms): the cover does not turn by itself
    await page.evaluate(() => new Promise((r) => setTimeout(r, 800)))
    await expect(room).toHaveAttribute('data-view', '0')
    await expect(preview.getByTestId('site-about')).toContainText('Lake trip')
    await expect(preview.getByTestId('site-label')).toHaveText('Cover')
    await expect(preview.getByTestId('site-share')).toHaveCount(0)
    await expect(preview.getByTestId('site-all-books')).toHaveCount(0)
  })
})
