/** Pixel size read from an encoded WebP / JPEG header (cache entries carry no dims). */

export interface EncodedImageSize {
  width: number
  height: number
}

function ascii(bytes: Uint8Array, at: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(at, at + length))
}

function u16le(bytes: Uint8Array, at: number): number {
  return (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8)
}

function u24le(bytes: Uint8Array, at: number): number {
  return u16le(bytes, at) | ((bytes[at + 2] ?? 0) << 16)
}

function u16be(bytes: Uint8Array, at: number): number {
  return ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0)
}

function webpSize(bytes: Uint8Array): EncodedImageSize | undefined {
  const chunk = ascii(bytes, 12, 4)
  if (chunk === 'VP8 ' && bytes.length >= 30) {
    // Key frame: 3-byte tag, start code, then 14-bit width / height.
    return {
      width: u16le(bytes, 26) & 0x3fff,
      height: u16le(bytes, 28) & 0x3fff,
    }
  }
  if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = u16le(bytes, 21) | (u16le(bytes, 23) << 16) // 14-bit width-1, height-1
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    }
  }
  if (chunk === 'VP8X' && bytes.length >= 30) {
    return { width: u24le(bytes, 24) + 1, height: u24le(bytes, 27) + 1 }
  }
  return undefined
}

/** SOFn markers that carry a frame size (not DHT C4, JPG C8, DAC CC). */
function isStartOfFrame(marker: number): boolean {
  return (
    marker >= 0xc0 &&
    marker <= 0xcf &&
    marker !== 0xc4 &&
    marker !== 0xc8 &&
    marker !== 0xcc
  )
}

function jpegSize(bytes: Uint8Array): EncodedImageSize | undefined {
  let at = 2
  while (at + 9 <= bytes.length) {
    if (bytes[at] !== 0xff) {
      return undefined
    }
    const marker = bytes[at + 1] ?? 0
    if (marker === 0xff) {
      at += 1
      continue
    }
    if (isStartOfFrame(marker)) {
      return { width: u16be(bytes, at + 7), height: u16be(bytes, at + 5) }
    }
    at += 2 + u16be(bytes, at + 2)
  }
  return undefined
}

export function encodedImageSize(
  bytes: Uint8Array,
): EncodedImageSize | undefined {
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return webpSize(bytes)
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return jpegSize(bytes)
  }
  return undefined
}
