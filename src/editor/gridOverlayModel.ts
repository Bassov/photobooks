import { resolveLayoutGrid, type Book, type PageGrid } from '../core'

export type PageGridRects = PageGrid

/** Per-page grid rects of one spread (the core resolver). */
export function pageGridRects(
  book: Book,
  spreadIndex: number,
): PageGridRects[] {
  return resolveLayoutGrid(book, spreadIndex).pages
}
