import { getSpreadPageCount } from '../geometry/spreadSize'
import type { Book, Spread } from '../schema'
import { applyTemplate } from '../templates/apply'
import { isTemplateId, type TemplateId } from '../templates/types'

export function resolveAddSpreadTemplateId(
  templateId: string | undefined,
): TemplateId {
  if (templateId !== undefined && isTemplateId(templateId)) {
    return templateId
  }
  return 'one-per-page'
}

export function addSpread(
  book: Book,
  options: { index?: number; id?: string; templateId?: string } = {},
): Book {
  const id = options.id ?? nextSpreadId(book)
  const insertAt =
    options.index === undefined
      ? book.spreads.length
      : Math.max(0, Math.min(options.index, book.spreads.length))

  const empty: Spread = { id, frames: [] }
  const spreads = book.spreads.slice()
  spreads.splice(insertAt, 0, empty)
  const withSpread: Book = { ...book, spreads }
  const inserted = applyTemplate(
    withSpread,
    id,
    resolveAddSpreadTemplateId(options.templateId),
  )
  return reapplyChangedPageRoles(book, inserted)
}

function reapplyChangedPageRoles(before: Book, after: Book): Book {
  let next = after
  for (const spread of before.spreads) {
    const oldIndex = before.spreads.indexOf(spread)
    const newIndex = next.spreads.findIndex((item) => item.id === spread.id)
    const oldCount = getSpreadPageCount(oldIndex, before.spreads.length)
    const newCount = getSpreadPageCount(newIndex, next.spreads.length)
    if (oldCount === newCount) {
      continue
    }
    const templateId = spread.templateId
    if (templateId === undefined || !isTemplateId(templateId)) {
      continue
    }
    next = applyTemplate(next, spread.id, templateId)
  }
  return next
}

export function duplicateSpread(
  book: Book,
  spreadId: string,
  options: { id?: string } = {},
): Book {
  const index = book.spreads.findIndex((spread) => spread.id === spreadId)
  const source = book.spreads[index]
  if (source === undefined) {
    return book
  }
  const copy: Spread = {
    ...source,
    id: options.id ?? nextSpreadId(book),
    frames: source.frames.map((frame) => ({ ...frame })),
  }
  const spreads = book.spreads.slice()
  spreads.splice(index + 1, 0, copy)
  return reapplyChangedPageRoles(book, { ...book, spreads })
}

export function removeSpread(book: Book, spreadId: string): Book {
  if (book.spreads.length <= 1) {
    return book
  }
  const spreads = book.spreads.filter((spread) => spread.id !== spreadId)
  if (spreads.length === book.spreads.length) {
    return book
  }
  return reapplyChangedPageRoles(book, { ...book, spreads })
}

export function moveSpread(
  book: Book,
  spreadId: string,
  toIndex: number,
): Book {
  const fromIndex = book.spreads.findIndex((spread) => spread.id === spreadId)
  if (fromIndex < 0) {
    return book
  }
  const clamped = Math.max(0, Math.min(toIndex, book.spreads.length - 1))
  if (clamped === fromIndex) {
    return book
  }
  const spreads = book.spreads.slice()
  const moved = spreads.splice(fromIndex, 1)
  spreads.splice(clamped, 0, ...moved)
  return reapplyChangedPageRoles(book, { ...book, spreads })
}

export function nextSpreadId(book: Book): string {
  let n = book.spreads.length + 1
  let id = `spread-${String(n)}`
  const existing = new Set(book.spreads.map((spread) => spread.id))
  while (existing.has(id)) {
    n += 1
    id = `spread-${String(n)}`
  }
  return id
}
