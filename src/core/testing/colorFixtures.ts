import { buildMatrixProfile, RGB_PRIMARIES } from '../pdf/iccProfile'

/** An sRGB profile of its own (camera-style rounding), not the painter's. */
export const CAMERA_SRGB_ICC = buildMatrixProfile({
  description: 'sRGB built-in',
  primaries: {
    red: [0.436075, 0.222504, 0.013932],
    green: [0.385065, 0.716879, 0.097105],
    blue: [0.14308, 0.060617, 0.714173],
  },
  curve: { gamma: 2.2 },
})

export const ADOBE_RGB_ICC = buildMatrixProfile({
  description: 'Adobe RGB (1998)',
  primaries: RGB_PRIMARIES['adobe-rgb'],
  curve: { gamma: 563 / 256 },
})

export const DISPLAY_P3_ICC = buildMatrixProfile({
  description: 'Display P3',
  primaries: RGB_PRIMARIES['display-p3'],
  curve: { gamma: 2.2 },
})

/** Largest APP2 payload after the `ICC_PROFILE` head. */
const MAX_CHUNK = 65_519

function segment(marker: number, payload: readonly number[]): number[] {
  const length = payload.length + 2
  return [0xff, marker, length >> 8, length & 0xff, ...payload]
}

/**
 * A JPEG header only (SOI, ICC APP2 chunks, comment, SOF0 with `components`,
 * EOI): enough to embed, unique per `tag`.
 */
export function colorJpeg(
  tag: string,
  icc?: Uint8Array,
  options: { chunk?: number; components?: 1 | 3 | 4 } = {},
): Uint8Array {
  const { chunk = MAX_CHUNK, components = 3 } = options
  const parts: Uint8Array[] = []
  for (let at = 0; icc !== undefined && at < icc.length; at += chunk) {
    parts.push(icc.subarray(at, at + chunk))
  }
  const signature = [...new TextEncoder().encode('ICC_PROFILE\0')]
  const app2 = parts.flatMap((part, index) =>
    segment(0xe2, [...signature, index + 1, parts.length, ...part]),
  )
  const sof = segment(0xc0, [
    8,
    0,
    30,
    0,
    40,
    components,
    ...Array.from({ length: components }, (_, index) => [
      index + 1,
      0x11,
      0,
    ]).flat(),
  ])
  return new Uint8Array([
    0xff,
    0xd8,
    ...app2,
    ...segment(0xfe, [...new TextEncoder().encode(tag)]),
    ...sof,
    0xff,
    0xd9,
  ])
}
