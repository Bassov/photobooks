import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'
import { pixelsAt } from './fixtures/paintProbe'

// in-app-publish (kit): K1 the Publish dialog steps, K2 the Publish pill and
// P7, K3 Export site icon-only below 1360 px and the page states. The kit run
// is a 1.4 s stand-in on performance.now, frozen here to hold a percent.

const KIT = '/uikit/#/full/in-app-publish'

interface Demo {
  reset: () => void
  go: (stage: string) => void
  state: () => {
    path: string
    open: string | null
    books: { id: string; title: string; doc?: { spreads: unknown[] } }[]
    hosting: Record<string, unknown> | null
  }
}
type Win = Window & { __demo: Demo; __pt: number | null }

const blank = { endp: true, endpSame: true, w: 14.8, h: 21, preset: 'A5' }

// The headless shell rounds text advances (Publish 73, Export site 111); the
// full Chromium build lays text out as the kit QA and the Designer measure it.
test.use({ viewport: { width: 1440, height: 900 }, channel: 'chromium' })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Win
    const pn = performance.now.bind(performance)
    w.__pt = null
    performance.now = () => w.__pt ?? pn()
  })
})

const near = (a: number, b: number, d = 0.5) => {
  expect(Math.abs(a - b), `${String(a)} ≈ ${String(b)}`).toBeLessThanOrEqual(d)
}

async function width(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('no box')
  return b.width
}

async function scenario(page: Page, name: string) {
  await page.goto(KIT)
  await tab(page, name)
}

/** The scenario tab, clicked in the page: a modal state's scrim covers the tab strip. */
const tab = (page: Page, name: string) =>
  page
    .getByTestId('scenarios')
    .getByRole('tab', { name, exact: true })
    .evaluate((t: HTMLElement) => {
      t.click()
    })

/** #/demo with "Lake trip" open in the editor; `hosting` patches the stored record (null = not connected). */
async function seed(page: Page, hosting?: Record<string, unknown> | null) {
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(
    ([book, h]) => {
      const d = (window as unknown as Win).__demo
      d.reset()
      const s = d.state()
      s.path = '~/Pictures/Photobooks'
      s.books = [{ id: 's3', title: 'Lake trip', book } as never]
      s.open = 's3'
      if (h === null) s.hosting = null
      else if (h) s.hosting = { ...s.hosting, ...h }
      d.go('editor')
    },
    [blank, hosting] as const,
  )
  await expect(page.getByTestId('demo-publish')).toBeEnabled()
}

const freeze = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as Win
    w.__pt = Math.floor(performance.now())
  })
const advance = (page: Page, ms: number) =>
  page.evaluate((d) => {
    const w = window as unknown as Win
    w.__pt = (w.__pt ?? 0) + d
  }, ms)
const release = (page: Page) =>
  page.evaluate(() => {
    ;(window as unknown as Win).__pt = null
  })

const dialog = (page: Page) => page.getByTestId('publish-dialog')
const pill = (page: Page) => page.getByTestId('demo-publish')
/** The pill's live content (the first cell is the invisible rest-label sizer). */
const live = (l: Locator) => l.locator('> span').nth(1)
const titleOf = (l: Locator) =>
  l.evaluate((el) => el.parentElement?.getAttribute('title') ?? '')

type FocusWin = Window & { __focus: string[]; __focusMo?: MutationObserver }
/** Logs `<step>:in|out` (is focus inside the dialog?) in the microtask after each data-step change: an Esc pressed
 *  before React Aria's next-frame refocus only reaches the overlay when focus never fell to <body>. */
const focusAtStep = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as FocusWin
    w.__focus = []
    w.__focusMo?.disconnect()
    w.__focusMo = new MutationObserver((rs) => {
      for (const r of rs) {
        const el = r.target as HTMLElement
        const inside = document.activeElement?.closest('[role=dialog]')
        w.__focus.push(`${el.dataset.step ?? ''}:${inside ? 'in' : 'out'}`)
      }
    })
    w.__focusMo.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-step'],
    })
  })
const focusLog = (page: Page) =>
  page.evaluate(() => (window as unknown as FocusWin).__focus)

test.describe('K1 the Publish dialog', () => {
  test('no hosting: connect → Open Settings → Hosting', async ({ page }) => {
    await scenario(page, 'No hosting')
    await expect(dialog(page)).toHaveAttribute('data-step', 'connect')
    await expect(dialog(page)).toContainText(
      'Connect your hosting first. Publish uploads your books to your own Cloudflare R2 bucket, which you connect once in Settings.',
    )
    await page.getByTestId('publish-open-hosting').click()
    await expect(page.getByTestId('demo-root')).toHaveAttribute(
      'data-demo-stage',
      'settings',
    )
    await expect(page.getByTestId('hosting-form')).toBeVisible()
  })

  test('options: no size or PDF, the bold host; the dialog frame', async ({
    page,
  }) => {
    await scenario(page, 'Options')
    const d = dialog(page)
    await expect(d).toHaveAttribute('data-step', 'opts')
    await expect(page.getByTestId('publish-host-line')).toHaveText(
      '“Lake trip” goes to books.basov.photo with the other published books.',
    )
    const host = page.getByTestId('publish-host-line').locator('span')
    await expect(host).toHaveText('books.basov.photo')
    await expect(host).toHaveCSS('font-weight', '500')
    await expect(d.getByRole('checkbox')).toHaveCount(0)
    await expect(d.getByText('Web image size')).toHaveCount(0)
    const frame = await d.evaluate((el) => {
      const box = el.closest<HTMLElement>('[role=dialog]') ?? document.body
      const cs = getComputedStyle(el)
      let rounded: HTMLElement | null = box
      while (rounded && getComputedStyle(rounded).borderTopLeftRadius === '0px')
        rounded = rounded.parentElement
      return {
        w: box.offsetWidth,
        pad: `${cs.paddingTop} ${cs.paddingRight}`,
        r: rounded ? getComputedStyle(rounded).borderTopLeftRadius : '',
      }
    })
    expect(frame).toEqual({ w: 480, pad: '20px 24px', r: '14px' })
    const [[r = 0, g = 0, b = 0] = []] = await pixelsAt(d, [{ x: 6, y: 6 }])
    expect([r, g, b]).toEqual([225, 225, 225])
  })

  test('running: phase · NN%, a 6 px bar, the hint and Hide', async ({
    page,
  }) => {
    await scenario(page, 'Publishing')
    const d = dialog(page)
    await expect(d).toHaveAttribute('data-step', 'run')
    await expect(d).toContainText('Rendering web images · 42%')
    await expect(d).toContainText(
      'You can keep editing. Changes from now on go into the next publish.',
    )
    const bar = page.getByTestId('publish-progress').locator('> div').first()
    expect(await bar.evaluate((el) => (el as HTMLElement).offsetHeight)).toBe(6)
    await expect(page.getByTestId('publish-hide')).toBeVisible()
  })

  test('done: the book link and the summary', async ({ page }) => {
    await scenario(page, 'Published')
    await expect(page.getByTestId('publish-link')).toHaveText(
      'https://books.basov.photo/books/lake-trip/',
    )
    await expect(page.getByTestId('publish-link')).toHaveCSS(
      'user-select',
      'all',
    )
    await expect(page.getByTestId('publish-summary')).toHaveText(
      '14 changed files uploaded · 3.2 MB. 186 were already up to date.',
    )
  })

  test('failed: timeout sends the rest, key points to Hosting', async ({
    page,
  }) => {
    await scenario(page, 'Failed, timeout')
    await expect(page.getByTestId('publish-error')).toHaveText(
      "Cloudflare didn't answer in 30 seconds. 12 of 40 files went up. Try again to send the rest.",
    )
    await expect(page.getByTestId('publish-retry')).toHaveText('Try again')
    await tab(page, 'Failed, key')
    await expect(page.getByTestId('publish-error')).toHaveText(
      "Cloudflare doesn't recognise this key. It may have been deleted or rolled. Replace the token in Settings → Hosting.",
    )
    await expect(page.getByTestId('publish-open-hosting')).toBeVisible()
    await expect(page.getByTestId('publish-retry')).toHaveCount(0)
  })
})

test.describe('K2 the Publish pill', () => {
  test('last in the end group, 6 px after Print, rest width in every page state', async ({
    page,
  }) => {
    await scenario(page, 'Hidden, 42 %')
    const p = pill(page)
    const gap = await p.evaluate((el) => {
      const bar = el.closest<HTMLElement>('div.flex') ?? document.body
      const buttons = [...bar.querySelectorAll('button')]
      const prev = buttons[buttons.indexOf(el as HTMLButtonElement) - 1]
      return {
        last: buttons.at(-1) === el,
        gap:
          el.getBoundingClientRect().left -
          (prev?.getBoundingClientRect().right ?? 0),
      }
    })
    expect(gap.last).toBe(true)
    near(gap.gap, 6)
    const states: Record<string, string> = {
      Options: 'idle',
      'Hidden, 42 %': 'running',
      Published: 'done',
      'Failed, key': 'failed',
    }
    for (const [name, state] of Object.entries(states)) {
      await tab(page, name)
      await expect(p).toHaveAttribute('data-state', state)
      near(await width(p), 73.58)
    }
  })

  test('running paints NN% over the #BEBEBE fill', async ({ page }) => {
    await scenario(page, 'Hidden, 42 %')
    const p = pill(page)
    await expect(live(p)).toHaveText('42%')
    await expect(p).toHaveAttribute('aria-label', 'Publish')
    expect(await titleOf(p)).toBe('Publishing · 42%')
    const w = await width(p)
    const [[a = 0] = [], [b = 0] = []] = await pixelsAt(p, [
      { x: 6, y: 16 },
      { x: Math.round(w - 8), y: 16 },
    ])
    expect(a).toBe(190)
    expect(b).toBe(215)
  })

  test('#/demo: Hide / Esc / outside click keep the run in the pill; P7; done opens Published', async ({
    page,
  }) => {
    await seed(page)
    await freeze(page)
    await pill(page).click()
    await expect(dialog(page)).toHaveAttribute('data-step', 'opts')
    await page.getByTestId('publish-go').click()
    await advance(page, 700)
    await expect(dialog(page)).toContainText('Uploading changed files · 50%')
    await page.getByTestId('publish-hide').click()
    await expect(dialog(page)).toHaveCount(0)
    await expect(pill(page)).toHaveAttribute('data-state', 'running')
    await expect(live(pill(page))).toHaveText('50%')
    near(await width(pill(page)), 73.58)
    await expect(page.getByTestId('demo-publish-status')).toHaveText(
      'Publishing, 50%',
    )
    const ex = page.getByTestId('demo-export-site')
    await expect(ex).toBeDisabled()
    expect(await titleOf(ex)).toBe('Wait until Publish finishes')
    // the pill reopens the run; Esc and an outside click hide it again
    await pill(page).click()
    await expect(dialog(page)).toHaveAttribute('data-step', 'run')
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toHaveCount(0)
    await pill(page).click()
    await expect(dialog(page)).toHaveAttribute('data-step', 'run')
    await page.mouse.click(700, 880)
    await expect(dialog(page)).toHaveCount(0)
    await expect(pill(page)).toHaveAttribute('data-state', 'running')
    await release(page)
    await expect(pill(page)).toHaveAttribute('data-state', 'done')
    await expect(pill(page).locator('svg.lucide-circle-check')).toHaveCount(1)
    near(await width(pill(page)), 73.58)
    await expect(page.getByTestId('demo-publish-status')).toHaveText(
      'Published',
    )
    await expect(ex).toBeEnabled()
    await pill(page).click()
    await expect(dialog(page)).toHaveAttribute('data-step', 'done')
    await page.keyboard.press('Escape')
    await expect(pill(page)).toHaveAttribute('data-state', 'idle', {
      timeout: 6000,
    })
  })

  test('#/demo: Publish waits while Export site runs', async ({ page }) => {
    await seed(page)
    await freeze(page)
    await page.getByTestId('demo-export-site').click()
    await page.getByTestId('export-site-choose').click()
    await page
      .locator('[role=dialog]')
      .getByText('Exports', { exact: true })
      .click()
    await page.getByTestId('picker-select').click()
    await page.getByTestId('export-site-go').click()
    await page.getByTestId('export-site-hide').click()
    await expect(pill(page)).toBeDisabled()
    expect(await titleOf(pill(page))).toBe('Wait until the export finishes')
    await release(page)
    await expect(pill(page)).toBeEnabled()
  })

  test('#/demo: a step change keeps focus in the dialog, so Esc right after it closes', async ({
    page,
  }) => {
    await seed(page, { ok: false, code: 'InvalidAccessKeyId' })
    await pill(page).click()
    await focusAtStep(page)
    await page.getByTestId('publish-go').click()
    await expect(dialog(page)).toHaveAttribute('data-step', 'failed')
    expect(await focusLog(page)).toEqual(['failed:in'])

    await seed(page)
    await page.getByTestId('demo-export-site').click()
    await page.getByTestId('export-site-choose').click()
    await page
      .locator('[role=dialog]')
      .getByText('Exports', { exact: true })
      .click()
    await page.getByTestId('picker-select').click()
    await focusAtStep(page)
    await page.getByTestId('export-site-go').click()
    await expect(page.getByTestId('export-site-dialog')).toHaveAttribute(
      'data-step',
      'run',
    )
    expect(await focusLog(page)).toEqual(['run:in'])
  })

  test('#/demo: a failed run stays until opened; no hosting → connect', async ({
    page,
  }) => {
    await seed(page, { ok: false, code: 'InvalidAccessKeyId' })
    await pill(page).click()
    await page.getByTestId('publish-go').click()
    await expect(dialog(page)).toHaveAttribute('data-step', 'failed')
    await page.keyboard.press('Escape')
    await expect(pill(page)).toHaveAttribute('data-state', 'failed')
    await expect(pill(page).locator('svg.lucide-triangle-alert')).toHaveCount(1)
    await expect(page.getByTestId('demo-publish-status')).toHaveText(
      "Publish didn't finish",
    )
    await pill(page).click()
    await expect(dialog(page)).toHaveAttribute('data-step', 'failed')
    await expect(pill(page)).toHaveAttribute('data-state', 'idle')
    await page.getByTestId('publish-open-hosting').click()
    await expect(page.getByTestId('demo')).toHaveAttribute(
      'data-demo-stage',
      'settings',
    )
    await expect(page.getByTestId('hosting-recheck')).toBeVisible()

    await seed(page, null)
    await pill(page).click()
    await expect(dialog(page)).toHaveAttribute('data-step', 'connect')
  })
})

test.describe('K3 Export site below 1360 px', () => {
  for (const [w, label] of [
    [1360, true],
    [1359, false],
  ] as const) {
    test(`${String(w)} px: Export site label ${label ? 'shown' : 'hidden'}, Publish labelled`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: w, height: 900 })
      await scenario(page, 'Options')
      const ex = page.getByTestId('demo-export-site')
      await expect(live(ex).getByText('Export site')).toBeVisible({
        visible: label,
      })
      near(await width(ex), label ? 112.33 : 40)
      await expect(live(pill(page))).toHaveText('Publish')
    })
  }

  test('the seven page states', async ({ page }) => {
    await page.goto(KIT)
    await expect(page.getByTestId('scenarios').getByRole('tab')).toHaveText([
      'No hosting',
      'Options',
      'Publishing',
      'Hidden, 42 %',
      'Published',
      'Failed, timeout',
      'Failed, key',
    ])
  })
})
