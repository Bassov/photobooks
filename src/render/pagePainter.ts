import {
  getSpreadPageCount,
  pagesOf,
  resolveSpread,
  type Book,
  type ResolvedFolio,
  type ResolvedItem,
  type ResolvedText,
} from '../core'
import { frameBox, type PxBox } from './frameBox'
import { adjustFilter, frameStyleCss } from './frameLookCss'
import { turnedPhotoStyle } from './photoLayout'
import {
  PHOTO_CAPTION_SIZE_MM,
  TEXT_COLOR,
  textNodeStyle,
  textStyleFonts,
} from './textStyles'

/**
 * Canvas 2D page painter (Designer D39): one physical page of the book as
 * `SpreadView` prints it, for the site reader's page faces. Only the context
 * API and the font set are used, so it also runs in a worker.
 */

export type PageContext =
  CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

/** A decoded (EXIF-oriented) photo per asset id. */
export type PageImage =
  ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas

/** `--paper` (styles/tokens.css): the page colour default and frame fill. */
const PAPER = '#ffffff'
/** `--muted-foreground` (styles/tokens.css): `.spread-frame-caption` colour. */
const CAPTION_COLOR = '#535152'
/** `--font-ui` (styles/tokens.css): captions and folios. */
const UI_FONT = "'Inter Variable', Inter, sans-serif"
/** `SpreadView` CAPTION_GAP_MM: the caption sits 1.5 mm under the frame. */
const CAPTION_GAP_MM = 1.5
/** `.spread-frame-caption` / `.spread-view-folio` line heights. */
const CAPTION_LINE_HEIGHT = 1.3
const FOLIO_LINE_HEIGHT = 1.4
const ELLIPSIS = '…'
const FULL_CROP = { x: 0, y: 0, width: 1, height: 1 } as const

interface FontSource {
  load(font: string, text?: string): Promise<unknown>
}

/**
 * Lines of `text` in a box `maxWidth` wide, as CSS `white-space: pre-wrap;
 * overflow-wrap: anywhere` breaks them: hard breaks, then greedy at spaces
 * (trailing spaces hang), and a word wider than the box splits anywhere.
 */
export function breakTextLines(
  measure: (text: string) => number,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const token of paragraph.match(/[^ ]+ *| +/g) ?? []) {
      if (measure((line + token).trimEnd()) <= maxWidth) {
        line += token
        continue
      }
      if (line !== '') {
        lines.push(line.trimEnd())
        line = ''
      }
      const word = token.trimEnd()
      for (const char of word) {
        if (line !== '' && measure(line + char) > maxWidth) {
          lines.push(line)
          line = ''
        }
        line += char
      }
      line += token.slice(word.length)
    }
    lines.push(line.trimEnd())
  }
  return lines
}

/** Physical page `page` (1-based): its spread and left edge in spread mm. */
function pageSpread(
  book: Book,
  page: number,
): { spreadId: string; offsetMm: number } {
  const count = book.spreads.length
  const spread = book.spreads[Math.floor(page / 2)]
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > pagesOf(count) ||
    spread === undefined
  ) {
    throw new RangeError(`no page ${String(page)} in the book`)
  }
  const twoPages = getSpreadPageCount(Math.floor(page / 2), count) === 2
  return {
    spreadId: spread.id,
    offsetMm: twoPages && page % 2 === 1 ? book.settings.trim.widthMm : 0,
  }
}

function imageSize(image: PageImage): { width: number; height: number } {
  return 'naturalWidth' in image
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : { width: image.width, height: image.height }
}

function fontSourceOf(): FontSource | undefined {
  const scope = globalThis as { document?: Document; fonts?: FontSource }
  return scope.document?.fonts ?? scope.fonts
}

/** Paint `rotate() translate() scale()` CSS transforms onto the context. */
function applyCssTransform(ctx: PageContext, transform: string): void {
  for (const [, name, args] of transform.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const [a = 0, b = 0] = (args ?? '').split(',').map((n) => parseFloat(n))
    if (name === 'rotate') ctx.rotate((a * Math.PI) / 180)
    if (name === 'translate') ctx.translate(a, b)
    if (name === 'scale') ctx.scale(a, b)
  }
}

/** `box-shadow` spread rings of `frameStyleCss`, topmost first. */
function shadowRings(boxShadow: unknown): { spread: number; color: string }[] {
  if (typeof boxShadow !== 'string') return []
  return [...boxShadow.matchAll(/0 0 0 ([\d.e+-]+)px ([^,]+)/g)].map(
    ([, spread = '0', color = PAPER]) => ({
      spread: parseFloat(spread),
      color: color.trim(),
    }),
  )
}

function roundedRect(
  ctx: PageContext,
  width: number,
  height: number,
  radius: number,
  grow = 0,
): void {
  ctx.beginPath()
  ctx.roundRect(
    -grow,
    -grow,
    width + 2 * grow,
    height + 2 * grow,
    radius > 0 ? radius + grow : 0,
  )
}

/**
 * The photo in its turned image box, about the frame centre. The crop window
 * comes from this image's aspect, so the box has it too (no `object-fit`).
 */
function paintPhoto(
  ctx: PageContext,
  item: ResolvedItem,
  image: PageImage,
  box: PxBox,
): void {
  const style = turnedPhotoStyle(
    box,
    item.sourceCropRect ?? FULL_CROP,
    item.photoQuarterTurns ?? 0,
    item.straightenDeg ?? 0,
    { h: item.photoFlipH === true, v: item.photoFlipV === true },
  )
  ctx.translate(box.width / 2, box.height / 2)
  applyCssTransform(ctx, style.transform)
  ctx.filter = adjustFilter(item.adjust) ?? 'none'
  // Downscaled photos: as smooth as the browser's `<img>` resampling.
  ctx.imageSmoothingQuality = 'high'
  const dest = snapRect(
    ctx,
    -style.width / 2,
    -style.height / 2,
    style.width,
    style.height,
  )
  ctx.drawImage(image, dest.left, dest.top, dest.width, dest.height)
}

/**
 * Chromium pixel-snaps the box of an untransformed `<img>`: under an
 * axis-aligned, unflipped transform the rect's edges round to device pixels.
 */
function snapRect(
  ctx: PageContext,
  left: number,
  top: number,
  width: number,
  height: number,
): PxBox {
  const m = ctx.getTransform()
  if (m.b !== 0 || m.c !== 0 || m.a <= 0 || m.d <= 0) {
    return { left, top, width, height }
  }
  const snap = (v: number, scale: number, offset: number) =>
    (Math.round(v * scale + offset) - offset) / scale
  const x0 = snap(left, m.a, m.e)
  const y0 = snap(top, m.d, m.f)
  return {
    left: x0,
    top: y0,
    width: snap(left + width, m.a, m.e) - x0,
    height: snap(top + height, m.d, m.f) - y0,
  }
}

function paintPhotoBody(
  ctx: PageContext,
  item: ResolvedItem,
  image: PageImage | undefined,
  box: PxBox,
  pxPerMm: number,
): void {
  const look = frameStyleCss(item.style, pxPerMm)
  const radius = typeof look.borderRadius === 'number' ? look.borderRadius : 0
  // `.spread-frame` paper, the rings outside the body, then the clipped body.
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, box.width, box.height)
  for (const ring of shadowRings(look.boxShadow).reverse()) {
    ctx.fillStyle = ring.color
    roundedRect(ctx, box.width, box.height, radius, ring.spread)
    ctx.fill()
  }
  roundedRect(ctx, box.width, box.height, radius)
  ctx.fillStyle = PAPER
  ctx.fill()
  if (image === undefined) return
  ctx.save()
  ctx.clip()
  paintPhoto(ctx, item, image, box)
  ctx.restore()
}

/** First line box baseline: half-leading above the font's ascent. */
function baseline(ctx: PageContext, sample: string, lineHeight: number) {
  const metrics = ctx.measureText(sample)
  const ascent = metrics.fontBoundingBoxAscent
  const content = ascent + metrics.fontBoundingBoxDescent
  return (lineHeight - content) / 2 + ascent
}

function alignX(align: CanvasTextAlign, width: number): number {
  if (align === 'center') return width / 2
  return align === 'right' ? width : 0
}

function paintText(
  ctx: PageContext,
  text: ResolvedText,
  box: PxBox,
  heightMm: number,
  pxPerMm: number,
): void {
  const style = textNodeStyle(text, heightMm, pxPerMm)
  const size = Number(style.fontSize)
  const lineHeight = size * Number(style.lineHeight)
  ctx.font = `${String(style.fontWeight)} ${String(size)}px ${String(style.fontFamily)}`
  ctx.fillStyle = TEXT_COLOR
  ctx.textAlign = text.align
  const lines = breakTextLines(
    (line) => ctx.measureText(line).width,
    text.text,
    box.width,
  )
  // Whole lines only (`wholeLinesHeightMm`): the node height is a multiple.
  const visible = Math.round(Number(style.height) / lineHeight)
  const y = baseline(ctx, 'Hg', lineHeight)
  lines.slice(0, visible).forEach((line, index) => {
    ctx.fillText(line, alignX(text.align, box.width), index * lineHeight + y)
  })
}

/** One line under the frame, cut with an ellipsis like `text-overflow`. */
function paintCaption(
  ctx: PageContext,
  caption: string,
  box: PxBox,
  pxPerMm: number,
): void {
  const size = PHOTO_CAPTION_SIZE_MM * pxPerMm
  const lineHeight = size * CAPTION_LINE_HEIGHT
  const top = box.height + CAPTION_GAP_MM * pxPerMm
  ctx.font = `400 ${String(size)}px ${UI_FONT}`
  ctx.fillStyle = CAPTION_COLOR
  ctx.textAlign = 'left'
  let line = caption
  if (ctx.measureText(line).width > box.width) {
    const chars = Array.from(caption)
    while (
      chars.length > 0 &&
      ctx.measureText(chars.join('') + ELLIPSIS).width > box.width
    ) {
      chars.pop()
    }
    line = chars.join('') + ELLIPSIS
  }
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, top, box.width, lineHeight)
  ctx.clip()
  ctx.fillText(line, 0, top + baseline(ctx, line, lineHeight))
  ctx.restore()
}

function paintItem(
  ctx: PageContext,
  item: ResolvedItem,
  images: ReadonlyMap<string, PageImage>,
  pxPerMm: number,
): void {
  const box = frameBox(item.rectMm, pxPerMm)
  ctx.save()
  ctx.translate(box.left + box.width / 2, box.top + box.height / 2)
  ctx.rotate((item.rotation * Math.PI) / 180)
  ctx.translate(-box.width / 2, -box.height / 2)
  if (item.text === undefined) {
    const image =
      item.assetId === undefined ? undefined : images.get(item.assetId)
    paintPhotoBody(ctx, item, image, box, pxPerMm)
  } else {
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, box.width, box.height)
    ctx.clip()
    paintText(ctx, item.text, box, item.rectMm.height, pxPerMm)
    ctx.restore()
  }
  if (item.caption !== undefined) {
    paintCaption(ctx, item.caption, box, pxPerMm)
  }
  ctx.restore()
}

function paintFolio(
  ctx: PageContext,
  folio: ResolvedFolio,
  pxPerMm: number,
): void {
  const box = frameBox(folio.rectMm, pxPerMm)
  const size = PHOTO_CAPTION_SIZE_MM * pxPerMm
  ctx.font = `400 ${String(size)}px ${UI_FONT}`
  ctx.fillStyle = TEXT_COLOR
  ctx.textAlign = folio.align
  const y = baseline(ctx, folio.text, size * FOLIO_LINE_HEIGHT)
  ctx.fillText(
    folio.text,
    box.left + alignX(folio.align, box.width),
    box.top + y,
  )
}

/** Stable by `z`, as positioned siblings stack. */
function byZ<T extends { z: number }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => a.z - b.z)
}

/**
 * Paint physical page `page` (1-based) of `book` at `pxPerMm` into `ctx` at
 * (0, 0): page colour, then `SpreadView`'s order — parent items and folios
 * (folios stack at z 0), then the spread's frames by `z` — clipped to the page.
 * Frames whose photo is not in `images` paint paper only.
 */
export async function paintPage(
  ctx: PageContext,
  book: Book,
  page: number,
  images: ReadonlyMap<string, PageImage>,
  pxPerMm: number,
): Promise<void> {
  const { spreadId, offsetMm } = pageSpread(book, page)
  const resolved = resolveSpread(book, spreadId, {
    getAspectRatio: (assetId) => {
      const image = images.get(assetId)
      const asset = book.assets[assetId]
      const size =
        image === undefined
          ? { width: asset?.widthPx ?? 1, height: asset?.heightPx ?? 1 }
          : imageSize(image)
      return size.width / size.height
    },
  })
  if (resolved === undefined) {
    throw new RangeError(`no page ${String(page)} in the book`)
  }
  const fonts = fontSourceOf()
  if (fonts !== undefined) {
    const sample = resolved.items
      .flatMap((item) => [item.text?.text ?? '', item.caption ?? ''])
      .concat((resolved.folios ?? []).map((folio) => folio.text))
      .join('')
    await Promise.all(
      textStyleFonts().map((font) => fonts.load(font, sample || ' ')),
    )
  }
  const width = book.settings.trim.widthMm * pxPerMm
  const height = resolved.spreadHeightMm * pxPerMm
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, width, height)
  ctx.clip()
  ctx.fillStyle = resolved.backgroundColor ?? PAPER
  ctx.fillRect(0, 0, width, height)
  ctx.translate(-offsetMm * pxPerMm, 0)
  const parentLayer = byZ([
    ...resolved.items
      .filter((item) => item.parent === true)
      .map((item) => ({ z: item.z, item })),
    ...(resolved.folios ?? []).map((folio) => ({ z: 0, folio })),
  ])
  for (const entry of parentLayer) {
    if ('item' in entry) paintItem(ctx, entry.item, images, pxPerMm)
    else paintFolio(ctx, entry.folio, pxPerMm)
  }
  for (const item of byZ(resolved.items.filter((i) => i.parent !== true))) {
    paintItem(ctx, item, images, pxPerMm)
  }
  ctx.restore()
}
