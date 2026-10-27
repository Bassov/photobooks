import { isJpegLikeFile } from '../photo/mime'
import {
  getBookStoreSnapshot,
  patchAssetRecord,
  setAssetSessionMeta,
  type AssetSessionMeta,
} from './bookStore'
import { tryPatchManifestFromAsset } from './folderManifestWrite'
import { IMPORT_BODY_READ_CAP, mapWithConcurrency } from './importBodyReads'
import { yieldForPaint } from './relink/yieldForPaint'
import { hasThumbData, setThumbUrl } from './thumbCache'

export interface JpegHeadPassEntry {
  assetId: string
  file: File
}

/**
 * Bounded parallel JPEG head reads: publish temporary EXIF thumbs,
 * header dims/orientation into session + folder manifest, and `capturedAt`
 * onto the asset record (sort-by-capture).
 *
 * `jpegHead` / exifr load only via nested dynamic import so the editor
 * main chunk (folderManifestWrite / bookStore / thumbCache) never embeds exifr.
 */
export async function runJpegHeadPass(
  entries: readonly JpegHeadPassEntry[],
  options: { concurrency?: number } = {},
): Promise<void> {
  const jpegEntries = entries.filter((entry) => isJpegLikeFile(entry.file))
  if (jpegEntries.length === 0) {
    return
  }
  const { JPEG_HEAD_BYTES, parseJpegHead } = await import('../photo/jpegHead')
  const concurrency = options.concurrency ?? IMPORT_BODY_READ_CAP
  await mapWithConcurrency(jpegEntries, concurrency, async (entry) => {
    try {
      const existing = getBookStoreSnapshot().sessionMeta.get(entry.assetId)
      const hasRealDims =
        existing !== undefined &&
        existing.correctedWidth > 1 &&
        existing.correctedHeight > 1
      const hasThumb = hasThumbData(entry.assetId)
      const hasCapturedAt =
        getBookStoreSnapshot().book.assets[entry.assetId]?.capturedAt !==
        undefined
      if (hasRealDims && hasThumb && hasCapturedAt) {
        return
      }
      const head = await entry.file.slice(0, JPEG_HEAD_BYTES).arrayBuffer()
      if (!hasCapturedAt) {
        const { extractAssetMetadata } =
          await import('../assets/extractAssetMetadata')
        const { capturedAt } = await extractAssetMetadata(head)
        if (capturedAt !== undefined) {
          patchAssetRecord(entry.assetId, { capturedAt })
        }
      }
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
    } finally {
      // Spec: capped parallelism with yields so head work does not LoAF scroll.
      await yieldForPaint()
    }
  })
}
