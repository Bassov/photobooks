function readU8(bytes: Uint8Array, index: number): number | null {
  return bytes[index] ?? null
}

function readU16(bytes: Uint8Array, index: number): number | null {
  const high = readU8(bytes, index)
  const low = readU8(bytes, index + 1)
  if (high === null || low === null) {
    return null
  }
  return (high << 8) | low
}

/** Read baseline/progressive JPEG dimensions from SOF0–SOF3 markers. */
export function readJpegSofSize(
  buffer: ArrayBuffer,
): { width: number; height: number } | null {
  const bytes = new Uint8Array(buffer)
  if (
    bytes.length < 4 ||
    readU8(bytes, 0) !== 0xff ||
    readU8(bytes, 1) !== 0xd8
  ) {
    return null
  }

  let offset = 2
  while (offset + 9 < bytes.length) {
    if (readU8(bytes, offset) !== 0xff) {
      offset += 1
      continue
    }
    const marker = readU8(bytes, offset + 1)
    if (marker === null) {
      return null
    }
    if (marker === 0xd9 || marker === 0xda) {
      return null
    }
    if (marker >= 0xc0 && marker <= 0xc3) {
      const height = readU16(bytes, offset + 5)
      const width = readU16(bytes, offset + 7)
      if (height === null || width === null) {
        return null
      }
      if (width > 0 && height > 0) {
        return { width, height }
      }
      return null
    }
    const length = readU16(bytes, offset + 2)
    if (length === null || length < 2) {
      return null
    }
    offset += 2 + length
  }
  return null
}

/** Drop APP1 Exif segments so decoders cannot auto-apply orientation. */
export function stripJpegExif(buffer: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return buffer
  }

  const parts: Uint8Array[] = [bytes.subarray(0, 2)]
  let offset = 2
  while (offset + 3 < bytes.length) {
    if (readU8(bytes, offset) !== 0xff) {
      parts.push(bytes.subarray(offset))
      break
    }
    const marker = readU8(bytes, offset + 1)
    if (marker === null) {
      parts.push(bytes.subarray(offset))
      break
    }
    if (marker === 0xda) {
      parts.push(bytes.subarray(offset))
      break
    }
    if (marker === 0xd9) {
      parts.push(bytes.subarray(offset, offset + 2))
      break
    }
    const length = readU16(bytes, offset + 2)
    if (length === null) {
      parts.push(bytes.subarray(offset))
      break
    }
    const segmentEnd = offset + 2 + length
    if (length < 2 || segmentEnd > bytes.length) {
      parts.push(bytes.subarray(offset))
      break
    }
    const isExifApp1 =
      marker === 0xe1 &&
      readU8(bytes, offset + 4) === 0x45 &&
      readU8(bytes, offset + 5) === 0x78 &&
      readU8(bytes, offset + 6) === 0x69 &&
      readU8(bytes, offset + 7) === 0x66
    if (!isExifApp1) {
      parts.push(bytes.subarray(offset, segmentEnd))
    }
    offset = segmentEnd
  }

  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let cursor = 0
  for (const part of parts) {
    out.set(part, cursor)
    cursor += part.length
  }
  return out.buffer
}
