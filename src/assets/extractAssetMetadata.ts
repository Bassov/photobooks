import exifr from 'exifr'

import type { Asset } from '../core'
import { exifOrientationFromLabel } from '../photo/exifOrientationLabel'
import { normalizeOrientation } from '../photo/normalizeOrientation'
import type { ExifOrientation } from '../photo/types'

export type ExtractedAssetMetadata = Pick<
  Asset,
  | 'widthPx'
  | 'heightPx'
  | 'orientation'
  | 'capturedAt'
  | 'colorSpace'
  | 'iccProfileName'
  | 'mime'
  | 'meta'
>

interface ExifRaw {
  Orientation?: unknown
  ImageWidth?: unknown
  ImageHeight?: unknown
  ExifImageWidth?: unknown
  ExifImageHeight?: unknown
  DateTimeOriginal?: unknown
  CreateDate?: unknown
  ColorSpace?: unknown
  ProfileDescription?: unknown
  ICCProfileName?: unknown
  Make?: unknown
  Model?: unknown
  LensModel?: unknown
  ImageDescription?: unknown
  XPComment?: unknown
  Keywords?: unknown
  subject?: unknown
  latitude?: unknown
  longitude?: unknown
  gps?: { latitude?: unknown; longitude?: unknown }
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }
  return value
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function asPositiveInt(value: unknown): number | undefined {
  const n = asFiniteNumber(value)
  if (n === undefined || n < 1 || !Number.isInteger(n)) {
    return undefined
  }
  return n
}

function readOrientation(raw: ExifRaw): ExifOrientation {
  const direct = raw.Orientation
  if (typeof direct === 'number' && direct >= 1 && direct <= 8) {
    return direct as ExifOrientation
  }
  if (typeof direct === 'string') {
    const mapped = exifOrientationFromLabel(direct)
    if (mapped !== undefined) {
      return mapped
    }
  }
  return 1
}

function readCapturedAt(raw: ExifRaw): string | undefined {
  for (const key of ['DateTimeOriginal', 'CreateDate'] as const) {
    const value = raw[key]
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString()
    }
    const asString = asNonEmptyString(value)
    if (asString !== undefined) {
      return asString
    }
  }
  return undefined
}

function readColorSpace(raw: ExifRaw): string | undefined {
  const value = raw.ColorSpace
  if (typeof value === 'number') {
    if (value === 1) {
      return 'sRGB'
    }
    if (value === 65535) {
      return 'Uncalibrated'
    }
    return String(value)
  }
  return asNonEmptyString(value)
}

function readKeywords(raw: ExifRaw): string[] | undefined {
  const sources = [raw.Keywords, raw.subject]
  const out: string[] = []
  for (const source of sources) {
    if (typeof source === 'string') {
      const part = asNonEmptyString(source)
      if (part !== undefined) {
        out.push(part)
      }
      continue
    }
    if (Array.isArray(source)) {
      for (const item of source) {
        const part = asNonEmptyString(item)
        if (part !== undefined) {
          out.push(part)
        }
      }
    }
  }
  return out.length > 0 ? out : undefined
}

function readGps(raw: ExifRaw): { lat: number; lon: number } | undefined {
  const lat = asFiniteNumber(raw.latitude) ?? asFiniteNumber(raw.gps?.latitude)
  const lon =
    asFiniteNumber(raw.longitude) ?? asFiniteNumber(raw.gps?.longitude)
  if (lat === undefined || lon === undefined) {
    return undefined
  }
  return { lat, lon }
}

function readCamera(raw: ExifRaw): string | undefined {
  const make = asNonEmptyString(raw.Make)
  const model = asNonEmptyString(raw.Model)
  if (make !== undefined && model !== undefined) {
    return `${make} ${model}`
  }
  return make ?? model
}

/** Map a parsed EXIF object into book-core asset metadata fields (omit absent). */
export function mapExifToAssetMetadata(
  raw: ExifRaw,
  mimeHint?: string,
): ExtractedAssetMetadata {
  const orientation = readOrientation(raw)
  const rawW =
    asPositiveInt(raw.ImageWidth) ?? asPositiveInt(raw.ExifImageWidth)
  const rawH =
    asPositiveInt(raw.ImageHeight) ?? asPositiveInt(raw.ExifImageHeight)

  const result: ExtractedAssetMetadata = {}

  if (rawW !== undefined && rawH !== undefined) {
    const { correctedW, correctedH } = normalizeOrientation(
      orientation,
      rawW,
      rawH,
    )
    result.widthPx = correctedW
    result.heightPx = correctedH
  }

  result.orientation = orientation

  const capturedAt = readCapturedAt(raw)
  if (capturedAt !== undefined) {
    result.capturedAt = capturedAt
  }

  const colorSpace = readColorSpace(raw)
  if (colorSpace !== undefined) {
    result.colorSpace = colorSpace
  }

  const icc =
    asNonEmptyString(raw.ProfileDescription) ??
    asNonEmptyString(raw.ICCProfileName)
  if (icc !== undefined) {
    result.iccProfileName = icc
  }

  const mime = asNonEmptyString(mimeHint)
  if (mime !== undefined) {
    result.mime = mime
  }

  const meta: NonNullable<Asset['meta']> = {}
  const title = asNonEmptyString(raw.ImageDescription)
  if (title !== undefined) {
    meta.title = title
  }
  const caption = asNonEmptyString(raw.XPComment)
  if (caption !== undefined) {
    meta.caption = caption
  }
  const camera = readCamera(raw)
  if (camera !== undefined) {
    meta.camera = camera
  }
  const lens = asNonEmptyString(raw.LensModel)
  if (lens !== undefined) {
    meta.lens = lens
  }
  const keywords = readKeywords(raw)
  if (keywords !== undefined) {
    meta.keywords = keywords
  }
  const gps = readGps(raw)
  if (gps !== undefined) {
    meta.gps = gps
  }
  if (Object.keys(meta).length > 0) {
    result.meta = meta
  }

  return result
}

/** Extract book-core asset metadata from image bytes via `exifr` (no GPS consent). */
export async function extractAssetMetadata(
  buffer: ArrayBuffer,
  mimeHint?: string,
): Promise<ExtractedAssetMetadata> {
  let raw: ExifRaw = {}
  try {
    const parsed: unknown = await exifr.parse(buffer, {
      translateValues: true,
      reviveValues: true,
      gps: true,
      icc: true,
      exif: true,
      mergeOutput: true,
    })
    if (parsed && typeof parsed === 'object') {
      raw = parsed
    }
  } catch {
    raw = {}
  }
  return mapExifToAssetMetadata(raw, mimeHint)
}
