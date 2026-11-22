import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// design-r21-kit-presets (Designer printer-presets M102, M103): prod is the
// reference. M102: a new kit book on Generic takes Generic's bleed (3 mm) and
// safe margin (5 mm), not the old 8 mm fallback. M103: a page too small on
// both sides gets one warning per side in prod's words (profileText.test.ts).
// printer-presets-kit / printer-presets-kit-book (moved from uikit/scripts/qa.mjs,
// uikit-qa-split-6): Settings → Print presets, the profile editor, the kit PrintDialog
// row and Book settings → PRINT, DOM measured at 1440 × 900. Those tests also fail on a console
// error / warning, page error or failed request, like qa.mjs (qa.mjs runs with scrollbars shown,
// so this file does too).

test.use({
  viewport: { width: 1440, height: 900 },
  // qa.mjs Chrome: scrollbars shown, unhinted (fractional) text widths
  launchOptions: {
    ignoreDefaultArgs: ['--hide-scrollbars'],
    args: ['--font-render-hinting=none'],
  },
})

const demo = (page: Page) => page.getByTestId('demo')

/** A new book with the Create book default page size: A5 portrait, 14.8 × 21 cm. */
async function openNewBook(page: Page) {
  await page.goto('/uikit/#/demo')
  await expect(demo(page)).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: { reset: () => void } }).__demo.reset()
  })
  await demo(page).getByTestId('create-library').click()
  await page.getByTestId('picker-select').click()
  await demo(page).getByTestId('new-book').click()
  await page.locator('[role=dialog] input').first().fill('Lake trip')
  await page.getByTestId('create-book').click()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
}

async function goStage(page: Page, stage: 'settings' | 'editor') {
  await page.evaluate((s) => {
    ;(window as unknown as { __demo: { go: (s: string) => void } }).__demo.go(s)
  }, stage)
}

test.describe('design-r21-kit-presets', () => {
  test.beforeEach(async ({ page }) => {
    await openNewBook(page)
  })

  test('a new book on Generic shows Generic bleed 3 mm and safe 5 mm', async ({
    page,
  }) => {
    await demo(page).getByTestId('book-title').click()
    const panel = demo(page).getByTestId('insp-book')
    await expect(panel.getByTestId('book-print-profile')).toHaveValue('generic')
    await expect(panel.getByTestId('book-bleed')).toHaveText('B3mm')
    await expect(panel.getByTestId('book-safe')).toHaveText('S5mm')
  })

  test('A5 against a 30–50 cm profile shows one warning per side, in prod words', async ({
    page,
  }) => {
    await goStage(page, 'settings')
    await demo(page).getByText('Print presets', { exact: true }).first().click()
    await demo(page).getByTestId('print-new').click()
    const dialog = page.getByTestId('print-profile-dialog')
    await dialog.getByLabel('Name').fill('Large format')
    await dialog.getByLabel('Smallest page side').fill('300')
    await dialog.getByLabel('Largest page side').fill('500')
    await dialog.getByTestId('pp-save').click()
    await expect(dialog).toHaveCount(0)

    await goStage(page, 'editor')
    await demo(page).getByTestId('book-title').click()
    const panel = demo(page).getByTestId('insp-book')
    await panel.getByTestId('book-print-profile').selectOption({
      label: 'Large format',
    })
    await expect(
      panel.getByTestId('book-print-issue').filter({ hasText: 'takes pages' }),
    ).toHaveText([
      'Large format takes pages from 30 cm. This page is 14.8 cm wide.',
      'Large format takes pages from 30 cm. This page is 21 cm high.',
    ])
  })
})

function watchErrors(page: Page) {
  const errs: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning')
      errs.push(`${m.type()}: ${m.text().slice(0, 240)}`)
  })
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`))
  page.on('requestfailed', (r) => errs.push(`requestfailed: ${r.url()}`))
  return errs
}

const frames2 = () =>
  new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

/** two frames painted and no finite animation still running */
async function settled(page: Page) {
  await page.evaluate(frames2)
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

async function scenarioTab(page: Page, name: string) {
  await page
    .locator(`[data-testid="scenarios"] [role="tab"]:text-is("${name}")`)
    .evaluate((t: HTMLElement) => {
      t.click()
    })
  await settled(page)
}

/** box-shadow without Tailwind's transparent ring / shadow layers */
const solid = (s: string) =>
  s
    .split(/,(?![^(]*\))/)
    .map((x) => x.trim())
    .filter((x) => !x.startsWith('rgba(0, 0, 0, 0)'))
    .join(', ')

const box = (l: Locator) =>
  l.evaluate((e) => {
    const r = e.getBoundingClientRect()
    const cs = getComputedStyle(e)
    return {
      w: +r.width.toFixed(2),
      h: +r.height.toFixed(2),
      bg: cs.backgroundColor,
      r: cs.borderRadius,
      pad: cs.padding,
      font: `${cs.fontSize}/${cs.lineHeight} ${cs.fontWeight}`,
      color: cs.color,
      shadow: cs.boxShadow,
    }
  })

test.describe('printer-presets (qa.mjs)', () => {
  test('printer-presets-kit (Designer printer-presets §Settings, §Profile editor, §Kit PrintDialog)', async ({
    page,
  }) => {
    const errs = watchErrors(page)
    const TABS = {
      print: 'Print presets',
      'print-empty': 'No custom profiles',
      'print-edit': 'Edit profile',
      'print-invalid': 'Invalid values',
    }
    const pick = (id: keyof typeof TABS) => scenarioTab(page, TABS[id])
    const S = (tid: string) =>
      page.locator(`[data-scenario] [data-testid="${tid}"]`).first()
    const click = async (l: Locator) => {
      await l.click()
      await settled(page)
    }
    await page.goto('/uikit/#/feature/site-settings')
    await expect(page.getByTestId('demo')).toBeVisible()
    await settled(page)
    await pick('print')
    const sel = await box(S('print-default'))
    expect(
      sel.w === 240 &&
        sel.h === 32 &&
        sel.bg === 'rgb(216, 214, 210)' &&
        sel.r === '8px' &&
        sel.pad === '0px 32px 0px 10px' &&
        sel.font.startsWith('13px') &&
        sel.font.endsWith(' 400'),
      `printer-presets: default select 240 × 32, bg #D8D6D2, r8, padding 0 32 0 10, 13/400 — ${JSON.stringify(sel)}`,
    ).toBe(true)
    const opts = await S('print-default').evaluate(
      (s: HTMLSelectElement) =>
        [...s.querySelectorAll('optgroup')]
          .map((g) => `${g.label}:${String(g.children.length)}`)
          .join() +
        ' = ' +
        s.value,
    )
    expect(
      opts,
      'printer-presets: select optgroups Print shops (3) / Custom (1), Lulu selected',
    ).toBe('Print shops:3,Custom:1 = lulu-photo-book')
    const shops = await S('print-shops').evaluate((c) =>
      [...c.querySelectorAll<HTMLElement>('[data-testid^="print-shop-"]')].map(
        (r) => {
          const [name, sum] = r.firstElementChild?.children ?? []
          const b = r.querySelector('button')
          if (!name || !(sum instanceof HTMLElement) || !b)
            throw new Error('print shop row without name / summary / button')
          const ns = getComputedStyle(name)
          const ss = getComputedStyle(sum)
          return {
            id: r.dataset.testid?.slice(11),
            name: `${ns.fontSize} ${ns.fontWeight}`,
            sum: `${ss.fontSize}/${ss.lineHeight} ${ss.color} ${ss.textOverflow} ${ss.whiteSpace}`,
            title: sum.title === sum.textContent,
            badge: r.textContent.includes('Default'),
            btn: `${b.textContent} ${String(b.getBoundingClientRect().height)} ${getComputedStyle(b).backgroundColor} ${getComputedStyle(b).paddingLeft}`,
          }
        },
      ),
    )
    expect(
      shops.map((s) => s.id).join() ===
        'generic,lulu-photo-book,saal-photo-book' &&
        shops.every(
          (s) =>
            s.name === '13px 500' &&
            s.sum === '12px/16.8px rgb(83, 81, 82) ellipsis nowrap' &&
            s.title &&
            s.btn === 'Duplicate 32 rgb(216, 214, 210) 12px',
        ) &&
        shops.map((s) => s.badge).join() === 'false,true,false',
      `printer-presets: shops Generic, Lulu, Saal; name 13/500, summary 12/16.8 #535152 ellipsis + title; Default badge on Lulu only; Duplicate h32 bg #D8D6D2 pad 12 — ${JSON.stringify(shops)}`,
    ).toBe(true)
    const gsum = await S('print-shop-generic')
      .locator('[data-testid="print-summary-line"]')
      .textContent()
    expect(gsum, 'printer-presets: Generic summary line').toBe(
      '5–50 cm · bleed 0–10 mm · safe 5 mm · 20–120 pages · photos ≥ 200 ppi',
    )
    const eyebrow = await page
      .locator('[data-scenario] h2:text-is("Print shops")')
      .first()
      .evaluate((e) => {
        const cs = getComputedStyle(e)
        return `${cs.fontSize} ${cs.fontWeight} ${cs.letterSpacing} ${cs.textTransform} ${cs.color}`
      })
    expect(
      eyebrow,
      'printer-presets: eyebrow 11/600 .12em uppercase #535152',
    ).toBe('11px 600 1.32px uppercase rgb(83, 81, 82)')
    const more = await box(S('print-more-custom-lulu-copy'))
    const edit = await box(S('print-edit-custom-lulu-copy'))
    expect(
      edit.h === 32 &&
        more.w === 28 &&
        more.h === 28 &&
        more.r === '8px' &&
        more.color === 'rgb(83, 81, 82)',
      `printer-presets: custom row Edit… h32 + ••• 28 × 28 r8 #535152 — ${JSON.stringify({ edit, more })}`,
    ).toBe(true)
    const nav = await page
      .locator(
        '[data-scenario] [data-testid^="settings-nav-"][aria-current="page"]',
      )
      .evaluateAll((ns) =>
        ns.map((n) => (n as HTMLElement).dataset.testid).join(),
      )
    const stub = await page
      .locator('[data-scenario]')
      .first()
      .evaluate((s) => /Home printer|Default profile/.test(s.textContent))
    expect(
      nav === 'settings-nav-print' && !stub,
      `printer-presets: aria-current only on settings-nav-print; stub rows gone (D7) — ${JSON.stringify({ nav, stub })}`,
    ).toBe(true)
    await click(S('print-more-custom-lulu-copy'))
    const menu = await page
      .locator('[data-testid="print-menu"]')
      .evaluate((m) => {
        const r = m.parentElement?.getBoundingClientRect()
        const is = [...m.querySelectorAll('[role="menuitem"]')]
        return {
          w: r?.width,
          items: is.map((i) => i.textContent).join(),
          del: is[1] ? getComputedStyle(is[1]).color : null,
          rowH: is[0] ? +is[0].getBoundingClientRect().height.toFixed(2) : null,
        }
      })
    expect(
      menu.w === 176 &&
        menu.items === 'Duplicate,Delete…' &&
        menu.del === 'rgb(168, 64, 58)',
      `printer-presets: ••• menu 176 wide, Duplicate / Delete… #a8403a — ${JSON.stringify(menu)}`,
    ).toBe(true)
    await page.keyboard.press('Escape')
    await settled(page)
    // deleting the default custom profile asks first, then Generic becomes the default
    await S('print-default').selectOption('custom-lulu-copy')
    await settled(page)
    await click(S('print-more-custom-lulu-copy'))
    await click(
      page.locator(
        '[data-testid="print-menu"] [role="menuitem"]:has-text("Delete")',
      ),
    )
    const ad = page.locator('[role="alertdialog"]')
    const adText = await ad.textContent()
    const still = await S('print-custom-custom-lulu-copy').count()
    await click(ad.getByRole('button', { name: 'Delete' }))
    const after = {
      v: await S('print-default').inputValue(),
      empty: await S('print-custom-empty').count(),
      badge: await S('print-shop-generic').textContent(),
    }
    expect(
      !!adText?.includes('Delete “Lulu · Photo book (copy)”?') &&
        adText.includes(
          'Books that use it keep its values. New books will start with Generic.',
        ) &&
        still === 1 &&
        after.v === 'generic' &&
        after.empty === 1 &&
        !!after.badge?.includes('Default'),
      `printer-presets: Delete… confirms (title + Generic sentence), row kept until Delete; then gone and Generic is the default — ${JSON.stringify({ adText, still, ...after })}`,
    ).toBe(true)
    // Duplicate on a table-spine shop opens the editor on the copy; the spine row is read-only text
    await click(S('print-duplicate-saal-photo-book'))
    const tbl = {
      t: await page.locator('[data-testid="pp-spine-table"]').textContent(),
      f: await page.locator('[data-testid="pp-spineBase"]').count(),
      name: await page.locator('[data-testid="pp-name"] input').inputValue(),
    }
    const customs = page.locator(
      '[data-scenario] [data-testid^="print-custom-custom-"]',
    )
    const added = await customs.count()
    await click(page.locator('[data-testid="pp-save"]'))
    const saved = await customs.count()
    expect(
      tbl.t === 'From the Saal Digital · Photo Book table · 7–13 mm' &&
        tbl.f === 0 &&
        tbl.name === 'Saal Digital · Photo Book (copy)' &&
        added === 1 &&
        saved === 1,
      `printer-presets: Duplicate Saal adds the copy row and opens the editor on “… (copy)”, table spine read-only; Save keeps one row — ${JSON.stringify({ ...tbl, added, saved })}`,
    ).toBe(true)
    await pick('print-empty')
    const empty = await S('print-custom-empty').evaluate(
      (e) =>
        `${e.textContent} ${getComputedStyle(e).fontSize} ${getComputedStyle(e).color}`,
    )
    expect(empty, 'printer-presets: print-empty row text 13 #535152').toBe(
      'No custom profiles yet. Duplicate a print shop’s profile, or start a new one. 13px rgb(83, 81, 82)',
    )
    await pick('print-edit')
    const dlg = await page
      .locator('[data-testid="print-profile-dialog"]')
      .evaluate((d: HTMLElement) => {
        // the profile editor's modal: the nearest ancestor 560 px wide (inline style)
        let m: HTMLElement | null = d
        while (m && m.style.width !== '560px') m = m.parentElement
        if (!m) throw new Error('no 560 px modal around the profile dialog')
        const mr = m.getBoundingClientRect()
        const ms = getComputedStyle(m)
        const cs = getComputedStyle(d)
        const q = (s: string) => {
          const e = d.querySelector(s)
          if (!e) throw new Error(`no ${s} in the profile dialog`)
          return e
        }
        const form = q('[data-testid="pp-form"]')
        const w = (t: string) =>
          q(`[data-testid="pp-${t}"]`).getBoundingClientRect()
        const f = getComputedStyle(q('[data-testid="pp-trimMin"]'))
        const lab = form.firstElementChild
          ? getComputedStyle(form.firstElementChild)
          : null
        return {
          w: mr.width,
          r: ms.borderRadius,
          bg: ms.backgroundColor,
          pad: cs.padding,
          cols: getComputedStyle(form).gridTemplateColumns.split(' ')[0],
          lab: lab && `${lab.fontSize} ${lab.color}`,
          f96: [w('trimMin').width, w('trimMin').height, w('pMax').width],
          f64: w('pStep').width,
          field: [`${f.backgroundColor} ${f.borderRadius}`, f.boxShadow],
          title: d.firstElementChild?.textContent,
          sub: q('[data-testid="pp-sub"]').textContent,
        }
      })
    expect(
      dlg.w === 560 &&
        dlg.r === '14px' &&
        dlg.bg === 'rgb(227, 225, 221)' &&
        dlg.pad === '20px 24px' &&
        dlg.cols === '132px' &&
        dlg.lab === '13px rgb(83, 81, 82)' &&
        dlg.f96.join() === '96,32,96' &&
        dlg.f64 === 64 &&
        `${String(dlg.field[0])} ${solid(dlg.field[1] ?? '')}` ===
          'rgb(216, 214, 210) 8px rgba(20, 20, 19, 0.06) 0px 1px 2px 0px' &&
        dlg.title === 'Edit print profile' &&
        dlg.sub ===
          'Based on Lulu · Photo book. Books that use this profile follow your changes.',
      `printer-presets: editor 560 wide, r14, bg #E3E1DD, padding 20 24, label column 132 (13 #535152), fields 96 × 32 / 64, field bg #D8D6D2 r8 shadow .06 — ${JSON.stringify(dlg)}`,
    ).toBe(true)
    const hint = () =>
      page.locator('[data-testid="pp-spine-hint"]').textContent()
    const h0 = await hint()
    await page.locator('[data-testid="pp-spinePer"] input').fill('0.3')
    await settled(page)
    const h1 = await hint()
    expect(
      h0 === '24 pages = 12.8 mm · 240 pages = 56 mm' &&
        h1 === '24 pages = 15.2 mm · 240 pages = 80 mm',
      `printer-presets: spine hint updates live — ${JSON.stringify({ h0, h1 })}`,
    ).toBe(true)
    await page.locator('[data-testid="pp-name"] input').fill('')
    await settled(page)
    const inv = {
      ring: await page
        .locator('[data-testid="pp-name"]')
        .evaluate((e) => getComputedStyle(e).boxShadow),
      msg: await page.locator('[data-testid="pp-error"]').allTextContents(),
      save: await page.locator('[data-testid="pp-save"]').isDisabled(),
    }
    expect(
      solid(inv.ring) === 'rgb(168, 64, 58) 0px 0px 0px 1px inset' &&
        inv.msg.join() === 'Give the profile a name.' &&
        inv.save,
      `printer-presets: empty name → #a8403a inset ring + message, Save disabled — ${JSON.stringify(inv)}`,
    ).toBe(true)
    await pick('print-invalid')
    const bad = {
      msg: await page.locator('[data-testid="pp-error"]').allTextContents(),
      save: await page.locator('[data-testid="pp-save"]').isDisabled(),
      title: await page
        .locator('[data-testid="print-profile-dialog"] > div')
        .first()
        .textContent(),
      color: await page
        .locator('[data-testid="pp-error"]')
        .first()
        .evaluate(
          (e) =>
            `${getComputedStyle(e).fontSize}/${getComputedStyle(e).lineHeight} ${getComputedStyle(e).color}`,
        ),
    }
    expect(
      bad.title === 'New print profile' &&
        bad.save &&
        bad.color === '12px/16.8px rgb(168, 64, 58)' &&
        bad.msg.join('|') ===
          'Give the profile a name.|The largest side can’t be smaller than the smallest.|20 to 121 isn’t whole steps of 2. Try 120 or 122.',
      `printer-presets: print-invalid shows name / trim / page-count messages 12/16.8 #a8403a, Save disabled — ${JSON.stringify(bad)}`,
    ).toBe(true)
    // Designer review (PR #500): Save stays in view on a short viewport; the form body scrolls instead
    await page.setViewportSize({ width: 1440, height: 700 })
    await settled(page)
    const short = await page
      .locator('[data-testid="print-profile-dialog"]')
      .evaluate((d: HTMLElement) => {
        let m: HTMLElement | null = d
        while (m && m.style.width !== '560px') m = m.parentElement
        if (!m) throw new Error('no 560 px modal around the profile dialog')
        const body = d.querySelector('[data-testid="pp-form"]')?.parentElement
        const save = d.querySelector('[data-testid="pp-save"]')
        if (!body || !save) throw new Error('no form body / Save')
        return {
          gap: +(
            m.getBoundingClientRect().bottom -
            save.getBoundingClientRect().bottom
          ).toFixed(2),
          sh: body.scrollHeight,
          ch: body.clientHeight,
        }
      })
    expect(
      short.gap >= 20 && short.sh > short.ch,
      `printer-presets: at 1440 × 700 Save sits ≥ 20 px above the modal bottom and the form scrolls — ${JSON.stringify(short)}`,
    ).toBe(true)
    await page.setViewportSize({ width: 1440, height: 900 })
    await settled(page)
    // Generic spine = core genericPrintProfile (8 + 0.2 mm per page); fields keep the stored value (Duplicate Lulu + Save keeps bleed 3.175)
    await pick('print')
    await click(S('print-new'))
    const newHint = await page
      .locator('[data-testid="pp-spine-hint"]')
      .textContent()
    await click(page.getByRole('button', { name: 'Cancel' }))
    expect(
      newHint,
      'printer-presets: New profile spine hint = Generic 20 pages = 12 mm · 120 pages = 32 mm',
    ).toBe('20 pages = 12 mm · 120 pages = 32 mm')
    const field = (k: string) =>
      page.locator(`[data-testid="pp-${k}"] input`).inputValue()
    await click(S('print-duplicate-lulu-photo-book'))
    const dup = { bleed: await field('bleed'), safe: await field('safe') }
    await click(page.locator('[data-testid="pp-save"]'))
    await click(
      page
        .locator('[data-scenario] [data-testid^="print-edit-custom-"]')
        .last(),
    )
    const kept = {
      bleed: await field('bleed'),
      name: await page.locator('[data-testid="pp-name"] input').inputValue(),
    }
    await click(page.getByRole('button', { name: 'Cancel' }))
    expect(
      dup.bleed === '3.175' &&
        dup.safe === '12.7' &&
        kept.bleed === '3.175' &&
        kept.name.startsWith('Lulu · Photo book (copy'),
      `printer-presets: Duplicate Lulu shows bleed 3.175 / safe 12.7 unrounded; after Save the copy still has bleed 3.175 — ${JSON.stringify({ dup, kept })}`,
    ).toBe(true)
    await page.goto('/uikit/#/feature/pdf-export')
    await expect(
      page.locator('[data-testid="print-profile"]').first(),
    ).toBeVisible()
    await settled(page)
    const P = (q: string) => page.locator(q).first().textContent()
    const pd = {
      row: await P('[data-testid="print-profile"]'),
      sum: await P('[data-testid="print-summary"]'),
      cb: await P('label:has-text("bleed and crop marks")'),
    }
    expect(
      pd.row === 'PrinterGeneric' &&
        pd.cb === 'Add 3 mm bleed and crop marks' &&
        !!pd.sum?.endsWith('· bleed 3 mm'),
      `printer-presets: PrintDialog Printer · Generic row, 3 mm bleed from the profile — ${JSON.stringify(pd)}`,
    ).toBe(true)
    // printer-presets: no console errors
    expect(errs).toEqual([])
  })

  test('printer-presets-kit-book (Designer printer-presets §Book settings → PRINT): offsets from the PRINT title', async ({
    page,
  }) => {
    const errs = watchErrors(page)
    const B = '[data-scenario] [data-testid="insp-book"]'
    const read = () =>
      page.evaluate((B) => {
        const q = (s: string) => {
          const e = document.querySelector<HTMLElement>(`${B} ${s}`)
          if (!e) throw new Error(`no ${s} in Book settings`)
          return e
        }
        const top = (e: Element) => e.getBoundingClientRect().top
        const h3 = (t: string) => {
          const h = [...document.querySelectorAll(`${B} h3`)].find(
            (h) => h.textContent === t,
          )
          if (!h) throw new Error(`no ${t} title in Book settings`)
          return h
        }
        const p0 = top(h3('Print'))
        const d = (e: Element) => +(top(e) - p0).toFixed(2)
        const sel = q('[data-testid="book-print-profile"]') as HTMLSelectElement
        const sr = sel.getBoundingClientRect()
        const cs = getComputedStyle(sel)
        const hintEl = q('[data-testid="book-print-hint"]')
        const hs = getComputedStyle(hintEl)
        /** the inspector scroller (qa shows scrollbars; prod measures 268 without one) */
        let sc: HTMLElement | null = sel
        while (
          sc &&
          !(
            sc.scrollHeight > sc.clientHeight &&
            /auto|scroll/.test(getComputedStyle(sc).overflowY)
          )
        )
          sc = sc.parentElement
        return {
          sel: {
            y: d(sel),
            w: +sr.width.toFixed(2),
            h: +sr.height.toFixed(2),
            bg: cs.backgroundColor,
            value: sel.value,
            groups: [...sel.querySelectorAll('optgroup')]
              .map((g) => `${g.label}:${String(g.children.length)}`)
              .join(),
          },
          hint: {
            y: d(hintEl),
            t: hintEl.textContent,
            font: `${hs.fontSize}/${hs.lineHeight}`,
          },
          /** the Page size select's width and the inspector scrollbar */
          sizeW: q('[data-testid="size-preset"]').getBoundingClientRect().width,
          sb: sc ? sc.offsetWidth - sc.clientWidth : NaN,
          issues: [
            ...document.querySelectorAll(
              `${B} [data-testid="book-print-issue"]`,
            ),
          ].map((e) => {
            const s = getComputedStyle(e)
            const i = e.querySelector('svg')?.getBoundingClientRect()
            return {
              y: d(e),
              h: +e.getBoundingClientRect().height.toFixed(2),
              t: e.textContent,
              c: `${s.fontSize}/${s.lineHeight} ${s.fontWeight} ${s.color}`,
              icon: `${String(i?.width)}×${String(i?.height)}`,
            }
          }),
          bs: d(q('[data-testid="book-bleed"]')),
          defaults: d(h3('Defaults')),
          b: q('[data-testid="book-bleed"]').textContent,
          s: q('[data-testid="book-safe"]').textContent,
          range: q('[data-testid="book-pages-range"]').textContent,
          size: `${(q('[data-testid="size-w"]') as HTMLInputElement).value}×${(q('[data-testid="size-h"]') as HTMLInputElement).value}`,
          pages: q('[data-testid="book-pages"]').firstChild?.textContent,
        }
      }, B)
    const near = (a: number, b: number) => Math.abs(a - b) <= 0.5
    await page.goto('/uikit/#/feature/inspector')
    await expect(page.getByTestId('demo')).toBeVisible()
    await settled(page)
    await scenarioTab(page, 'Book settings')
    const g = await read()
    expect(
      g.sel.w + g.sb === 268 &&
        g.sel.w === g.sizeW &&
        g.sel.h === 32 &&
        g.sel.bg === 'rgb(216, 214, 210)' &&
        near(g.sel.y, 26.84) &&
        g.sel.groups === 'Print shops:3,Custom:1' &&
        g.sel.value === 'generic',
      `printer-presets-kit-book: Printer select 268 (+ scrollbar) × 32 = Page size select, bg #D8D6D2 under the PRINT title, optgroups Print shops (3) / Custom (1), Generic — ${JSON.stringify({ ...g.sel, sizeW: g.sizeW, sb: g.sb })}`,
    ).toBe(true)
    expect(
      near(g.hint.y, 64.84) &&
        g.hint.t === '5–50 cm · 20–120 pages · photos ≥ 200 ppi' &&
        g.hint.font === '11px/16px',
      `printer-presets-kit-book: hint 2xs/16 under the select (+38), Generic text — ${JSON.stringify(g.hint)}`,
    ).toBe(true)
    expect(
      !g.issues.length &&
        near(g.bs, 92.84) &&
        near(g.defaults, 195.69) &&
        g.b === 'B3mm' &&
        g.s === 'S5mm' &&
        g.range === '20–120',
      `printer-presets-kit-book: no warnings → B/S and DEFAULTS 66 px lower (B/S +92.84, DEFAULTS +195.69 = 788.61 → 854.61 from 658.92), B 3 / S 5, Pages 20–120 — ${JSON.stringify({ bs: g.bs, defaults: g.defaults, b: g.b, s: g.s, range: g.range })}`,
    ).toBe(true)
    await page
      .locator(`${B} [data-testid="book-print-profile"]`)
      .selectOption('lulu-photo-book')
    await settled(page)
    const lu = await read()
    const live = await page.locator(`${B} [aria-live="polite"]`).textContent()
    await page.keyboard.press('Control+z')
    await settled(page)
    const un = await read()
    expect(
      lu.sel.value === 'lulu-photo-book' &&
        lu.b === 'B3.175mm' &&
        lu.s === 'S12.7mm' &&
        lu.size === g.size &&
        lu.pages === g.pages &&
        lu.issues.length === 1 &&
        near(lu.defaults - g.defaults, 8 + 2 * 16.8) &&
        live === 'Printer: Lulu · Photo book' &&
        un.sel.value === 'generic' &&
        un.b === 'B3mm' &&
        un.s === 'S5mm' &&
        !un.issues.length &&
        near(un.defaults, g.defaults),
      `printer-presets-kit-book: pick Lulu = one undo step: B 3.175 / S 12.7, size and pages unchanged, 1 warning (+8 + 2 × 16.8), live “Printer: Lulu · Photo book”; Ctrl+Z → Generic, B 3 / S 5 — ${JSON.stringify({ lu: [lu.b, lu.s, lu.size, lu.pages, lu.issues.length, lu.defaults], live, un: [un.sel.value, un.b, un.s, un.defaults] })}`,
    ).toBe(true)
    await scenarioTab(page, 'Lulu picked')
    const w = await read()
    const [i0, i1] = w.issues
    expect(
      w.issues.length === 2 &&
        i0 !== undefined &&
        i1 !== undefined &&
        w.issues.every(
          (i) =>
            i.c === '12px/16.8px 400 rgb(138, 90, 18)' && i.icon === '12×12',
        ) &&
        near(i0.y, 64.84 + 16 + 8) &&
        near(i1.y, i0.y + i0.h + 8) &&
        near(
          w.defaults - g.defaults,
          w.issues.reduce((s, i) => s + 8 + i.h, 0),
        ) &&
        w.issues.every((i) => near(i.h, 16.8 * Math.round(i.h / 16.8))) &&
        i0.t ===
          'Lulu · Photo book takes pages from 15.2 cm. This page is 15 cm wide.' &&
        i1.t ===
          'Lulu · Photo book prints at least 24 pages; this book’s 20 print as 24.',
      `printer-presets-kit-book: book-lulu shows 2 warnings 12/16.8 400 #8a5a12 with a 12 px icon, 8 px apart, each adding 8 + 16.8 per line — ${JSON.stringify(w.issues)}`,
    ).toBe(true)
    // paint: scrolled into view, each warning's text and icon are the topmost elements at their centres
    const paint = await page.evaluate(
      (B) =>
        [
          ...document.querySelectorAll(`${B} [data-testid="book-print-issue"]`),
        ].map((e) => {
          e.scrollIntoView({ block: 'center' })
          const at = (el: Element | null) => {
            if (!el) return false
            const r = el.getBoundingClientRect()
            const x = el === e ? r.right - 24 : r.left + r.width / 2
            return e.contains(
              document.elementFromPoint(x, r.top + r.height / 2),
            )
          }
          return at(e) && at(e.querySelector('svg'))
        }),
      B,
    )
    expect(
      paint.length === 2 && paint.every(Boolean),
      `printer-presets-kit-book: both warnings paint on top (elementFromPoint at text and icon) — ${JSON.stringify(paint)}`,
    ).toBe(true)
    // printer-presets-kit-book: no console errors
    expect(errs).toEqual([])
  })
})
