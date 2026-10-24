import {
  isJpegLikeFile,
  JPEG_HEAD_BYTES,
  parseJpegHead,
} from '../photo/jpegHead'
import {
  getBookStoreSnapshot,
  setAssetSessionMeta,
  type AssetSessionMeta,
} from './bookStore'
import { tryPatchManifestFromAsset } from './folderManifestWrite'
import { IMPORT_BODY_READ_CAP, mapWithConcurrency } from './importBodyReads'
import { hasThumbData, setThumbUrl } from './thumbCache'

export interface JpegHeadPassEntry {
  assetId: string
  file: File
}

/**
 * Bounded parallel JPEG head reads: publish temporary EXIF thumbs and
 * header dims/orientation into session + folder manifest.
 */
export async function runJpegHeadPass(
  entries: readonly JpegHeadPassEntry[],
  options: { concurrency?: number } = {},
): Promise<void> {
  const jpegEntries = entries.filter((entry) => isJpegLikeFile(entry.file))
  // Stryker disable next-line ConditionalExpression,BlockStatement: mapWithConcurrency on [] is a no-op
  if (jpegEntries.length === 0) {
    return
  }
  const concurrency = options.concurrency ?? IMPORT_BODY_READ_CAP
  await mapWithConcurrency(jpegEntries, concurrency, async (entry) => {
    try {
      const existing = getBookStoreSnapshot().sessionMeta.get(entry.assetId)
      const hasRealDims =
        existing !== undefined &&
        existing.correctedWidth > 1 &&
        existing.correctedHeight > 1
      const hasThumb = hasThumbData(entry.assetId)
      if (hasRealDims && hasThumb) {
        return
      }
      const head = await entry.file.slice(0, JPEG_HEAD_BYTES).arrayBuffer()
      const parsed = await parseJpegHead(head)
      if (
        !hasRealDims &&
        parsed.correctedWidth !== null &&
        parsed.correctedHeight !== null
      ) {
        const meta: AssetSessionMeta = {
          name: existing?.name ?? entry.file.name,
          correctedWidth: parsed.correctedWidth,
          correctedHeight: parsed.correctedHeight,
          orientation: parsed.orientation,
          aspect: parsed.correctedWidth / Math.max(1, parsed.correctedHeight),
        }
        setAssetSessionMeta(entry.assetId, meta)
        tryPatchManifestFromAsset(
          getBookStoreSnapshot().book.assets[entry.assetId],
          {
            width: parsed.correctedWidth,
            height: parsed.correctedHeight,
            orientation: parsed.orientation,
          },
        )
      }
      if (!hasThumb && parsed.thumbJpeg !== null) {
        const copy = new Uint8Array(parsed.thumbJpeg.byteLength)
        copy.set(parsed.thumbJpeg)
        // Session-only: omit cacheKey so DerivedCache is not written.
        setThumbUrl(entry.assetId, copy.buffer, 'image/jpeg')
      }
    } catch {
      // Head pass must never fail the import batch.
    }
  })
}
