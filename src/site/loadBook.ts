import type { BookInput } from './SiteRoom'
import { pageHref } from './siteUrl'

/** Reads a home book link's page input (`book.json` beside its page). */
export type LoadBook = (href: string) => Promise<BookInput>

/** The exported site: `book.json` in the book's directory (same origin). */
export const fetchBook: LoadBook = async (href) => {
  const res = await fetch(`${pageHref(href)}book.json`)
  if (!res.ok) throw new Error(`book.json ${String(res.status)}`)
  return JSON.parse(await res.text()) as BookInput
}
