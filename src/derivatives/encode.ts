import {
  derivativeSize,
  presetCacheId,
  resolvePresets,
  type DerivativePreset,
} from './plan'

/** Worker input: the source body and preset ids (resolved against config). */
export interface DerivativeWorkerRequest {
  id: string
  source: Blob
  presetIds: readonly string[]
}

interface EncodedDerivative {
  presetId: string
  cacheId: string
  bytes: ArrayBuffer
  mimeType: string
  width: number
  height: number
  /** Lowercase hex SHA-256 of `bytes`. */
  outputHash: string
  /** Resize + encode + hash time for this preset. */
  ms: number
}

export type DerivativeWorkerResponse =
  | { id: string; ok: true; decodeMs: number; outputs: EncodedDerivative[] }
  | { id: string; ok: false; error: string }

function failure(id: string, error: unknown): DerivativeWorkerResponse {
  const message = error instanceof Error ? error.message : String(error)
  return { id, ok: false, error: message }
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  let hex = ''
  for (const byte of digest) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex
}

/** Resize `bitmap` into the preset edge and encode it as sRGB. */
export async function encodePreset(
  bitmap: ImageBitmap,
  preset: DerivativePreset,
): Promise<EncodedDerivative> {
  const started = performance.now()
  const { width, height } = derivativeSize(
    bitmap.width,
    bitmap.height,
    preset.maxEdge,
  )
  const resized =
    width === bitmap.width && height === bitmap.height
      ? bitmap
      : await createImageBitmap(bitmap, {
          resizeWidth: width,
          resizeHeight: height,
          resizeQuality: 'high',
        })
  try {
    const opaque = preset.mimeType === 'image/jpeg'
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d', { alpha: !opaque, colorSpace: 'srgb' })
    if (!ctx) {
      throw new Error('OffscreenCanvas 2d context unavailable')
    }
    if (opaque) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
    }
    ctx.drawImage(resized, 0, 0)
    const blob = await canvas.convertToBlob({
      type: preset.mimeType,
      quality: preset.quality,
    })
    if (blob.type !== preset.mimeType) {
      throw new Error(`Encoder returned ${blob.type} for ${preset.mimeType}`)
    }
    const bytes = await blob.arrayBuffer()
    return {
      presetId: preset.id,
      cacheId: presetCacheId(preset),
      bytes,
      mimeType: blob.type,
      width,
      height,
      outputHash: await sha256Hex(bytes),
      ms: performance.now() - started,
    }
  } finally {
    if (resized !== bitmap) {
      resized.close()
    }
  }
}

/** One decode (EXIF orientation applied), then each preset as sRGB. */
export async function encodeDerivatives(
  request: DerivativeWorkerRequest,
): Promise<DerivativeWorkerResponse> {
  if (!(request.source instanceof Blob)) {
    return failure(request.id, 'Derivative source must be a Blob')
  }
  let presets: DerivativePreset[]
  try {
    presets = resolvePresets(request.presetIds)
  } catch (error) {
    return failure(request.id, error)
  }
  const started = performance.now()
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(request.source, {
      imageOrientation: 'from-image',
      colorSpaceConversion: 'default',
    })
  } catch {
    return failure(request.id, 'Derivative decode failed')
  }
  const decodeMs = performance.now() - started
  try {
    const outputs: EncodedDerivative[] = []
    for (const preset of presets) {
      outputs.push(await encodePreset(bitmap, preset))
    }
    return { id: request.id, ok: true, decodeMs, outputs }
  } catch (error) {
    return failure(request.id, error)
  } finally {
    bitmap.close()
  }
}

/** Output buffers move to the main thread without a copy. */
export function derivativeTransferList(
  response: DerivativeWorkerResponse,
): Transferable[] {
  return response.ok ? response.outputs.map((output) => output.bytes) : []
}
