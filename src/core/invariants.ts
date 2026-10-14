import type { Book } from './schema'

export type InvariantViolation =
  | {
      code: 'dangling-frame-asset'
      spreadId: string
      frameId: string
      assetId: string
    }
  | {
      code: 'placed-not-in-gallery'
      spreadId: string
      frameId: string
      assetId: string
    }
  | { code: 'gallery-missing-asset'; assetId: string }
  | { code: 'duplicate-gallery-id'; assetId: string }

export type InvariantsResult =
  { ok: true } | { ok: false; violation: InvariantViolation }

export function checkBookInvariants(book: Book): InvariantsResult {
  const seenGallery = new Set<string>()
  for (const assetId of book.gallery) {
    if (seenGallery.has(assetId)) {
      return { ok: false, violation: { code: 'duplicate-gallery-id', assetId } }
    }
    seenGallery.add(assetId)
    if (!(assetId in book.assets)) {
      return {
        ok: false,
        violation: { code: 'gallery-missing-asset', assetId },
      }
    }
  }

  for (const spread of book.spreads) {
    for (const frame of spread.frames) {
      const assetId = frame.assetId
      if (assetId === undefined) {
        continue
      }
      if (!(assetId in book.assets)) {
        return {
          ok: false,
          violation: {
            code: 'dangling-frame-asset',
            spreadId: spread.id,
            frameId: frame.id,
            assetId,
          },
        }
      }
      if (!seenGallery.has(assetId)) {
        return {
          ok: false,
          violation: {
            code: 'placed-not-in-gallery',
            spreadId: spread.id,
            frameId: frame.id,
            assetId,
          },
        }
      }
    }
  }

  return { ok: true }
}
