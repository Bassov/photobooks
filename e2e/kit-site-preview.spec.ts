import type { Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit site preview mode (moved from uikit/scripts/qa.mjs v0.9.1 §2,
// uikit-qa-split-4): #/demo Preview opens the site preview dialog in the editor
// stage (bar geometry, the room under the bar at 1440 × 900 and 1280 × 720),
// keys and focus stay inside it, Esc closes the lightbox then the preview,
// Space on Back closes it, a selected frame survives Delete in the preview, and
// the kit page states Preview / Spread 2 / Fullscreen.

test.use({ viewport: { width: 1440, height: 900 } })

interface DemoApi {
  reset: () => void
  state: () => Record<string, unknown> & { books: Record<string, unknown>[] }
  go: (stage: string) => void
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

/** the site preview: dialog attributes, bar, Back / label boxes, the room and what paints at its centre */
const spv = (page: Page) =>
  page.evaluate(() => {
    const q = (s: string) =>
      document.querySelector<HTMLElement>(`[data-testid="${s}"]`)
    const r = (s: string) => {
      const b = q(s)?.getBoundingClientRect()
      return b ? [b.x, b.y, b.width, b.height].map((v) => +v.toFixed(2)) : null
    }
    const root = q('site-preview')
    const cs = root && getComputedStyle(root)
    const bar = q('site-preview-bar')
    const stg = r('site-room')
    const se = document.scrollingElement ?? document.documentElement
    const at =
      stg &&
      document.elementFromPoint(
        (stg[0] ?? 0) + (stg[2] ?? 0) / 2,
        (stg[1] ?? 0) + (stg[3] ?? 0) / 2,
      )
    const back = q('site-preview-back')
    return {
      root:
        root && cs
          ? [
              cs.position,
              root.getAttribute('role'),
              root.getAttribute('aria-modal'),
              root.getAttribute('aria-label'),
            ]
          : null,
      bar: bar
        ? [
            r('site-preview-bar')?.[3],
            getComputedStyle(bar).backgroundColor,
            getComputedStyle(bar).boxShadow,
          ]
        : null,
      back: r('site-preview-back'),
      label: r('site-preview-label'),
      backTxt: back?.textContent,
      backTitle: back?.closest('[title]')?.getAttribute('title'),
      backKeys: back?.getAttribute('aria-keyshortcuts'),
      lib: r('editor-library'),
      stage: stg,
      view: q('site-room')?.dataset.view,
      ind: q('site-label')?.textContent.trim(),
      share: !!q('site-share'),
      all: !!q('site-all-books'),
      fs: !!q('site-fullscreen-btn'),
      paint: !!at?.closest('[data-testid="site-preview"]'),
      docScroll: [se.scrollWidth - innerWidth, se.scrollHeight - innerHeight],
    }
  })

const near = (a: number | null | undefined, b: number) =>
  a != null && Math.abs(a - b) <= 0.5

test('site-preview-mode: #/demo Preview dialog, room under the bar, keys / focus / Esc / Space stay in the preview; kit page states', async ({
  page,
}) => {
  // §2 Preview = current-book preview, not Site stage
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  // (Lake trip trim 19 × 23: the site stage ratio is the spread's, 38 / 23 = 760 / 460 as the site-preview-mode values table)
  await page.evaluate(() => {
    const d = (window as unknown as { __demo: DemoApi }).__demo
    d.reset()
    d.state().path = '~/Pictures/Photobooks'
    d.state().books = [
      {
        id: 's1',
        title: 'Prev',
        book: { endp: true, endpSame: true, w: 19, h: 23, preset: 'custom' },
      },
    ]
    d.state().open = 's1'
    d.go('editor')
  })
  const demo = page.getByTestId('demo')
  await expect(demo).toHaveAttribute('data-demo-stage', 'editor')
  await expect(page.getByTestId('demo-preview')).toBeVisible()
  await settled(page)
  // site-preview-mode §2 / §4 / §6: Delete / ⌘Z / "[" while the preview is open must not reach the editor
  const edSnap = () =>
    page.evaluate(() => ({
      doc: JSON.stringify(
        (window as unknown as { __demo?: DemoApi }).__demo?.state().books[0]
          ?.doc ?? null,
      ).length,
      frames: document.querySelectorAll(
        '[data-testid="demo-editor"] [data-testid="canvas"] [data-testid="frame"]',
      ).length,
      panel: !!document.querySelector('[data-testid="spreads-panel"]'),
    }))
  const ed0 = await edSnap()
  await page.click('[data-testid="demo-preview"]')
  const preview = page.getByTestId('site-preview')
  await expect(preview).toBeVisible()
  await settled(page)
  const prevOpen = await preview.count()
  const stage = await demo.getAttribute('data-demo-stage')
  const sp0 = await spv(page)
  expect
    .soft(
      prevOpen === 1 &&
        stage === 'editor' &&
        JSON.stringify(sp0.root) ===
          JSON.stringify(['fixed', 'dialog', 'true', 'Site preview']) &&
        sp0.bar?.[0] === 48 &&
        sp0.bar[1] === 'rgb(227, 225, 221)' &&
        String(sp0.bar[2]).includes('inset') &&
        near(sp0.back?.[0], 12) &&
        near(sp0.back?.[1], 8) &&
        near(sp0.back?.[3], 32) &&
        sp0.backTxt === 'Back to the editor' &&
        sp0.backTitle === 'Back to the editor (Esc)' &&
        sp0.backKeys === 'Escape' &&
        near(sp0.label?.[0], (sp0.back?.[0] ?? 0) + (sp0.back?.[2] ?? 0) + 8),
      `site-preview-mode §2: Preview opens the site preview dialog in the editor stage — 48 px #E3E1DD bar with an inset rule, Back x 12 y 8 h 32 on the Library link, label 8 px right of Back: ${JSON.stringify(sp0)}`,
    )
    .toBe(true)
  expect
    .soft(
      !!sp0.stage &&
        (sp0.stage[1] ?? 0) >= 48 &&
        sp0.paint &&
        sp0.ind === 'Cover' &&
        !sp0.share &&
        !sp0.all &&
        sp0.fs &&
        sp0.docScroll.every((v) => v === 0),
      `personal-site D45: the Preview shows the room under the bar (painted on top), at 'Cover' (Owner M53); Share and All books hidden, Fullscreen kept; no document scroll at 1440 × 900: ${JSON.stringify(sp0)}`,
    )
    .toBe(true)
  await page.setViewportSize({ width: 1280, height: 720 })
  await settled(page)
  const spS = await spv(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await settled(page)
  expect
    .soft(
      !!spS.stage &&
        (spS.stage[1] ?? 0) >= 48 &&
        spS.docScroll.every((v) => v === 0),
      `personal-site D45: 1280 × 720 room under the bar, no document scroll: ${JSON.stringify([spS.stage, spS.docScroll])}`,
    )
    .toBe(true)

  // keys: → turns (the guard hands page keys to the room), the editor sees nothing (Delete, ⌘Z, "[" panel toggle)
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('site-room')).toHaveAttribute('data-view', '1')
  await settled(page)
  const ind1 = (await spv(page)).view
  for (const key of ['Delete', 'Backspace', 'ControlOrMeta+z', '['])
    await page.keyboard.press(key)
  await settled(page)
  // held Space must not arm the editor's pan (data-panning) under the preview
  await page.keyboard.down('Space')
  await settled(page)
  const spacePan = await page
    .locator('[data-testid="demo-editor"] [data-panning]')
    .count()
  await page.keyboard.up('Space')
  // Tab ×10 / Shift+Tab ×10 stay inside the preview
  const inSp = () =>
    page.evaluate(
      () => !!document.activeElement?.closest('[data-testid="site-preview"]'),
    )
  const tabTrail = [await inSp()]
  for (const key of [
    ...Array<string>(10).fill('Tab'),
    ...Array<string>(10).fill('Shift+Tab'),
  ]) {
    await page.keyboard.press(key)
    tabTrail.push(await inSp())
  }
  // Fullscreen: Esc closes the lightbox only, a second Esc the preview
  await page.click('[data-testid="site-fullscreen-btn"]')
  const lightbox = page.getByTestId('lightbox')
  await expect(lightbox).toBeVisible()
  const lb0 = await lightbox.count()
  await page.keyboard.press('Escape')
  await expect(lightbox).toHaveCount(0)
  await settled(page)
  const esc1 = [await lightbox.count(), await preview.count()]
  await page.keyboard.press('Escape')
  await expect(preview).toHaveCount(0)
  await settled(page)
  const esc2 = await preview.count()
  const escFocus = await page.evaluate(
    () =>
      document.activeElement?.getAttribute('data-testid') ??
      document.activeElement?.tagName,
  )
  const ed1 = await edSnap()
  const stageEsc = await demo.getAttribute('data-demo-stage')
  const keys = {
    ind1,
    ed0,
    ed1,
    spacePan,
    tabTrail: tabTrail.map(Number).join(''),
  }
  expect
    .soft(
      ind1 === '1' &&
        JSON.stringify(ed1) === JSON.stringify(ed0) &&
        spacePan === 0 &&
        tabTrail.every(Boolean),
      `site-preview-mode §4: → turns the room from the cover to view 1; Delete / Backspace / ⌘Z / [ / Space change nothing in the editor (no data-panning); Tab ×10 and Shift+Tab ×10 stay inside: ${JSON.stringify(keys)}`,
    )
    .toBe(true)
  expect
    .soft(
      lb0 === 1 &&
        JSON.stringify(esc1) === '[0,1]' &&
        esc2 === 0 &&
        escFocus === 'demo-preview' &&
        stageEsc === 'editor',
      `site-preview-mode §4: Fullscreen open → first Esc closes the lightbox only, second Esc closes the preview; focus back on Preview, still the editor stage: ${JSON.stringify({ lb0, esc1, esc2, escFocus, stageEsc })}`,
    )
    .toBe(true)

  // Space activates the focused Back button (the editor's Space-to-pan must not swallow it)
  await page.click('[data-testid="demo-preview"]')
  await expect(preview).toBeVisible()
  await settled(page)
  await page.focus('[data-testid="site-preview-back"]')
  await page.keyboard.press('Space')
  await expect(preview).toHaveCount(0)
  await settled(page)
  const spBack = {
    open: await preview.count(),
    focus: await page.evaluate(() =>
      document.activeElement?.getAttribute('data-testid'),
    ),
    pan: await page
      .locator('[data-testid="demo-editor"] [data-panning]')
      .count(),
  }
  expect
    .soft(
      spBack,
      "site-preview-mode §4: Space on the focused 'Back to the editor' closes the preview; focus back on Preview, no pan armed",
    )
    .toEqual({ open: 0, focus: 'demo-preview', pan: 0 })

  // Stage 3: kit pages mount the #/demo editor parts
  await page.goto('/uikit/#/feature/editor-chrome-toolbar')
  const frames = page.locator(
    '[data-testid="demo-editor"] [data-testid="canvas"] [data-testid="frame"]',
  )
  await expect(frames.first()).toBeVisible()
  await settled(page)
  // a selected own frame survives Delete / Backspace pressed while the preview is open
  const fr0 = await frames.count()
  await frames.first().click()
  await settled(page)
  await page.click('[data-testid="demo-preview"]')
  await expect(preview).toBeVisible()
  const kitPrev = await preview.count()
  for (const key of ['Delete', 'Backspace']) await page.keyboard.press(key)
  await settled(page)
  await page.keyboard.press('Escape')
  await expect(preview).toHaveCount(0)
  await settled(page)
  const fr1 = await frames.count()
  await page.keyboard.press('Delete') // control: after Esc the editor gets Delete again
  await expect(frames).toHaveCount(fr0 - 1)
  const fr2 = await frames.count()
  expect
    .soft(
      { prevOpen, stage, kitPrev },
      'v0.9.1 §2 Preview opens in-app book preview (not Site stage) — site-preview-mode: the site’s book page',
    )
    .toEqual({ prevOpen: 1, stage: 'editor', kitPrev: 1 })
  expect
    .soft(
      fr0 > 0 && fr1 === fr0 && fr2 === fr0 - 1,
      `site-preview-mode §4: a selected frame survives Delete / Backspace pressed in the preview; after Esc (selection kept) Delete removes it: ${JSON.stringify({ fr0, fr1, fr2 })}`,
    )
    .toBe(true)

  // kit page #/feature/site-preview-mode: Preview (the cover, Owner M53), Spread 2 (slide 2 = view 3), Fullscreen (the lightbox over the preview)
  await page.goto('/uikit/#/feature/site-preview-mode')
  await expect(page.locator('[data-testid="scenarios"]')).toBeVisible()
  const spStates: [number, string | undefined, number][] = []
  for (const tab of ['Preview', 'Spread 2', 'Fullscreen']) {
    const t = page.locator(
      `[data-testid="scenarios"] [role="tab"]:text-is("${tab}")`,
    )
    await t.evaluate((el) => {
      ;(el as HTMLElement).click()
    })
    await expect(t).toHaveAttribute('aria-selected', 'true')
    await settled(page)
    spStates.push(
      await page.evaluate(() => [
        document.querySelectorAll('[data-testid="site-preview"]').length,
        document.querySelector<HTMLElement>('[data-testid="site-room"]')
          ?.dataset.view,
        document.querySelectorAll('[data-testid="lightbox"]').length,
      ]),
    )
  }
  expect(
    JSON.stringify(spStates.map(([n, , lb]) => [n, lb])) ===
      '[[1,0],[1,0],[1,1]]' &&
      spStates[0]?.[1] === '0' &&
      spStates[1]?.[1] === '3',
    `site-preview-mode kit page: states Preview (room view 0), Spread 2 (view 3), Fullscreen (lightbox over the preview): ${JSON.stringify(spStates)}`,
  ).toBe(true)
})
