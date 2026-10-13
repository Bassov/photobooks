import exifr from 'exifr'
import { exifParseSchema } from './exifSchema'
import { readJpegSofSize, stripJpegExif } from './jpegSof'
import { normalizeOrientation } from './normalizeOrientation'
import type { ExifOrientation } from './types'

export interface PhotoWorkerRequest {
  id: string
  file: File
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

const ORIENTATION_LABELS: Record<string, ExifOrientation> = {
  'Horizontal (normal)': 1,
  'Mirror horizontal': 2,
  'Rotate 180': 3,
  'Mirror vertical': 4,
  'Mirror horizontal and rotate 270 CW': 5,
  'Rotate 90 CW': 6,
  'Mirror horizontal and rotate 90 CW': 7,
  'Rotate 270 CW': 8,
}

async function readOrientation(buffer: ArrayBuffer): Promise<ExifOrientation> {
  try {
    const raw: unknown = await exifr.orientation(buffer)
    if (typeof raw === 'number' && raw >= 1 && raw <= 8) {
      return raw as ExifOrientation
    }
    if (typeof raw === 'string' && Object.hasOwn(ORIENTATION_LABELS, raw)) {
      return ORIENTATION_LABELS[raw]
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

async function buildPreview(
  bitmap: ImageBitmap,
  orientation: ExifOrientation,
): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  const rawW = bitmap.width
  const rawH = bitmap.height
  const { correctedW, correctedH } = normalizeOrientation(
    orientation,
    rawW,
    rawH,
  )

  const scale = Math.min(1, PREVIEW_MAX_EDGE / Math.max(correctedW, correctedH))
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

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
  return { buffer: await blob.arrayBuffer(), mimeType: 'image/jpeg' }
}

async function handleRequest(
  request: PhotoWorkerRequest,
): Promise<PhotoWorkerResponse> {
  try {
    const buffer = await request.file.arrayBuffer()
    const mimeType = request.file.type || 'application/octet-stream'
    const name = request.file.name
    const byteLength = request.file.size

    const orientation = await readOrientation(buffer)

    const sizeRaw: unknown = await exifr.parse(buffer, {
      pick: ['ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight'],
      translateValues: false,
      reviveValues: false,
    })
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
    const bitmap = await createImageBitmap(blob, {
      imageOrientation: 'none',
    })

    try {
      const width =
        sof?.width ?? parsed.ImageWidth ?? parsed.ExifImageWidth ?? bitmap.width
      const height =
        sof?.height ??
        parsed.ImageHeight ??
        parsed.ExifImageHeight ??
        bitmap.height

      const transform = normalizeOrientation(orientation, width, height)
      const preview = await buildPreview(bitmap, orientation)

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
    const message =
      error instanceof Error ? error.message : 'Failed to load photo'
    return { id: request.id, ok: false, error: message }
  }
}

const workerScope = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<PhotoWorkerRequest>) => void) | null
  postMessage: (
    message: PhotoWorkerResponse,
    options?: { transfer?: Transferable[] },
  ) => void
}

workerScope.onmessage = (event: MessageEvent<PhotoWorkerRequest>) => {
  void handleRequest(event.data).then((response) => {
    if (response.ok) {
      workerScope.postMessage(response, { transfer: [response.previewBuffer] })
    } else {
      workerScope.postMessage(response)
    }
  })
}
