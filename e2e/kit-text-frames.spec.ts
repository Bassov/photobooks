import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures/coverage'

// Kit text frames (moved from uikit/scripts/qa.mjs text-frames, uikit-qa-split-6): on #/demo,
// a 19 × 23 cm book, spread 2–3: Text click / drag, the edit look, whole lines, the Overflow chip,
// content growth (canvas and inspector), Enter / Text press / Esc on a drag. One stateful walk,
// like qa.mjs. The test also fails on a console error / warning, page error or failed request,
// like qa.mjs (qa.mjs runs with scrollbars shown, so this spec does too).

test.use({
  viewport: { width: 1440, height: 900 },
  // qa.mjs Chrome: scrollbars shown, unhinted (fractional) text widths
  launchOptions: {
    ignoreDefaultArgs: ['--hide-scrollbars'],
    args: ['--font-render-hinting=none'],
  },
})

const DEMO = '[data-testid="demo"]'
const PAPER = '[data-testid="canvas"] [data-testid="spread"][data-current]'

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

interface DemoApi {
  reset: () => void
}

async function boxOf(l: Locator) {
  const b = await l.boundingBox()
  if (b === null) throw new Error('locator has no box')
  return b
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** the current spread: frames, own text frames, the edit box, the visible body, the Overflow chip, inspector meta */
const read = (page: Page) =>
  page.evaluate((ps) => {
    const p = document.querySelector(ps)
    if (!p) throw new Error('no current spread')
    const r = (e: Element): Rect => {
      const { x, y, width, height } = e.getBoundingClientRect()
      return { x, y, w: width, h: height }
    }
    // own text frames only (the master's inherited caption is a master-frame)
    const tf = [...p.querySelectorAll('[data-testid="frame"]')].filter((f) =>
      f.querySelector('[data-testid="text-body"], [data-testid="text-edit"]'),
    )
    const ta = p.querySelector<HTMLTextAreaElement>(
      '[data-testid="frame"] [data-testid="text-edit"] textarea',
    )
    const body = tf
      .at(-1)
      ?.querySelector<HTMLElement>('[data-testid="text-body"]')
    const chip = p.querySelector('[data-testid="text-overflow-chip"]')
    const metaSpan = document.querySelector(
      '[data-testid="inspector-meta"] span',
    )
    return {
      frames: p.querySelectorAll('[data-testid="frame"]').length,
      texts: tf.map(r),
      editing: !!ta,
      focused: !!ta && document.activeElement === ta,
      handles: p.querySelectorAll('[data-testid="handles"]').length,
      edit: ta && {
        bg: getComputedStyle(ta).backgroundColor,
        ph: ta.placeholder,
        value: ta.value,
        outline: ta.parentElement
          ? getComputedStyle(ta.parentElement).outlineWidth
          : null,
      },
      body: body && {
        h: body.getBoundingClientRect().height,
        lh: parseFloat(getComputedStyle(body).lineHeight),
        sh: body.scrollHeight,
      },
      chip: chip && {
        ...r(chip),
        text: chip.textContent,
        color: getComputedStyle(chip).color,
      },
      meta:
        document.querySelector('[data-testid="inspector-meta"]')?.textContent ??
        null,
      metaColor: metaSpan ? getComputedStyle(metaSpan).color : null,
    }
  }, PAPER)

/** visible text height in line heights */
const lineCount = (body: { h: number; lh: number } | null | undefined) =>
  body ? body.h / body.lh : undefined

const whole = (n: number | undefined) =>
  n !== undefined && Math.abs(n - Math.round(n)) < 0.01

test('text-frames (Designer text-frames Spec "Kit changes"): Text click / drag, edit look, whole lines, Overflow chip, grow, inspector', async ({
  page,
}) => {
  const errs = watchErrors(page)
  await page.goto('/uikit/#/demo')
  await expect(page.getByTestId('demo')).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { __demo: DemoApi }).__demo.reset()
  })
  await settled(page)
  // dialogs portal outside the demo root
  const c = async (sel: string) => {
    await page.locator(sel).first().click()
    await settled(page)
  }
  await c('[data-testid="create-library"]')
  await c('[data-testid="picker-select"]')
  await c(`${DEMO} [data-testid="new-book"]`)
  await page.locator('[role=dialog] input').first().fill('Lake trip')
  await page
    .locator('[role=dialog]')
    .getByRole('button', { name: /A5|A4|Square|cm/ })
    .first()
    .click()
  await settled(page)
  await page.getByRole('option', { name: /Custom size/ }).click()
  await settled(page)
  await page.fill('[data-testid="create-custom-w"]', '19')
  await page.fill('[data-testid="create-custom-h"]', '23')
  await c('[data-testid="create-book"]')
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await c('[data-item="p1"]')
  const paper = await boxOf(page.locator(PAPER))
  const sc = paper.width / 380 // 19 × 23 cm book: a spread is 380 mm wide
  const s0 = await read(page)
  const tool = () => c('[aria-label="Text (T)"]')
  // a click near the bottom-right corner: 60 × 14 mm, clamped into the right page's 6 mm safe area, editing at once
  await tool()
  await page.mouse.click(
    Math.round(paper.x + paper.width - 3),
    Math.round(paper.y + paper.height - 3),
  )
  await settled(page)
  const s1 = await read(page)
  const t1 = s1.texts.at(-1)
  expect(
    s1.frames === s0.frames + 1 &&
      s1.focused &&
      s1.edit?.ph === 'Type text' &&
      s1.edit.value === '' &&
      s1.edit.bg === 'rgba(0, 0, 0, 0)' &&
      s1.edit.outline === '1px' &&
      s1.handles === 0 &&
      t1 !== undefined &&
      Math.abs(t1.w - 60 * sc) <= 1 &&
      Math.abs(t1.h - 14 * sc) <= 1,
    `text-frames: Text click → one 60 × 14 mm frame in edit mode (focused, \`Type text\`, transparent, 1 px outline, no handles) — ${JSON.stringify({ s0: s0.frames, ...s1, sc })}`,
  ).toBe(true)
  expect(
    t1 !== undefined &&
      paper.x + paper.width - (t1.x + t1.w) >= 6 * sc - 1 &&
      paper.y + paper.height - (t1.y + t1.h) >= 6 * sc - 1,
    `text-frames: the click frame is clamped inside the page's 6 mm safe area — ${JSON.stringify({ t1, paper })}`,
  ).toBe(true)
  await page.keyboard.press('Escape')
  await settled(page)
  const s2 = await read(page)
  expect(
    s2.frames === s0.frames && !s2.editing,
    `text-frames: Esc on an empty new frame removes it — ${JSON.stringify(s2)}`,
  ).toBe(true)
  // a drag (over whatever lies there, photo frames included) + typing, Esc, Title → whole lines + Overflow chip + inspector meta
  await tool()
  const x = Math.round(paper.x + paper.width * 0.56)
  const y = Math.round(paper.y + paper.height * 0.62)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 200, y + 36, { steps: 6 })
  await page.mouse.up()
  await settled(page)
  await page.keyboard.type('Morning on the lake, 6:40')
  await page.keyboard.press('Escape')
  await settled(page)
  const s3 = await read(page)
  expect(
    s3.frames === s0.frames + 1 && !s3.editing && s3.handles === 1 && !s3.chip,
    `text-frames: drag + type + Esc keeps the frame selected with handles, no chip (caption fits) — ${JSON.stringify(s3)}`,
  ).toBe(true)
  await page
    .locator('[data-testid="ctx-inspector"]')
    .getByText('Title', { exact: true })
    .click()
  await settled(page)
  const s4 = await read(page)
  const t4 = s4.texts.at(-1)
  const lines = lineCount(s4.body)
  expect(
    !!s4.body &&
      t4 !== undefined &&
      whole(lines) &&
      Math.round(lines ?? 0) >= 1 &&
      s4.body.h <= t4.h + 0.5 &&
      s4.body.sh > s4.body.h,
    `text-frames: Title in a 36 px box shows whole lines only (visible height = n × line height ≤ box) — ${JSON.stringify({ body: s4.body, t4 })}`,
  ).toBe(true)
  expect(
    s4.chip?.text === 'Overflow' &&
      t4 !== undefined &&
      Math.abs(s4.chip.y - (t4.y + t4.h + 4)) <= 1 &&
      Math.abs(s4.chip.x + s4.chip.w - (t4.x + t4.w)) <= 1 &&
      s4.chip.color === 'rgb(132, 85, 16)' &&
      Math.abs(s4.chip.h - 14) <= 0.5,
    `text-frames: Overflow chip 4 px below the frame, right-aligned, amber — ${JSON.stringify({ chip: s4.chip, t4 })}`,
  ).toBe(true)
  expect(
    s4.meta === 'Text overflows the frame' &&
      s4.metaColor === 'rgb(132, 85, 16)',
    `text-frames: inspector meta \`Text overflows the frame\` rgb(132, 85, 16) — ${JSON.stringify({ meta: s4.meta, c: s4.metaColor })}`,
  ).toBe(true)
  // a content edit grows the box to whole lines: no overflow after the edit
  await page
    .locator(PAPER)
    .locator('[data-testid="text-body"]')
    .last()
    .dblclick()
  await settled(page)
  await page.keyboard.press('End')
  await page.keyboard.type(' by the pier')
  await page.keyboard.press('Escape')
  await settled(page)
  const s5 = await read(page)
  const t5 = s5.texts.at(-1)
  const n5 = lineCount(s5.body)
  expect(
    t5 !== undefined &&
      t4 !== undefined &&
      t5.h > t4.h + 1 &&
      !s5.chip &&
      s5.meta === null &&
      whole(n5) &&
      !!s5.body &&
      Math.abs(t5.h - s5.body.h) <= 1,
    `text-frames: a content edit grows the box to whole lines (taller, no chip, no meta) — ${JSON.stringify({ t4, t5, body: s5.body })}`,
  ).toBe(true)
  // inspector TEXT textarea: grows to 160 then scrolls; focus = inset 1 px #535152
  const ita = page.locator(
    '[data-testid="ctx-inspector"] textarea[aria-label="Text"]',
  )
  await ita.focus()
  await settled(page)
  const ti = await ita.evaluate((e) => {
    const s = getComputedStyle(e)
    return { max: s.maxHeight, oy: s.overflowY, shadow: s.boxShadow }
  })
  expect(
    ti.max === '160px' &&
      ti.oy === 'auto' &&
      ti.shadow.includes('rgb(83, 81, 82) 0px 0px 0px 1px inset'),
    `text-frames: inspector textarea max-height 160, scrolls, focus ring inset 1 px #535152 — ${JSON.stringify(ti)}`,
  ).toBe(true)
  await ita.blur()
  // review #445: an inspector content edit grows the box to whole lines like the canvas edit, capped at the paper bottom
  await ita.fill(['Lake', 'Pier', 'Boats', 'Dock', 'Pines', 'Dusk'].join('\n'))
  await settled(page)
  const s6 = await read(page)
  const t6 = s6.texts.at(-1)
  const n6 = lineCount(s6.body)
  expect(
    t6 !== undefined &&
      t5 !== undefined &&
      t6.h > t5.h + 1 &&
      !s6.chip &&
      s6.meta === null &&
      whole(n6) &&
      Math.round(n6 ?? 0) >= 6,
    `text-frames: inspector TEXT edit grows the box to whole lines (taller, no chip, no meta) — ${JSON.stringify({ t5, t6, body: s6.body })}`,
  ).toBe(true)
  await ita.fill(
    Array.from({ length: 14 }, (_, i) => `Line ${String(i + 1)}`).join('\n'),
  )
  await settled(page)
  const s7 = await read(page)
  const t7 = s7.texts.at(-1)
  expect(
    t7 !== undefined &&
      Math.abs(t7.y + t7.h - (paper.y + paper.height)) <= 1 &&
      !!s7.chip,
    `text-frames: inspector TEXT growth stops at the paper bottom (then the chip shows) — ${JSON.stringify({ t7, paper, chip: s7.chip })}`,
  ).toBe(true)
  await ita.blur()
  // review #445: Enter on one selected text frame (Select tool) edits it, caret at the end
  await page.locator(PAPER).locator('[data-testid="text-body"]').last().click()
  await settled(page)
  await page.keyboard.press('Enter')
  await settled(page)
  const s8 = await read(page)
  const caret = await page.evaluate(() => {
    const t = document.activeElement
    return t instanceof HTMLTextAreaElement
      ? { at: t.selectionStart, len: t.value.length }
      : null
  })
  expect(
    s8.editing &&
      s8.focused &&
      caret !== null &&
      caret.at === caret.len &&
      caret.len > 0,
    `text-frames: Enter on a selected text frame starts editing, caret at the end — ${JSON.stringify({ editing: s8.editing, caret })}`,
  ).toBe(true)
  await page.keyboard.press('Escape')
  await settled(page)
  // review #445 (Designer decision): Text pressed on a text frame edits it and the tool returns to Select
  await tool()
  await page.locator(PAPER).locator('[data-testid="text-body"]').last().click()
  await settled(page)
  const s9 = await read(page)
  const toolSel = await page
    .locator('[aria-label="Select (V)"]')
    .getAttribute('data-selected')
  expect(
    s9.editing && toolSel === 'true',
    `text-frames: Text press on a text frame edits it, the tool returns to Select — ${JSON.stringify({ editing: s9.editing, toolSel })}`,
  ).toBe(true)
  await page.keyboard.press('Escape')
  await settled(page)
  // review #445: Esc during a Text drag cancels (no frame, no undo step)
  const undoLabel = () =>
    page
      .locator(`${DEMO} [data-testid="undo"]`)
      .first()
      .getAttribute('aria-label')
  const undo0 = await undoLabel()
  const s10a = await read(page)
  await tool()
  await page.mouse.move(x - 120, y - 120)
  await page.mouse.down()
  await page.mouse.move(x - 20, y - 90, { steps: 5 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await settled(page)
  const s10 = await read(page)
  const undo1 = await undoLabel()
  expect(
    s10.frames === s10a.frames && !s10.editing && undo1 === undo0,
    `text-frames: Esc during a Text drag cancels (no frame, no edit, no undo step) — ${JSON.stringify({ before: s10a.frames, after: s10.frames, undo0, undo1 })}`,
  ).toBe(true)
  // text-frames: no console errors
  expect(errs).toEqual([])
})
