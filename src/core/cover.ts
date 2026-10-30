import {
  SPINE_WIDTH_MAX_MM,
  SPINE_WIDTH_MIN_MM,
  type Book,
  type Cover,
  type CoverStyle,
  type Endpapers,
} from './schema'
import { omitKey } from './omitKey'

/** Kit cover defaults: serif italic title, 12 mm spine, paper-white back, printed matte. */
export function defaultCoverStyle(): CoverStyle {
  return {
    titleFont: 'serif-italic',
    spineWidthMm: 12,
    spineDirection: 'top-to-bottom',
    // The kit canvas paints the back charcoal (`--cover-back`).
    backFill: '#3e3c3b',
    material: 'printed',
    finish: 'matte',
  }
}

/** A new book's cover text is its title (front and spine); the back starts blank. */
export function defaultCover(title: string): Cover {
  return {
    front: { text: title },
    spine: { text: title },
    back: { text: '' },
    style: defaultCoverStyle(),
  }
}

export function defaultEndpapers(): Endpapers {
  return { front: {}, back: {} }
}

export type CoverPanelName = 'front' | 'spine' | 'back'

/** Merge a style patch; spine width is clamped, no change returns the same book. */
export function setCoverStyle(book: Book, patch: Partial<CoverStyle>): Book {
  const next: CoverStyle = { ...book.cover.style, ...patch }
  next.spineWidthMm = Math.min(
    SPINE_WIDTH_MAX_MM,
    Math.max(SPINE_WIDTH_MIN_MM, next.spineWidthMm),
  )
  const same = (Object.keys(next) as (keyof CoverStyle)[]).every(
    (key) => next[key] === book.cover.style[key],
  )
  return same ? book : { ...book, cover: { ...book.cover, style: next } }
}

/** Put a gallery photo on an endpaper (both when `settings.endpapers.same`). */
export function setEndpaperPhoto(
  book: Book,
  side: 'front' | 'back',
  assetId: string | undefined,
): Book {
  if (
    assetId !== undefined &&
    (!book.gallery.includes(assetId) || !(assetId in book.assets))
  ) {
    return book
  }
  const paper = (): Endpapers['front'] =>
    assetId === undefined
      ? {}
      : { assetId, crop: { zoom: 1, center: { x: 0.5, y: 0.5 } } }
  const sides: ('front' | 'back')[] = book.settings.endpapers.same
    ? ['front', 'back']
    : [side]
  const endpapers = { ...book.endpapers }
  let changed = false
  for (const key of sides) {
    if (endpapers[key].assetId !== assetId) {
      endpapers[key] = paper()
      changed = true
    }
  }
  return changed ? { ...book, endpapers } : book
}

export function setEndpapersEnabled(book: Book, enabled: boolean): Book {
  if (book.settings.endpapers.enabled === enabled) {
    return book
  }
  return {
    ...book,
    settings: {
      ...book.settings,
      endpapers: { ...book.settings.endpapers, enabled },
    },
  }
}

/** Turning "same" on copies the front endpaper to the back. */
export function setEndpapersSame(book: Book, same: boolean): Book {
  if (book.settings.endpapers.same === same) {
    return book
  }
  const next: Book = {
    ...book,
    settings: {
      ...book.settings,
      endpapers: { ...book.settings.endpapers, same },
    },
  }
  return same
    ? { ...next, endpapers: { ...next.endpapers, back: next.endpapers.front } }
    : next
}

/** Book default page color; `undefined` restores the paper default. */
export function setPageColor(book: Book, color: string | undefined): Book {
  if (book.settings.pageColor === color) {
    return book
  }
  const rest = omitKey(book.settings, 'pageColor')
  return {
    ...book,
    settings: color === undefined ? rest : { ...rest, pageColor: color },
  }
}

/** Replace one panel's text; the same text returns the same book. */
export function setCoverText(
  book: Book,
  panel: CoverPanelName,
  text: string,
): Book {
  if (book.cover[panel].text === text) {
    return book
  }
  return {
    ...book,
    cover: { ...book.cover, [panel]: { ...book.cover[panel], text } },
  }
}

/** Put a gallery photo on the front cover: centered cover crop. */
export function setCoverPhoto(book: Book, assetId: string): Book {
  if (!book.gallery.includes(assetId) || !(assetId in book.assets)) {
    return book
  }
  if (book.cover.front.assetId === assetId) {
    return book
  }
  return {
    ...book,
    cover: {
      ...book.cover,
      front: {
        ...book.cover.front,
        assetId,
        crop: { zoom: 1, center: { x: 0.5, y: 0.5 } },
      },
    },
  }
}

/** Drop cover and endpaper photos whose assets left the book. */
export function clearRemovedCoverAssets(
  book: Book,
  removed: ReadonlySet<string>,
): Book {
  const gone = (assetId: string | undefined): boolean =>
    assetId !== undefined && removed.has(assetId)
  const stripPanel = (panel: Cover['front']): Cover['front'] =>
    gone(panel.assetId) ? { text: panel.text } : panel
  const stripPaper = (paper: Endpapers['front']): Endpapers['front'] =>
    gone(paper.assetId) ? {} : paper
  const cover = {
    front: stripPanel(book.cover.front),
    spine: stripPanel(book.cover.spine),
    back: stripPanel(book.cover.back),
    style: book.cover.style,
  }
  const endpapers = {
    front: stripPaper(book.endpapers.front),
    back: stripPaper(book.endpapers.back),
  }
  const same =
    cover.front === book.cover.front &&
    cover.spine === book.cover.spine &&
    cover.back === book.cover.back &&
    endpapers.front === book.endpapers.front &&
    endpapers.back === book.endpapers.back
  return same ? book : { ...book, cover, endpapers }
}
