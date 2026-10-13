/** Read baseline/progressive JPEG dimensions from SOF0–SOF3 markers. */
export function readJpegSofSize(
  buffer: ArrayBuffer,
): { width: number; height: number } | null {
  if (buffer.byteLength < 4) {
    return null
  }
  const view = new DataView(buffer)
  if (view.getUint8(0) !== 0xff || view.getUint8(1) !== 0xd8) {
    return null
  }

  let offset = 2
  while (offset + 9 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset += 1
      continue
    }
    const marker = view.getUint8(offset + 1)
    if (marker === 0xd9 || marker === 0xda) {
      return null
    }
    if (marker >= 0xc0 && marker <= 0xc3) {
      const height = view.getUint16(offset + 5, false)
      const width = view.getUint16(offset + 7, false)
      if (width > 0 && height > 0) {
        return { width, height }
      }
      return null
    }
    const length = view.getUint16(offset + 2, false)
    if (length < 2) {
      return null
    }
    offset += 2 + length
  }
  return null
}

/** Drop APP1 Exif segments so decoders cannot auto-apply orientation. */
export function stripJpegExif(buffer: ArrayBuffer): ArrayBuffer {
  if (buffer.byteLength < 4) {
    return buffer
  }
  const view = new DataView(buffer)
  if (view.getUint8(0) !== 0xff || view.getUint8(1) !== 0xd8) {
    return buffer
  }

  const bytes = new Uint8Array(buffer)
  const parts: Uint8Array[] = [bytes.subarray(0, 2)]
  let offset = 2
  while (offset + 3 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      parts.push(bytes.subarray(offset))
      break
    }
    const marker = view.getUint8(offset + 1)
    if (marker === 0xda) {
      parts.push(bytes.subarray(offset))
      break
    }
    if (marker === 0xd9) {
      parts.push(bytes.subarray(offset, offset + 2))
      break
    }
    const length = view.getUint16(offset + 2, false)
    const segmentEnd = offset + 2 + length
    if (length < 2 || segmentEnd > view.byteLength) {
      parts.push(bytes.subarray(offset))
      break
    }
    const isExifApp1 =
      marker === 0xe1 &&
      length >= 6 &&
      view.getUint8(offset + 4) === 0x45 &&
      view.getUint8(offset + 5) === 0x78 &&
      view.getUint8(offset + 6) === 0x69 &&
      view.getUint8(offset + 7) === 0x66
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
