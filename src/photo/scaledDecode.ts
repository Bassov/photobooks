import { JPEG_HEAD_BYTES } from './jpegHead'
import { readJpegSofSize } from './jpegSof'
import { readExifOrientation } from './readExifOrientation'
import type { ExifOrientation } from './types'

/** Chromium exposes the EXIF transform it applies when the frame is drawn. */
type OrientedVideoFrame = VideoFrame & {
  readonly rotation?: number
  readonly flip?: boolean
}

export interface ScaledJpegFrame {
  frame: VideoFrame
  /** Raw (coded, pre-orientation) size of the full image, from SOF. */
  width: number
  height: number
  orientation: ExifOrientation
  /** Orientation still to apply by hand when drawing `frame` (1 = none). */
  residualOrientation: ExifOrientation
}

/** JPEG DCT scale denominators, smallest output first. */
const JPEG_SCALE_DENOMINATORS = [8, 4, 2] as const

/**
 * Size to ask ImageDecoder for: the long-edge target fitted to the raw (coded)
 * size, rounded up to the smallest 1/8, 1/4 or 1/2 scale step that still
 * covers it (full size otherwise). Chromium decodes at the largest scale whose
 * area fits the desired area, so asking for the step itself returns that step
 * and never a frame below the target.
 */
export function decoderDesiredSize(
  rawWidth: number,
  rawHeight: number,
  maxEdge: number,
): { desiredWidth: number; desiredHeight: number } {
  const target = maxEdge / Math.max(rawWidth, rawHeight)
  const denominator =
    JPEG_SCALE_DENOMINATORS.find((step) => 1 / step >= target) ?? 1
  return {
    desiredWidth: Math.ceil(rawWidth / denominator),
    desiredHeight: Math.ceil(rawHeight / denominator),
  }
}

/**
 * Orientation left to apply after drawing `frame`: 1 when the browser already
 * orients it (non-identity `rotation`/`flip`), the EXIF value when it reports
 * an identity transform, and null when it does not say (caller falls back).
 */
export function frameResidualOrientation(
  frame: VideoFrame,
  orientation: ExifOrientation,
): ExifOrientation | null {
  if (orientation === 1) {
    return 1
  }
  const { rotation, flip } = frame as OrientedVideoFrame
  if (typeof rotation !== 'number') {
    return null
  }
  return rotation !== 0 || flip === true ? 1 : orientation
}

function isJpegType(mimeType: string): boolean {
  return mimeType === 'image/jpeg' || mimeType === 'image/jpg'
}

/** ImageDecoder constructor when the runtime has one for JPEG. */
async function jpegImageDecoder(): Promise<typeof ImageDecoder | undefined> {
  const Decoder = (globalThis as { ImageDecoder?: typeof ImageDecoder })
    .ImageDecoder
  if (typeof Decoder !== 'function') {
    return undefined
  }
  return (await Decoder.isTypeSupported('image/jpeg')) ? Decoder : undefined
}

/**
 * Decode a JPEG at reduced scale with ImageDecoder, reading only the head
 * (SOF + EXIF) up front and streaming the body into the decoder. Returns
 * undefined when this path does not apply (not JPEG, no ImageDecoder, no SOF
 * in the head, frame orientation unknown); throws when the decoder fails.
 * The caller closes `frame`.
 */
export async function decodeJpegScaled(
  file: File,
  maxEdge: number,
): Promise<ScaledJpegFrame | undefined> {
  if (!isJpegType(file.type)) {
    return undefined
  }
  const Decoder = await jpegImageDecoder()
  if (Decoder === undefined) {
    return undefined
  }
  const head = await file.slice(0, JPEG_HEAD_BYTES).arrayBuffer()
  const sof = readJpegSofSize(head)
  if (sof === null) {
    return undefined
  }
  const orientation = await readExifOrientation(head)
  const decoder = new Decoder({
    data: file.stream(),
    type: 'image/jpeg',
    ...decoderDesiredSize(sof.width, sof.height, maxEdge),
  })
  let frame: VideoFrame
  try {
    frame = (await decoder.decode()).image
  } finally {
    decoder.close()
  }
  const residualOrientation = frameResidualOrientation(frame, orientation)
  if (residualOrientation === null) {
    frame.close()
    return undefined
  }
  return {
    frame,
    width: sof.width,
    height: sof.height,
    orientation,
    residualOrientation,
  }
}
