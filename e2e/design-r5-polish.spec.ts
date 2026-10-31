import type { Locator, Page } from '@playwright/test'
import { existsSync } from 'node:fs'
import { expect, test } from './fixtures/coverage'
import { dragPlaceFirstFilmstripItem } from './fixtures/dropAssetOnFrame'
import {
  ensurePhotoFixtures,
  photoFixturePaths,
} from './fixtures/ensurePhotoFixtures'
import { applyContactSheet } from './fixtures/layoutTiles'
import { openSessionEditor } from './fixtures/openSessionEditor'
import {
  choosePhotoFolder,
  installPhotoDirectoryPickerStub,
} from './fixtures/photoDirectoryPicker'

// Designer round 5 (2026-10-31, NOT PASS on prod e43a591). Kit values were
// measured on the rendered kit `uikit#/demo` (v0.10.0, built dist) at
// 1440 × 900 with the demo-capture walk and the same DOM reads as below
// (getBoundingClientRect / getComputedStyle):
//
// M43 step 17 (down on the frame centre, six moves of (−10i, +6i)): the source
//     frame dims to opacity 0.4; its photo keeps rect and crop (img style and
//     transform identical to step 16); 8 handles stay visible. The source is
//     its own drop target: tint overlay inset 0 (parent at 20 %), and the
//     "Release to replace" chip 8 px below the frame top, centred (offset 0),
//     111 × 18.84 (2 px + 11 px × 1.35 + 2 px), 11 px text, 8 px radius.
//     Step 18 (Escape, up): opacity 1, same photo.
// M44 top bar "‹ Library": button left 12, padding-left 6 px, chevron svg
//     left 18, 16 × 16 (24-unit viewBox, stroke ink from x 24), chevron-label
//     gap 4 px, label left 38.

const KIT = {
  sourceOpacity: '0.4',
  handles: 8,
  chip: {
    text: 'Release to replace',
    top: 8,
    centreOffset: 0,
    width: 111,
    height: 18.84375,
    font: '11px',
    radius: '8px',
  },
  tintAlpha: 0.2,
  library: {
    left: 12,
    paddingLeft: '6px',
    chevronLeft: 18,
    chevronSize: 16,
    chevronInkLeft: 24,
    gap: '4px',
    labelLeft: 38,
  },
} as const

interface Rect {
  left: number
  top: number
  width: number
  height: number
}

function near(actual: number, expected: number, tolerance: number): void {
  expect(
    Math.abs(actual - expected),
    `${String(actual)} vs ${String(expected)}`,
  ).toBeLessThanOrEqual(tolerance)
}

function nearRect(actual: Rect, expected: Rect, tolerance: number): void {
  near(actual.left, expected.left, tolerance)
  near(actual.top, expected.top, tolerance)
  near(actual.width, expected.width, tolerance)
  near(actual.height, expected.height, tolerance)
}

test.beforeAll(() => {
  // Generate the PNG only when missing: workers race on rewrites.
  if (!existsSync(photoFixturePaths.samplePng)) {
    ensurePhotoFixtures({ includeLargeJpeg: false })
  }
})

test.describe('M43 the drag source keeps its photo while dragged', () => {
  interface PseudoBox {
    content: string
    left: number
    top: number
    width: number
    height: number
    translateX: number
    background: string
    font: string
    radius: string
  }

  interface FrameRead {
    frame: Rect
    image: Rect
    imageStyle: string | null
    imageTransform: string
    opacity: string
    dragSource: string | null
    dropHover: string | null
    handles: number
    before: PseudoBox
    after: PseudoBox
  }

  async function readFrame(frame: Locator): Promise<FrameRead> {
    return frame.evaluate((el) => {
      const box = (r: DOMRect) => ({
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      })
      const pseudo = (which: '::before' | '::after') => {
        const cs = getComputedStyle(el, which)
        return {
          content: cs.content,
          left: parseFloat(cs.left),
          top: parseFloat(cs.top),
          width: parseFloat(cs.width),
          height: parseFloat(cs.height),
          translateX:
            cs.transform === 'none' ? 0 : new DOMMatrix(cs.transform).m41,
          background: cs.backgroundColor,
          font: cs.fontSize,
          radius: cs.borderTopLeftRadius,
        }
      }
      const image = el.querySelector<HTMLElement>('.spread-frame-image')
      if (image === null) {
        throw new Error('no photo in the frame')
      }
      const handles = [
        ...el.querySelectorAll<HTMLElement>('[data-testid="sel-handle"]'),
      ].filter((h) => {
        const r = h.getBoundingClientRect()
        return (
          getComputedStyle(h).visibility === 'visible' &&
          r.width > 0 &&
          r.height > 0
        )
      })
      return {
        frame: box(el.getBoundingClientRect()),
        image: box(image.getBoundingClientRect()),
        imageStyle: image.getAttribute('style'),
        imageTransform: getComputedStyle(image).transform,
        opacity: getComputedStyle(el).opacity,
        dragSource: el.getAttribute('data-drag-source'),
        dropHover: el.getAttribute('data-drop-hover'),
        handles: handles.length,
        before: pseudo('::before'),
        after: pseudo('::after'),
      }
    })
  }

  /** Kit steps 15–16: a dropped photo, then a click on its (selected) frame. */
  async function placedAndSelected(page: Page): Promise<Locator> {
    await page.setViewportSize({ width: 1440, height: 900 })
    await installPhotoDirectoryPickerStub(page)
    await openSessionEditor(page)
    await choosePhotoFolder(page, [photoFixturePaths.samplePng])
    await expect(page.getByTestId('filmstrip-thumb')).toHaveCount(1, {
      timeout: 30_000,
    })
    await applyContactSheet(page, 2, 2)
    await dragPlaceFirstFilmstripItem(page, 0, { keepSelection: true })
    const frame = page.locator(
      '[data-testid="spread-frame"][data-filled="true"]',
    )
    await expect(frame).toHaveCount(1, { timeout: 30_000 })
    await frame.click()
    await expect(frame).toHaveAttribute('aria-pressed', 'true')
    return frame
  }

  /** The kit capture walk: down on the frame centre, six moves of (−10i, +6i). */
  async function startKitDrag(page: Page, frame: Rect): Promise<void> {
    const x = Math.round(frame.left + frame.width / 2)
    const y = Math.round(frame.top + frame.height / 2)
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (let i = 1; i <= 6; i += 1) {
      await page.mouse.move(x - 10 * i, y + 6 * i)
    }
  }

  function expectPhotoUnchanged(read: FrameRead, rest: FrameRead): void {
    nearRect(read.frame, rest.frame, 0.5)
    nearRect(read.image, rest.image, 0.5)
    expect(read.imageStyle).toBe(rest.imageStyle)
    expect(read.imageTransform).toBe(rest.imageTransform)
    expect(read.handles).toBe(KIT.handles)
  }

  test('step 17: dimmed source, photo rect and crop unchanged, kit chip; restored after release', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const frame = await placedAndSelected(page)
    const rest = await readFrame(frame)
    expect(rest.opacity).toBe('1')
    expect(rest.dropHover).toBeNull()
    expectPhotoUnchanged(rest, rest)

    await startKitDrag(page, rest.frame)
    await expect(frame).toHaveAttribute('data-drag-source', 'true')
    await expect(frame).toHaveAttribute('data-drop-hover', 'true')
    const mid = await readFrame(frame)
    expect(mid.opacity).toBe(KIT.sourceOpacity)
    expectPhotoUnchanged(mid, rest)

    // Kit drop overlay on the source: a 20 % tint over the whole frame…
    expect(mid.before.content).toBe('""')
    nearRect(
      mid.before,
      { left: 0, top: 0, width: rest.frame.width, height: rest.frame.height },
      0.5,
    )
    expect(mid.before.background).toMatch(/\/ 0\.2\)$|, 0\.2\)$/)
    // …and the chip, centred 8 px under the top: never a frame-wide block
    // covering the photo (r5: the selection ring's inset 0 stretched it).
    const chip = mid.after
    expect(chip.content).toBe(`"${KIT.chip.text}"`)
    near(chip.top, KIT.chip.top, 0.5)
    near(
      chip.left + chip.translateX + chip.width / 2 - rest.frame.width / 2,
      KIT.chip.centreOffset,
      0.5,
    )
    near(chip.width, KIT.chip.width, 0.5)
    near(chip.height, KIT.chip.height, 0.5)
    expect(chip.font).toBe(KIT.chip.font)
    expect(chip.radius).toBe(KIT.chip.radius)

    // Kit step 18: Escape, then up. Everything is back.
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await expect(frame).not.toHaveAttribute('data-drag-source', 'true')
    await expect(frame).not.toHaveAttribute('data-drop-hover', 'true')
    const after = await readFrame(frame)
    expect(after.opacity).toBe('1')
    expectPhotoUnchanged(after, rest)
    expect(after.after.content).toBe('""')
    nearRect(
      after.after,
      { left: 0, top: 0, width: rest.frame.width, height: rest.frame.height },
      0.5,
    )
  })

  test('released back on itself: a no-op, the photo stays at its crop', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const frame = await placedAndSelected(page)
    const rest = await readFrame(frame)
    await startKitDrag(page, rest.frame)
    await expect(frame).toHaveAttribute('data-drag-source', 'true')
    await page.mouse.up()
    await expect(frame).not.toHaveAttribute('data-drag-source', 'true')
    await expect(frame).not.toHaveAttribute('data-drop-hover', 'true')
    const after = await readFrame(frame)
    expect(after.opacity).toBe('1')
    expectPhotoUnchanged(after, rest)
    await expect(
      page.locator('[data-testid="spread-frame"][data-filled="true"]'),
    ).toHaveCount(1)
  })
})

test.describe('M44 top-bar Library link inset', () => {
  test('1440 × 900: button, chevron and label sit at the kit x', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openSessionEditor(page)
    const button = page.getByTestId('go-library')
    await expect(button).toBeVisible()
    const read = await button.evaluate((el) => {
      const cs = getComputedStyle(el)
      const svg = el.querySelector('svg')
      const path = svg?.querySelector('path, polyline')
      const label = [...el.childNodes].find(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim() !== '',
      )
      if (!svg || !path || !label) {
        throw new Error('Library button parts missing')
      }
      const range = document.createRange()
      range.selectNodeContents(label)
      const s = svg.getBoundingClientRect()
      return {
        left: el.getBoundingClientRect().left,
        paddingLeft: cs.paddingLeft,
        gap: cs.columnGap,
        chevron: { left: s.left, width: s.width, height: s.height },
        inkLeft: path.getBoundingClientRect().left,
        labelLeft: range.getBoundingClientRect().left,
        label: label.textContent?.trim(),
      }
    })
    expect(read.label).toBe('Library')
    near(read.left, KIT.library.left, 0.5)
    expect(read.paddingLeft).toBe(KIT.library.paddingLeft)
    near(read.chevron.left, KIT.library.chevronLeft, 0.5)
    near(read.chevron.width, KIT.library.chevronSize, 0.5)
    near(read.chevron.height, KIT.library.chevronSize, 0.5)
    near(read.inkLeft, KIT.library.chevronInkLeft, 0.5)
    expect(read.gap).toBe(KIT.library.gap)
    near(read.labelLeft, KIT.library.labelLeft, 0.5)
  })
})
