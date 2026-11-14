import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit #/demo sandbox (moved from uikit/scripts/qa.mjs v8 / v8.1 / Stage 3,
// uikit-qa-split-4): the end-to-end walk welcome → library → editor → publish →
// site → print → library → settings with a dead-button sweep, the v8.1 per-book
// state walk (cover, masters, size, print, site, share, fullscreen, library
// menu), and the feature pages' panel slots. Like the qa.mjs walks, a console
// error / warning, page error or failed request fails the walk.

test.use({ viewport: { width: 1440, height: 900 } })

const demo = '[data-testid="demo"]'

interface DemoBook {
  id: string
  title: string
  book: { w: number; h: number }
  doc?: { spreads: unknown[] }
}
interface DemoApi {
  reset: () => void
  state: () => { path: string; books: DemoBook[]; open: string }
  go: (stage: string) => void
}

function watchErrors(page: Page) {
  const errs: string[] = []
  page.on('console', (m) => {
    // Playwright's Chromium GPU driver notes a ReadPixels stall on the site's WebGL reader (qa.mjs's Chrome does not); not a page message
    if (
      m.type() === 'warning' &&
      /^\[\.WebGL-\w+\]GL Driver Message \(OpenGL, Performance,/.test(m.text())
    )
      return
    if (m.type() === 'error' || m.type() === 'warning')
      errs.push(`${m.type()}: ${m.text().slice(0, 240)}`)
  })
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`))
  page.on('requestfailed', (r) => errs.push(`requestfailed: ${r.url()}`))
  return errs
}

/** two frames painted and no finite animation still running */
async function settled(page: Page) {
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  )
  await expect
    .poll(() =>
      page.evaluate(() =>
        document
          .getAnimations()
          .every(
            (a) =>
              a.playState !== 'running' ||
              a.effect?.getComputedTiming().iterations === Infinity,
          ),
      ),
    )
    .toBe(true)
}

const stage = (page: Page) =>
  page.evaluate(
    () =>
      document.querySelector<HTMLElement>('[data-testid="demo"]')?.dataset
        .demoStage,
  )
async function atStage(page: Page, s: string) {
  await expect.poll(() => stage(page)).toBe(s)
  await settled(page)
}
const dlgBtn = (page: Page, re: RegExp) =>
  page.locator('[role=dialog]').getByRole('button', { name: re }).last()

test('v8 §5 #/demo: end-to-end walk welcome→library→editor→publish→site→print→library→settings, linked from the index; no dead buttons', async ({
  page,
}) => {
  const errs = watchErrors(page)
  await page.goto('/uikit/#/')
  await page.click('[data-testid="demo-link"]')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: DemoApi }).__demo.reset()
  })
  await atStage(page, 'welcome')
  await page
    .getByRole('button', { name: /Create library/i })
    .first()
    .click()
  await dlgBtn(page, /Choose|Select|Use/i).click()
  await atStage(page, 'library')
  await page
    .getByRole('button', { name: /Create book/ })
    .first()
    .click()
  await page.locator('[role=dialog] input').first().fill('QA walk')
  await page.click('[data-testid="create-book"]')
  await atStage(page, 'editor')
  await page.click('[data-testid="demo-add-folder"]')
  await dlgBtn(page, /Choose|Select|Use|Add/i).click()
  await expect(page.getByTestId('placed-count')).toHaveText(
    /\b20\b|\d+ · \d+ used/,
  )
  await page.click('[data-testid="demo-publish"]')
  await page.click('[data-testid="publish-go"]')
  await expect(page.getByTestId('publish-link')).toHaveText(/\S/)
  await page.click('[data-testid="publish-open-site"]')
  await atStage(page, 'site')
  await page.click('[data-testid="demo-site-back"]')
  await atStage(page, 'editor')
  await page.click('[data-testid="demo-print"]')
  await page.click('[data-testid="print-go"]')
  await expect(page.getByTestId('print-done')).toHaveCount(1)
  await page.click('[data-testid="print-close"]')
  await expect(page.getByTestId('print-done')).toHaveCount(0)
  await page.click('[data-testid="editor-library"]')
  await atStage(page, 'library')
  await page.click('[data-testid="home-settings"]')
  await atStage(page, 'settings')
  await page.click('[data-testid="demo-settings-back"]')
  await atStage(page, 'library')

  expect(errs).toEqual([])
})

// dead-button sweep: every enabled control on each stage must change the DOM or the route
// (one test per stage: the sweep re-seeds the stage before each click and outgrows one test's 30 s)
async function sweepStage(page: Page, s: string, sc: string) {
  const seed = async () => {
    await page.evaluate((s) => {
      const d = (window as unknown as { __demo: DemoApi }).__demo
      d.reset()
      const st = d.state() as unknown as Record<string, unknown>
      st.path = '~/Pictures/Photobooks'
      st.books = [
        {
          id: 'x1',
          title: 'Probe',
          book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: 'A5' },
        },
      ]
      st.open = 'x1'
      d.go(s)
    }, s)
    await atStage(page, s)
  }
  const Q = `:is(${sc}) :is(button, [role=button], a[href], [role=radio], [role=tab], [role=switch], [role=checkbox]):visible`
  const dead: string[] = []
  let n = 0
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  {
    await seed()
    const cnt = await page.locator(Q).count()
    for (let i = 0; i < cnt; i++) {
      await seed()
      const el = page.locator(Q).nth(i)
      if (!(await el.count())) continue
      if (
        await el.evaluate(
          (e) =>
            (e as HTMLButtonElement).disabled ||
            e.getAttribute('aria-disabled') === 'true' ||
            e.hasAttribute('data-disabled') ||
            e.getAttribute('aria-checked') === 'true' ||
            e.getAttribute('aria-selected') === 'true' ||
            e.hasAttribute('aria-current') ||
            /^https?:/.test(e.getAttribute('href') ?? ''),
        )
      )
        continue
      const label = await el.evaluate((e) =>
        (
          (e.getAttribute('aria-label') ?? '') ||
          e.textContent ||
          ((e as HTMLElement).dataset.testid ?? '') ||
          e.tagName
        )
          .trim()
          .slice(0, 40),
      )
      await page.evaluate(() => {
        const w = window as unknown as {
          __m: number
          __mo?: MutationObserver
          __h: string
        }
        w.__m = 0
        const IGN = new Set([
          'data-hovered',
          'data-pressed',
          'data-focused',
          'data-focus-visible',
          'data-focus-within',
        ])
        w.__mo?.disconnect()
        w.__mo = new MutationObserver((ms) => {
          for (const m of ms)
            if (m.type !== 'attributes' || !IGN.has(m.attributeName ?? ''))
              w.__m++
        })
        w.__mo.observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        })
        w.__h = location.hash
      })
      try {
        await el.click({ timeout: 1500 })
      } catch (e) {
        // a click already sent whose handler outlasts the timeout (the site's WebGL reader under load) is judged by its effect below
        if (!String(e).includes('performing click action')) {
          dead.push(`${s}:${label}(unclickable)`)
          continue
        }
      }
      n++
      const changed = await expect
        .poll(
          () =>
            page.evaluate(() => {
              const w = window as unknown as { __m: number; __h: string }
              return w.__m + (location.hash !== w.__h ? 1 : 0)
            }),
          // generous: Preview / the site mount WebGL and hold the main thread under parallel load; a live control answers at once
          { timeout: 5000 },
        )
        .toBeGreaterThan(0)
        .then(
          () => true,
          () => false,
        )
      if (!changed) dead.push(`${s}:${label}`)
    }
  }
  await page.evaluate(() => {
    ;(window as unknown as { __mo?: MutationObserver }).__mo?.disconnect()
  })
  return { n, dead }
}

const SWEEP = {
  welcome: '[data-testid=demo]',
  library: '[data-testid=demo]',
  settings: '[data-testid=demo]',
  site: '[data-testid=demo]',
  editor: '[data-testid=editor-bar], [data-testid=dock]',
}

test.describe('v8 §5 #/demo: no dead buttons', () => {
  test.describe.configure({ mode: 'serial' })
  let clicked = 0
  for (const [s, sc] of Object.entries(SWEEP))
    test(`stage ${s}: every enabled control changes the DOM or the route`, async ({
      page,
    }) => {
      const errs = watchErrors(page)
      const r = await sweepStage(page, s, sc)
      clicked += r.n
      expect(r.dead).toEqual([])
      expect(errs).toEqual([])
    })
  test('the sweep clicked at least 25 controls', () => {
    expect(clicked).toBeGreaterThanOrEqual(25)
  })
})

test('v8.1 #/demo walk: per-book state, own site, filmstrip label, path, library menu, fullscreen focus, print, custom size, blank book, settings', async ({
  page,
}) => {
  const errs = watchErrors(page)
  const J = (o: unknown) => JSON.stringify(o).slice(0, 500)
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: DemoApi }).__demo.reset()
  })
  await atStage(page, 'welcome')
  await page
    .getByRole('button', { name: /Create library/i })
    .first()
    .click()
  await dlgBtn(page, /Choose|Select|Use/i).click()
  await atStage(page, 'library')
  const path = (await page.getByTestId('library-path').textContent())?.trim()
  // v8.1 P1-4 library path is not doubled
  expect
    .soft(
      path === '~/Pictures/Photobooks' ||
        /^~\/Pictures\/[^~/]+$/.test(path ?? ''),
      path,
    )
    .toBe(true)
  const settingsBtns = await page
    .locator(`${demo} [data-testid="library-bar"]`)
    .getByRole('button', { name: /Settings/ })
    .count()
  await page
    .getByRole('button', { name: /Create book/ })
    .first()
    .click()
  await page.locator('[role=dialog] input').first().fill('Lake trip')
  await page
    .locator('[role=dialog]')
    .getByRole('button', { name: /A5|A4|Square|cm/ })
    .first()
    .click()
    .catch(() => null)
  await page.getByRole('option', { name: /Custom size/ }).click()
  const custom = await page.getByTestId('create-custom').count()
  await page.fill('[data-testid="create-custom-w"]', '19')
  await page.fill('[data-testid="create-custom-h"]', '23')
  await page.click('[data-testid="create-book"]')
  await atStage(page, 'editor')
  const size = await page.evaluate(() => {
    const b = (window as unknown as { __demo: DemoApi }).__demo.state().books[0]
      ?.book
    return `${String(b?.w)}x${String(b?.h)}`
  })
  // v8.1 P2-6 Create book offers a Custom size (w × h) that the book gets
  expect.soft([custom, size]).toEqual([1, '19x23'])

  // blank book: no sample cover text, the title is the book's own
  await page.click('[data-item="cover"]')
  const front = page.getByTestId('cover-text-front')
  await expect(front).toBeVisible()
  const blank = [
    await page.getByTestId('cover-front').getAttribute('data-photo-id'),
    await front.inputValue(),
    await page.getByTestId('cover-text-back').inputValue(),
    (await page.getByTestId('demo').innerText()).includes('Summer by the sea'),
  ]
  // v8.1 P2-7 new book starts blank: no photo on the cover, cover text = its own title, no sample text
  expect.soft(blank, J(blank)).toEqual([null, 'Lake trip', 'Lake trip', false])
  const filmHead = page.getByTestId('film-head')
  const film = (await filmHead.innerText()).trim()
  const tabs = await page.locator('[data-testid="dock"] [role=tab]').count()
  await page.click('[data-testid="demo-add-folder"]')
  await dlgBtn(page, /Choose|Select|Use|Add/i).click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await expect(filmHead).not.toHaveText(film)
  const film2 = (await filmHead.innerText()).trim()
  // v8.1 P1-3 demo filmstrip: one plain label 'Photos · N · M used', no Photos/Templates capsule
  expect.soft(film, J([film, film2, tabs])).toMatch(/^Photos · \d+ · \d+ used$/)
  expect.soft(film2).toMatch(/^Photos · \d+ · \d+ used$/)
  expect.soft(tabs).toBe(0)

  // edit: cover photo + front title, master A columns
  await page.click('[data-item="cover"]')
  const pickRow = page.locator('[data-testid="filmstrip"] [role="row"]').nth(3)
  const pick = await pickRow.getAttribute('data-key')
  await pickRow.dragTo(page.getByTestId('cover-front'))
  await expect(page.getByTestId('cover-front')).toHaveAttribute(
    'data-photo-id',
    pick ?? '',
  )
  await page.click('[data-item="cover"]')
  await expect(front).toBeVisible()
  await front.fill('Lake trip 2026')
  const photoUrl = () =>
    page
      .locator('[data-testid="cover-front"] .cover-front-photo')
      .evaluate(
        (e) =>
          /url\("?([^")]+)"?\)/.exec(
            getComputedStyle(e).backgroundImage,
          )?.[1] ?? null,
      )
  await expect.poll(photoUrl).not.toBeNull()
  const pickSrc = await photoUrl()
  const modeSeg = page.getByTestId('mode-seg')
  const gridIn = page.locator('[data-testid="master-field-grid"] input').first()
  await modeSeg.getByText('Masters', { exact: true }).click()
  await gridIn.fill('5')
  await gridIn.press('Enter')
  const col0 = await gridIn.inputValue()
  await modeSeg.getByText('Pages', { exact: true }).click()
  await expect(gridIn).toHaveCount(0)
  const spreads = await page.evaluate(
    () =>
      (window as unknown as { __demo: DemoApi }).__demo.state().books[0]?.doc
        ?.spreads.length,
  )
  const pages = 2 * (spreads ?? 0)

  // print: real page count + the book's size
  await page.click('[data-testid="demo-print"]')
  const print = `${String(await page.getByTestId('print-summary').textContent())} | ${String(await page.getByTestId('print-size').textContent())}`
  // v8.1 P2-5 print dialog uses the real page count and the book's size
  expect.soft(print).toContain(`${String(pages)} pages`)
  expect.soft(print).toMatch(/Custom · 19 × 23 cm/)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('print-summary')).toHaveCount(0)

  // back to the library: card shows the current cover
  await page.click('[data-testid="editor-library"]')
  await atStage(page, 'library')
  const cardSrc = await page
    .locator(`${demo} [data-testid="book-cover"]`)
    .first()
    .evaluate((e) => {
      for (const x of [e, ...e.querySelectorAll('*')]) {
        const m = /url\("?([^")]+)"?\)/.exec(
          getComputedStyle(x).backgroundImage,
        )
        if (m) return m[1]
        if (x instanceof HTMLImageElement) return x.src
      }
      return null
    })
  // reopen: state kept
  await page.click(`${demo} [data-testid="book-cover"]`)
  await atStage(page, 'editor')
  await page.click('[data-item="cover"]')
  await expect(front).toBeVisible()
  const reCover = await page
    .getByTestId('cover-front')
    .getAttribute('data-photo-id')
  const reFront = await front.inputValue()
  await modeSeg.getByText('Masters', { exact: true }).click()
  const reCol = await gridIn.inputValue()
  await modeSeg.getByText('Pages', { exact: true }).click()
  await expect(gridIn).toHaveCount(0)
  const re = await page.evaluate(() => {
    const b = (window as unknown as { __demo: DemoApi }).__demo.state().books[0]
    return {
      size: `${String(b?.book.w)}x${String(b?.book.h)}`,
      spreads: b?.doc?.spreads.length,
    }
  })
  // v8.1 P1-1 per-book state: edit cover photo + title + master grid, leave, reopen → cover, text, masters, size and spreads kept;
  // library card shows the current cover
  const kept = { pick, reCover, reFront, col: [col0, reCol], size: re.size }
  expect.soft(kept, J({ ...kept, card: cardSrc, pickSrc })).toEqual({
    pick,
    reCover: pick,
    reFront: 'Lake trip 2026',
    col: ['5', '5'],
    size: '19x23',
  })
  expect.soft(re.spreads).toBe(spreads)
  expect.soft(cardSrc).toBeTruthy()
  expect.soft(cardSrc).toBe(pickSrc)

  // publish → Open site lands on library home of published books (v0.9.3); then open the book
  await page.click('[data-testid="demo-publish"]')
  await page.click('[data-testid="publish-go"]')
  await expect(page.getByTestId('publish-link')).toHaveText(/\S/)
  await page.click('[data-testid="publish-open-site"]')
  await atStage(page, 'site')
  // personal-site K2: the bookcase of the published books; a book opens its reading room (the cover turns first)
  const caseBooks = page.getByTestId('ss9-book')
  const catalog = await page.getByTestId('site-case').count()
  const siteBooks = await caseBooks.count()
  const caseLabel = (await caseBooks.first().getAttribute('aria-label')) ?? ''
  await caseBooks.first().click()
  await expect(
    page.locator('[data-testid="site-room"][data-view="1"]'),
  ).toBeVisible()
  await settled(page)
  const siteAbout = (await page.getByTestId('site-about').textContent())?.trim()
  const siteInd = (await page.getByTestId('site-label').textContent())?.trim()
  // personal-site K2: Open site → the bookcase of the published book (title, 2(n − 1) pages); the room opens it at Page 1
  const k2 = { catalog, siteBooks, caseLabel, siteAbout, siteInd }
  expect.soft([catalog, siteBooks], J(k2)).toEqual([1, 1])
  expect.soft(caseLabel.startsWith('Lake trip, '), J(k2)).toBe(true)
  expect
    .soft(caseLabel, J(k2))
    .toMatch(new RegExp(`\\b${String(pages - 2)} pages`))
  expect.soft(siteAbout ?? '', J(k2)).toMatch(/^Lake trip/)
  expect.soft(siteInd ?? '', J(k2)).toMatch(/^Page 1/)

  // personal-site D36: Share swaps to "Copied" in the same grid cell for 2000 ms (no width change)
  const share = page.getByTestId('site-share')
  const shareBox = () =>
    share.evaluate((e) => ({
      w: e.getBoundingClientRect().width,
      txt: [...e.children].find(
        (s) => getComputedStyle(s).visibility === 'visible',
      )?.textContent,
    }))
  const share0 = await shareBox()
  await share.click()
  await expect.poll(async () => (await shareBox()).txt).toBe('Copied')
  const share1 = await shareBox()
  await expect
    .poll(async () => (await shareBox()).txt, {
      timeout: 2200,
      intervals: [50],
    })
    .toBe('Share')
  const share2 = await shareBox()
  expect.soft(share0.txt).toBe('Share')
  expect
    .soft(Math.abs(share1.w - share0.w), J([share0, share1, share2]))
    .toBeLessThanOrEqual(0.5)
  expect
    .soft(Math.abs(share2.w - share0.w), J([share0, share1, share2]))
    .toBeLessThanOrEqual(0.5)

  // fullscreen: Esc returns focus to the Fullscreen button
  await page.click('[data-testid="site-fullscreen-btn"]')
  const lb = page.getByTestId('lightbox')
  await expect(lb).toBeVisible()
  await settled(page)
  const fb = await lb.evaluate((v) => {
    const R = (e: Element) => e.getBoundingClientRect()
    const d = R(v)
    const slide = v.querySelector(
      '[data-testid="site-fullscreen-book"]',
    )?.firstElementChild
    if (!slide) return null
    const b = R(slide)
    const r = (n: number) => +n.toFixed(2)
    return {
      box: [b.left - d.left, b.top - d.top, b.width, b.height].map(r),
      area: [d.width - 128, d.height - 112].map(r),
    }
  })
  // site-lightbox §2: the room's slide (endpaper | page 1) fits the area at the spread ratio, centred
  expect.soft(fb).not.toBeNull()
  const [x = 0, y = 0, w = 0, h = 0] = fb?.box ?? []
  const [aw = 0, ah = 0] = fb?.area ?? []
  expect
    .soft(
      (Math.abs(w - aw) <= 0.5 || Math.abs(h - ah) <= 0.5) &&
        w <= aw + 0.5 &&
        h <= ah + 0.5 &&
        Math.abs(x - 64 - (aw - w) / 2) <= 0.5 &&
        Math.abs(y - 64 - (ah - h) / 2) <= 0.5,
      J(fb),
    )
    .toBe(true)
  await page.keyboard.press('Escape')
  await expect(lb).toHaveCount(0)
  // v8.1 P2-2 Esc closes fullscreen and returns focus to site-fullscreen-btn
  await expect
    .poll(() =>
      page.evaluate(
        () => (document.activeElement as HTMLElement | null)?.dataset.testid,
      ),
    )
    .toBe('site-fullscreen-btn')

  // library "…" menu: Rename, Duplicate, Remove
  await page.click('[data-testid="demo-site-back"]')
  await atStage(page, 'editor')
  await page.click('[data-testid="editor-library"]')
  await atStage(page, 'library')
  const titles = () =>
    page.evaluate(() =>
      (window as unknown as { __demo: DemoApi }).__demo
        .state()
        .books.map((b) => b.title),
    )
  const menu = async () => {
    // the last menu's exit animation is over before the next one opens
    await expect(page.getByRole('menuitem')).toHaveCount(0)
    await page.locator(`${demo} [data-testid="book-menu"]`).first().click()
    await expect(page.getByRole('menuitem').first()).toBeVisible()
  }
  await menu()
  const items = await page.getByRole('menuitem').allTextContents()
  await page.getByRole('menuitem', { name: 'Rename' }).click()
  const rename = page.getByTestId('rename-input')
  await rename.fill('Lake trip ’26')
  await rename.press('Enter')
  await expect.poll(titles).toEqual(['Lake trip ’26'])
  await menu()
  await page.getByRole('menuitem', { name: 'Duplicate' }).click()
  await expect.poll(async () => (await titles()).length).toBe(2)
  const afterDup = await titles()
  await menu()
  await page.getByRole('menuitem', { name: /Remove/ }).click()
  await page.getByRole('button', { name: 'Remove book' }).click()
  await expect.poll(async () => (await titles()).length).toBe(1)
  // v8.1 P2-1 demo library '…' menu: Rename, Duplicate, Remove work
  expect.soft(J(items)).toContain('Rename')
  expect.soft(J(items)).toContain('Duplicate')
  expect.soft(J(items)).toContain('Remove')
  expect
    .soft([...afterDup].sort())
    .toEqual(['Lake trip ’26', 'Lake trip ’26 (copy)'])
  await page.click(`${demo} [data-testid="home-settings"]`)
  // v8.1 P2-8 one Settings button in the demo library bar, and it opens Settings
  expect.soft(settingsBtns).toBe(1)
  await expect.poll(() => stage(page)).toBe('settings')
  // v8.1 demo walk: 0 console errors
  expect(errs).toEqual([])
})

const SLOT = { left: 212, right: 300 }
const offSlot = (m: { l: number | null; r: number | null }) =>
  (m.l !== null && m.l !== SLOT.left) || (m.r !== null && m.r !== SLOT.right)

test("stage 3: feature pages' panel-l / panel-r widths equal SLOT (212 / 300)", async ({
  page,
}) => {
  const meas = () =>
    page.evaluate(() => {
      const w = (t: string) => {
        const e = document.querySelector(`[data-testid="${t}"]`)
        return e ? Math.round(e.getBoundingClientRect().width) : null
      }
      return { l: w('panel-l'), r: w('panel-r') }
    })
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(() => {
    const d = (window as unknown as { __demo: DemoApi }).__demo
    d.reset()
    d.state().path = '~/Pictures/Photobooks'
    d.go('library')
  })
  await atStage(page, 'library')
  const seen: { slug: string; l: number | null; r: number | null }[] = []
  for (const slug of [
    'editor-chrome-toolbar',
    'spread-list-panel',
    'pasteboard-workspace',
    'drag-place-replace',
    'inspector',
    'pdf-export',
  ]) {
    await page.goto(`/uikit/#/feature/${slug}`)
    await expect(page.getByTestId('demo')).toBeVisible()
    await expect
      .poll(async () => {
        const m = await meas()
        return m.l !== null || m.r !== null
      })
      .toBe(true)
    await settled(page)
    seen.push({ slug, ...(await meas()) })
  }
  expect(seen.filter(offSlot)).toEqual([])
})
