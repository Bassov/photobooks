import exifr from 'exifr'
import { readJpegSofSize } from './jpegSof'
import { isJpegLikeFile } from './mime'
import { normalizeOrientation } from './normalizeOrientation'
import { readExifImageSize } from './readExifImageSize'
import { readExifOrientation } from './readExifOrientation'
import type { ExifOrientation } from './types'

export { isJpegLikeFile }

/** Bytes to read from a JPEG for SOF + EXIF IFD0/IFD1 (embedded thumb). */
export const JPEG_HEAD_BYTES = 65_536

export interface JpegHeadParseResult {
  /** Embedded IFD1 JPEG bytes when valid; otherwise null. */
  thumbJpeg: Uint8Array | null
  width: number | null
  height: number | null
  orientation: ExifOrientation
  correctedWidth: number | null
  correctedHeight: number | null
}

/** JPEG start-of-image marker (SOI). */
export function isJpegSoi(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8
}

/** Strict positive finite integer for EXIF pixel fields. */
export function positiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null
}

/**
 * Parse a JPEG head buffer for embedded thumbnail + dimensions/orientation.
 * Soft-fails: never throws; corrupt/absent thumb → null thumb.
 */
export async function parseJpegHead(
  buffer: ArrayBuffer,
): Promise<JpegHeadParseResult> {
  const empty: JpegHeadParseResult = {
    thumbJpeg: null,
    width: null,
    height: null,
    orientation: 1,
    correctedWidth: null,
    correctedHeight: null,
  }
  if (buffer.byteLength < 4 || !isJpegSoi(new Uint8Array(buffer, 0, 2))) {
    return empty
  }

  let thumbJpeg: Uint8Array | null = null
  try {
    const raw: unknown = await exifr.thumbnail(buffer)
    if (raw instanceof Uint8Array && raw.byteLength >= 2 && isJpegSoi(raw)) {
      thumbJpeg = raw.subarray(0)
    }
  } catch {
    thumbJpeg = null
  }

  const sof = readJpegSofSize(buffer)
  let width = sof?.width ?? null
  let height = sof?.height ?? null
  if (width === null || height === null) {
    const sizeRaw = await readExifImageSize(buffer)
    if (sizeRaw && typeof sizeRaw === 'object') {
      const record = sizeRaw as Record<string, unknown>
      width =
        width ??
        positiveInt(record.ImageWidth) ??
        positiveInt(record.ExifImageWidth)
      height =
        height ??
        positiveInt(record.ImageHeight) ??
        positiveInt(record.ExifImageHeight)
    }
  }

  const orientation = await readExifOrientation(buffer)
  let correctedWidth: number | null = null
  let correctedHeight: number | null = null
  if (width !== null && height !== null) {
    try {
      const transform = normalizeOrientation(orientation, width, height)
      correctedWidth = transform.correctedW
      correctedHeight = transform.correctedH
    } catch {
      correctedWidth = width
      correctedHeight = height
    }
  }

  return {
    thumbJpeg,
    width,
    height,
    orientation,
    correctedWidth,
    correctedHeight,
  }
}
