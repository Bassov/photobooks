import type { Book, Cover, Endpapers } from './schema'

/** A new book's cover text is its title (front and spine); the back starts blank. */
export function defaultCover(title: string): Cover {
  return {
    front: { text: title },
    spine: { text: title },
    back: { text: '' },
  }
}

export function defaultEndpapers(): Endpapers {
  return { front: {}, back: {} }
}

export type CoverPanelName = keyof Cover

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
