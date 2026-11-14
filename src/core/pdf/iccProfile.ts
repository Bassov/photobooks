/**
 * ICC profiles of photo files: read the one a JPEG / PNG carries, tell which
 * RGB space it is, and build the sRGB profile that untagged photos get.
 * Pure byte work, no decoding of the image itself; reads past the end are 0.
 */

export type ColorFamily =
  | 'srgb'
  | 'adobe-rgb'
  | 'display-p3'
  /** Another RGB profile (ProPhoto, a table-based or monitor profile …). */
  | 'other-rgb'
  /** Gray or CMYK. */
  | 'other'

export interface SourceColor {
  /** The profile the file carries; undefined when untagged or unreadable. */
  icc: Uint8Array | undefined
  /** Untagged files count as sRGB. */
  family: ColorFamily
}

type Xyz = readonly [number, number, number]

export interface RgbPrimaries {
  red: Xyz
  green: Xyz
  blue: Xyz
}

/** Colorant tags (D50-adapted) of the standard profiles. */
export const RGB_PRIMARIES = {
  srgb: {
    red: [0.4361, 0.2225, 0.0139],
    green: [0.3851, 0.7169, 0.0971],
    blue: [0.1431, 0.0606, 0.7141],
  },
  'adobe-rgb': {
    red: [0.6097, 0.3111, 0.0195],
    green: [0.2053, 0.6257, 0.0609],
    blue: [0.1492, 0.0632, 0.7446],
  },
  'display-p3': {
    red: [0.5151, 0.2412, -0.0011],
    green: [0.2919, 0.6922, 0.0419],
    blue: [0.1571, 0.0666, 0.7841],
  },
} as const satisfies Record<string, RgbPrimaries>

const FAMILIES = Object.keys(RGB_PRIMARIES) as (keyof typeof RGB_PRIMARIES)[]

/** Profiles rounding their colorants differently still match. */
const PRIMARY_TOLERANCE = 0.01

const D50: Xyz = [0.9642, 1, 0.8249]
const HEADER_BYTES = 128
/** Header plus the tag count. */
const MIN_PROFILE_BYTES = HEADER_BYTES + 4
/** Tag table entries looked at; real profiles have about 10–20. */
const MAX_TAGS = 100
const CHANNELS: Readonly<Record<string, number>> = {
  GRAY: 1,
  'RGB ': 3,
  CMYK: 4,
}

const ascii = new TextEncoder()
const JPEG_ICC_SIGNATURE = ascii.encode('ICC_PROFILE\0')
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function u8(bytes: Uint8Array, at: number): number {
  return bytes[at] ?? 0
}

function u16(bytes: Uint8Array, at: number): number {
  return u8(bytes, at) * 0x100 + u8(bytes, at + 1)
}

function u32(bytes: Uint8Array, at: number): number {
  return u16(bytes, at) * 0x10000 + u16(bytes, at + 2)
}

function text(bytes: Uint8Array, at: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(at, at + length))
}

function startsWith(
  bytes: Uint8Array,
  prefix: ArrayLike<number>,
  at: number,
): boolean {
  return Array.from(prefix).every((value, index) => bytes[at + index] === value)
}

/**
 * The ICC profile of a JPEG: its APP2 `ICC_PROFILE` chunks joined in order;
 * undefined when there is none or a chunk is missing.
 */
export function jpegIccProfile(bytes: Uint8Array): Uint8Array | undefined {
  if (u16(bytes, 0) !== 0xffd8) return undefined
  const chunks = new Map<number, Uint8Array>()
  let total = 0
  // Marker segments up to the image data (SOS) or the end (EOI).
  for (let at = 2; bytes[at] === 0xff;) {
    const marker = u8(bytes, at + 1)
    const end = at + 2 + u16(bytes, at + 2)
    if (marker === 0xda || marker === 0xd9 || end > bytes.length) break
    // Sequence number and chunk count follow the signature.
    const head = at + 4 + JPEG_ICC_SIGNATURE.length
    if (
      marker === 0xe2 &&
      startsWith(bytes, JPEG_ICC_SIGNATURE, at + 4) &&
      head + 2 <= end
    ) {
      chunks.set(u8(bytes, head), bytes.subarray(head + 2, end))
      total = u8(bytes, head + 1)
    }
    at = Math.max(end, at + 4)
  }
  const ordered: Uint8Array[] = []
  for (let sequence = 1; sequence <= total; sequence += 1) {
    const chunk = chunks.get(sequence)
    if (chunk === undefined) return undefined
    ordered.push(chunk)
  }
  return total === 0 ? undefined : concat(ordered)
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

/** The zlib-compressed profile of a PNG's `iCCP` chunk, if any. */
export function pngDeflatedIcc(bytes: Uint8Array): Uint8Array | undefined {
  if (!startsWith(bytes, PNG_SIGNATURE, 0)) return undefined
  // Chunks: length, type, data, CRC; the profile comes before the image data.
  for (let at = PNG_SIGNATURE.length; ;) {
    const type = text(bytes, at + 4, 4)
    const data = at + 8
    const end = data + u32(bytes, at)
    if (end > bytes.length || type === 'IDAT') return undefined
    if (type === 'iCCP') {
      // Profile name, NUL, compression method 0, then the zlib stream.
      const nul = bytes.subarray(data, end).indexOf(0)
      const method = data + nul + 1
      return nul < 1 || bytes[method] !== 0
        ? undefined
        : bytes.subarray(method + 1, end)
    }
    at = end + 4
  }
}

function inflate(data: Uint8Array): Promise<Uint8Array | undefined> {
  const stream = new Blob([data.slice()])
    .stream()
    .pipeThrough(new DecompressionStream('deflate'))
  return new Response(stream).arrayBuffer().then(
    (buffer) => new Uint8Array(buffer),
    () => undefined,
  )
}

/**
 * Components of a well-formed profile's color space (1 gray, 3 RGB, 4 CMYK);
 * undefined for anything else.
 */
export function iccChannels(icc: Uint8Array): number | undefined {
  const size = u32(icc, 0)
  return text(icc, 36, 4) === 'acsp' &&
    size >= MIN_PROFILE_BYTES &&
    size <= icc.length
    ? CHANNELS[text(icc, 16, 4)]
    : undefined
}

/** An `XYZ ` tag's value by signature; undefined when absent. */
function xyzTag(icc: Uint8Array, signature: string): Xyz | undefined {
  const count = Math.min(u32(icc, HEADER_BYTES), MAX_TAGS)
  for (let index = 0; index < count; index += 1) {
    const entry = MIN_PROFILE_BYTES + index * 12
    if (text(icc, entry, 4) !== signature) continue
    const at = u32(icc, entry + 4)
    // s15Fixed16 numbers.
    const s15 = (offset: number) => (u32(icc, at + offset) | 0) / 65536
    return text(icc, at, 4) === 'XYZ ' ? [s15(8), s15(12), s15(16)] : undefined
  }
  return undefined
}

function near(colorant: Xyz | undefined, [x, y, z]: Xyz): boolean {
  return (
    colorant !== undefined &&
    Math.max(
      Math.abs(colorant[0] - x),
      Math.abs(colorant[1] - y),
      Math.abs(colorant[2] - z),
    ) <= PRIMARY_TOLERANCE
  )
}

/** Which RGB space a profile is, by its colorants. */
export function iccFamily(icc: Uint8Array): ColorFamily {
  if (iccChannels(icc) !== 3) return 'other'
  const red = xyzTag(icc, 'rXYZ')
  const green = xyzTag(icc, 'gXYZ')
  const blue = xyzTag(icc, 'bXYZ')
  return (
    FAMILIES.find((family) => {
      const primaries = RGB_PRIMARIES[family]
      return (
        near(red, primaries.red) &&
        near(green, primaries.green) &&
        near(blue, primaries.blue)
      )
    }) ?? 'other-rgb'
  )
}

/** The color of a photo file; never rejects. */
export async function readSourceColor(bytes: Uint8Array): Promise<SourceColor> {
  const deflated = pngDeflatedIcc(bytes)
  const icc =
    deflated === undefined ? jpegIccProfile(bytes) : await inflate(deflated)
  return icc === undefined || iccChannels(icc) === undefined
    ? { icc: undefined, family: 'srgb' }
    : { icc, family: iccFamily(icc) }
}

/**
 * The profile a PDF image with `channels` components is tagged with: its own
 * when it matches, sRGB for RGB images without one, none otherwise.
 */
export function profileForImage(
  icc: Uint8Array | undefined,
  channels: number,
): Uint8Array | undefined {
  if (icc !== undefined && iccChannels(icc) === channels) return icc
  return channels === 3 ? srgbIccProfile() : undefined
}

export interface MatrixProfileSpec {
  description: string
  primaries: RgbPrimaries
  /** Tone curve: one gamma, or a table of 0–1 values. */
  curve: { gamma: number } | { table: readonly number[] }
}

/** An ICC v2 RGB display profile of colorants and one tone curve. */
export function buildMatrixProfile(spec: MatrixProfileSpec): Uint8Array {
  const xyz = (value: Xyz) => {
    const tag = block('XYZ ', 12)
    writeXyz(tag.view, 8, value)
    return tag.bytes
  }
  const description = block('desc', 4 + spec.description.length + 1 + 79)
  description.view.setUint32(8, spec.description.length + 1)
  description.bytes.set(ascii.encode(spec.description), 12)
  const copyright = 'No copyright, use freely'
  const cprt = block('text', copyright.length + 1)
  cprt.bytes.set(ascii.encode(copyright), 8)
  // A one-entry curve is a u8Fixed8 gamma, longer ones are u16 tables.
  const points =
    'gamma' in spec.curve
      ? [Math.round(spec.curve.gamma * 256)]
      : spec.curve.table.map((value) => Math.round(value * 65535))
  const curve = block('curv', 4 + 2 * points.length)
  curve.view.setUint32(8, points.length)
  points.forEach((point, index) => {
    curve.view.setUint16(12 + index * 2, point)
  })
  const tags: [string[], Uint8Array][] = [
    [['desc'], description.bytes],
    [['cprt'], cprt.bytes],
    [['wtpt'], xyz(D50)],
    [['rXYZ'], xyz(spec.primaries.red)],
    [['gXYZ'], xyz(spec.primaries.green)],
    [['bXYZ'], xyz(spec.primaries.blue)],
    [['rTRC', 'gTRC', 'bTRC'], curve.bytes],
  ]
  const entries = tags.flatMap(([signatures]) => signatures).length
  let offset = MIN_PROFILE_BYTES + entries * 12
  const placed = tags.map(([signatures, data]) => {
    const at = offset
    offset += Math.ceil(data.length / 4) * 4
    return { signatures, data, at }
  })

  const out = new Uint8Array(offset)
  const view = new DataView(out.buffer)
  view.setUint32(0, offset)
  view.setUint32(8, 0x02100000)
  out.set(ascii.encode('mntrRGB XYZ '), 12)
  // Creation date 2026-01-01.
  view.setUint16(24, 2026)
  view.setUint16(26, 1)
  view.setUint16(28, 1)
  out.set(ascii.encode('acsp'), 36)
  writeXyz(view, 68, D50)
  view.setUint32(HEADER_BYTES, entries)
  let entry = MIN_PROFILE_BYTES
  for (const { signatures, data, at } of placed) {
    out.set(data, at)
    for (const signature of signatures) {
      out.set(ascii.encode(signature), entry)
      view.setUint32(entry + 4, at)
      view.setUint32(entry + 8, data.length)
      entry += 12
    }
  }
  return out
}

function writeXyz(view: DataView, at: number, value: Xyz): void {
  value.forEach((component, index) => {
    view.setInt32(at + index * 4, Math.round(component * 65536))
  })
}

/** A tag of `type` with `body` bytes after the type and reserved words. */
function block(type: string, body: number) {
  const bytes = new Uint8Array(8 + body)
  bytes.set(ascii.encode(type), 0)
  return { bytes, view: new DataView(bytes.buffer) }
}

/** IEC 61966-2.1 sRGB. */
export function srgbIccProfile(): Uint8Array {
  return buildMatrixProfile({
    description: 'sRGB IEC61966-2.1',
    primaries: RGB_PRIMARIES.srgb,
    curve: {
      table: Array.from({ length: 1024 }, (_, index) => {
        const value = index / 1023
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4
      }),
    },
  })
}
