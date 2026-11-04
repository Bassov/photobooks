import {
  parseBook,
  resolveParentFrames,
  serializeBook,
  type Book,
} from '../core'
import type { LibraryMeta, PublishStatus } from './types'

export const PUBLISHED_SCHEMA_VERSION = 1

/** Frozen `published.json` revision: the book as it was when published. */
export interface PublishedRevision {
  bookId: string
  publishedAtMs: number
  book: Book
}

export type PublishedParseResult =
  | { ok: true; revision: PublishedRevision }
  | { ok: false; code: 'newer-schema' | 'corrupted' }

export function bookPublishStatus(
  meta: LibraryMeta,
  bookId: string,
): PublishStatus {
  return meta.books?.[bookId]?.status ?? 'draft'
}

function withStatus(
  meta: LibraryMeta,
  bookId: string,
  status: PublishStatus,
): LibraryMeta {
  return { ...meta, books: { ...meta.books, [bookId]: { status } } }
}

/**
 * Marks `book` published and freezes a deep copy as its revision, so later
 * edits to the draft book (immutable or not) never reach the revision.
 */
export function publishBook(
  meta: LibraryMeta,
  book: Book,
  nowMs: number,
): { meta: LibraryMeta; revision: PublishedRevision } {
  return {
    meta: withStatus(meta, book.id, 'published'),
    revision: {
      bookId: book.id,
      publishedAtMs: nowMs,
      book: structuredClone(book),
    },
  }
}

/** Back to draft; the stored revision is kept, never deleted. */
export function unpublishBook(meta: LibraryMeta, bookId: string): LibraryMeta {
  return withStatus(meta, bookId, 'draft')
}

export function serializePublished(
  revision: PublishedRevision,
): Record<string, unknown> {
  return {
    schemaVersion: PUBLISHED_SCHEMA_VERSION,
    bookId: revision.bookId,
    publishedAtMs: revision.publishedAtMs,
    book: serializeBook(revision.book),
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === 'object' && !Array.isArray(input)
}

/** Pure parse of `published.json`; the book goes through `parseBook`. */
export function parsePublished(input: unknown): PublishedParseResult {
  if (!isRecord(input)) {
    return { ok: false, code: 'corrupted' }
  }
  const { schemaVersion, bookId, publishedAtMs } = input
  if (
    typeof schemaVersion === 'number' &&
    schemaVersion > PUBLISHED_SCHEMA_VERSION
  ) {
    return { ok: false, code: 'newer-schema' }
  }
  if (
    schemaVersion !== PUBLISHED_SCHEMA_VERSION ||
    typeof publishedAtMs !== 'number' ||
    !Number.isFinite(publishedAtMs)
  ) {
    return { ok: false, code: 'corrupted' }
  }
  const book = parseBook(input.book)
  if (!book.ok) {
    return {
      ok: false,
      code: book.code === 'newer-schema' ? 'newer-schema' : 'corrupted',
    }
  }
  if (bookId !== book.book.id) {
    return { ok: false, code: 'corrupted' }
  }
  return { ok: true, revision: { bookId, publishedAtMs, book: book.book } }
}

/**
 * Assets the site needs for one published revision: cover panels, endpapers
 * when enabled, then each spread's resolved frames (parent, overrides, own),
 * deduplicated in that reading order. Ids without an asset record are skipped.
 */
export function siteAssetIds(revision: PublishedRevision): string[] {
  const { book } = revision
  const ids = new Set<string>()
  const add = (assetId: string | undefined) => {
    if (assetId !== undefined && Object.hasOwn(book.assets, assetId)) {
      ids.add(assetId)
    }
  }
  add(book.cover.front.assetId)
  add(book.cover.spine.assetId)
  add(book.cover.back.assetId)
  if (book.settings.endpapers.enabled) {
    add(book.endpapers.front.assetId)
    add(book.endpapers.back.assetId)
  }
  for (const spread of book.spreads) {
    for (const { frame } of resolveParentFrames(book, spread)) {
      add(frame.assetId)
    }
  }
  return [...ids]
}
