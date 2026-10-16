import type { DerivedCacheEntry } from './types'

export function encodeDerivedCacheEntry(entry: DerivedCacheEntry): ArrayBuffer {
  const mimeBytes = new TextEncoder().encode(entry.mimeType)
  const image = new Uint8Array(entry.bytes)
  const out = new Uint8Array(4 + mimeBytes.length + image.byteLength)
  const view = new DataView(out.buffer)
  view.setUint32(0, mimeBytes.length, false)
  out.set(mimeBytes, 4)
  out.set(image, 4 + mimeBytes.length)
  return out.buffer
}

export function decodeDerivedCacheEntry(
  buffer: ArrayBuffer,
): DerivedCacheEntry | undefined {
  if (buffer.byteLength < 4) {
    return undefined
  }
  const view = new DataView(buffer)
  const mimeLength = view.getUint32(0, false)
  if (mimeLength === 0 || 4 + mimeLength > buffer.byteLength) {
    return undefined
  }
  const mimeBytes = new Uint8Array(buffer, 4, mimeLength)
  const mimeType = new TextDecoder().decode(mimeBytes)
  if (mimeType.length === 0) {
    return undefined
  }
  const imageOffset = 4 + mimeLength
  const imageBytes = buffer.slice(imageOffset)
  return { bytes: imageBytes, mimeType }
}
