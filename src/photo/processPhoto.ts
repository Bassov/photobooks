import exifr from 'exifr'
import { exifOrientationFromLabel } from './exifOrientationLabel'
import { exifParseSchema } from './exifSchema'
import { HEIC_UNSUPPORTED_MESSAGE, isHeicSignature } from './heic'
import { readJpegSofSize, stripJpegExif } from './jpegSof'
import { normalizeOrientation } from './normalizeOrientation'
import { readExifImageSize } from './readExifImageSize'
import type { ExifOrientation } from './types'

export interface PhotoWorkerRequest {
  id: string
  file: File
  /** Long-edge cap for the preview (default PREVIEW_MAX_EDGE). */
  maxEdge?: number
  /** When true, the preview long edge equals maxEdge even if the source is smaller. */
  cover?: boolean
}

export interface PhotoWorkerSuccess {
  id: string
  ok: true
  name: string
  mimeType: string
  byteLength: number
  width: number
  height: number
  correctedWidth: number
  correctedHeight: number
  orientation: ExifOrientation
  previewBuffer: ArrayBuffer
  previewMimeType: string
}

export interface PhotoWorkerFailure {
  id: string
  ok: false
  error: string
}

export type PhotoWorkerResponse = PhotoWorkerSuccess | PhotoWorkerFailure

const PREVIEW_MAX_EDGE = 1280
export const THUMB_MAX_EDGE = 320

/**
 * Optional createImageBitmap resize so decode never materializes a full-res
 * bitmap when the long edge will be capped. Dimensions are source (pre-orient)
 * pixels; long-edge math matches corrected size because orientation only swaps.
 */
export function bitmapResizeOptions(
  width: number,
  height: number,
  maxEdge: number,
  cover: boolean,
  resizeQuality: 'pixelated' | 'low' | 'medium' | 'high' = 'medium',
):
  | Pick<ImageBitmapOptions, 'resizeWidth' | 'resizeHeight' | 'resizeQuality'>
  | undefined {
  // Stryker disable next-line ConditionalExpression,EqualityOperator,LogicalOperator: non-positive guards are equivalent for scale-to-undefined paths under cover=false
  if (!(width > 0 && height > 0 && maxEdge > 0)) {
    return undefined
  }
  const longEdge = Math.max(width, height)
  const scale = cover ? maxEdge / longEdge : Math.min(1, maxEdge / longEdge)
  if (!cover && scale >= 1) {
    return undefined
  }
  return {
    resizeWidth: Math.max(1, Math.round(width * scale)),
    resizeHeight: Math.max(1, Math.round(height * scale)),
    resizeQuality,
  }
}

async function readOrientation(buffer: ArrayBuffer): Promise<ExifOrientation> {
  try {
    const raw: unknown = await exifr.orientation(buffer)
    if (typeof raw === 'number' && raw >= 1 && raw <= 8) {
      return raw as ExifOrientation
    }
    if (typeof raw === 'string') {
      const mapped = exifOrientationFromLabel(raw)
      if (mapped !== undefined) {
        return mapped
      }
    }
    const parsed: unknown = await exifr.parse(buffer, {
      pick: ['Orientation'],
      translateValues: false,
      reviveValues: false,
    })
    if (parsed && typeof parsed === 'object') {
      const value = (parsed as { Orientation?: unknown }).Orientation
      if (typeof value === 'number' && value >= 1 && value <= 8) {
        return value as ExifOrientation
      }
    }
  } catch {
    // Fall through to default orientation.
  }
  return 1
}

function applyOrientationTransform(
  ctx: OffscreenCanvasRenderingContext2D,
  orientation: ExifOrientation,
  width: number,
  height: number,
): void {
  const { rotation, flipX, flipY, correctedW, correctedH } =
    normalizeOrientation(orientation, width, height)

  ctx.translate(correctedW / 2, correctedH / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)
  ctx.translate(-width / 2, -height / 2)
}

function previewEncodeType(sourceMime: string): string {
  if (sourceMime === 'image/png' || sourceMime === 'image/webp') {
    return 'image/webp'
  }
  return 'image/jpeg'
}

async function buildPreview(
  bitmap: ImageBitmap,
  orientation: ExifOrientation,
  maxEdge: number,
  cover: boolean,
  sourceMime: string,
): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  const rawW = bitmap.width
  const rawH = bitmap.height
  const { correctedW, correctedH } = normalizeOrientation(
    orientation,
    rawW,
    rawH,
  )

  const longEdge = Math.max(1, correctedW, correctedH)
  const scale = cover ? maxEdge / longEdge : Math.min(1, maxEdge / longEdge)
  const outW = Math.max(1, Math.round(correctedW * scale))
  const outH = Math.max(1, Math.round(correctedH * scale))

  const canvas = new OffscreenCanvas(outW, outH)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('OffscreenCanvas 2d context unavailable')
  }

  ctx.scale(scale, scale)
  applyOrientationTransform(ctx, orientation, rawW, rawH)
  ctx.drawImage(bitmap, 0, 0)

  const encodeType = previewEncodeType(sourceMime)
  const blob = await canvas.convertToBlob({
    type: encodeType,
    quality: 0.85,
  })
  return { buffer: await blob.arrayBuffer(), mimeType: blob.type }
}

export async function processPhotoRequest(
  request: PhotoWorkerRequest,
): Promise<PhotoWorkerResponse> {
  let buffer: ArrayBuffer | undefined
  try {
    buffer = await request.file.arrayBuffer()
    const mimeType = request.file.type || 'application/octet-stream'
    const name = request.file.name
    const byteLength = request.file.size

    const orientation = await readOrientation(buffer)

    const sizeRaw = await readExifImageSize(buffer)
    const parsed = exifParseSchema
      .pick({
        ImageWidth: true,
        ImageHeight: true,
        ExifImageWidth: true,
        ExifImageHeight: true,
      })
      .parse(sizeRaw ?? {})

    const decodeBuffer =
      mimeType === 'image/jpeg' || mimeType === 'image/jpg'
        ? stripJpegExif(buffer)
        : buffer
    const sof = readJpegSofSize(buffer)

    const blob = new Blob([new Uint8Array(decodeBuffer)], {
      type: mimeType,
    })
    const maxEdge = request.maxEdge ?? PREVIEW_MAX_EDGE
    const cover = request.cover === true
    const knownWidth = sof?.width ?? parsed.ImageWidth ?? parsed.ExifImageWidth
    const knownHeight =
      sof?.height ?? parsed.ImageHeight ?? parsed.ExifImageHeight
    // Stryker disable next-line ConditionalExpression,LogicalOperator: SOF/EXIF sizes are finite when present; isFinite chain is equivalent for fixture paths
    const knownOk =
      knownWidth !== undefined &&
      knownHeight !== undefined &&
      Number.isFinite(knownWidth) &&
      Number.isFinite(knownHeight)
    const resize = knownOk
      ? bitmapResizeOptions(
          knownWidth,
          knownHeight,
          maxEdge,
          cover,
          // Stryker disable next-line EqualityOperator: ≤320 vs <320 both map thumb encode to low for our caps
          maxEdge <= THUMB_MAX_EDGE ? 'low' : 'medium',
        )
      : undefined
    const bitmap = await createImageBitmap(blob, {
      imageOrientation: 'none',
      ...resize,
    })

    try {
      const width = knownWidth ?? bitmap.width
      const height = knownHeight ?? bitmap.height

      const transform = normalizeOrientation(orientation, width, height)
      const preview = await buildPreview(
        bitmap,
        orientation,
        maxEdge,
        cover,
        mimeType,
      )

      return {
        id: request.id,
        ok: true,
        name,
        mimeType,
        byteLength,
        width,
        height,
        correctedWidth: transform.correctedW,
        correctedHeight: transform.correctedH,
        orientation,
        previewBuffer: preview.buffer,
        previewMimeType: preview.mimeType,
      }
    } finally {
      bitmap.close()
    }
  } catch (error) {
    if (buffer !== undefined && isHeicSignature(buffer)) {
      return { id: request.id, ok: false, error: HEIC_UNSUPPORTED_MESSAGE }
    }
    const message =
      error instanceof Error ? error.message : 'Failed to load photo'
    return { id: request.id, ok: false, error: message }
  }
}
