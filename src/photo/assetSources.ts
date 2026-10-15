interface StoredSource {
  file: File
  cover: boolean
}

const sources = new Map<string, StoredSource>()

export function retainAssetSource(
  assetId: string,
  file: File,
  options: { cover?: boolean } = {},
): void {
  sources.set(assetId, { file, cover: options.cover === true })
}

export function getAssetSource(assetId: string): File | undefined {
  return sources.get(assetId)?.file
}

export function assetSourceCovers(assetId: string): boolean {
  return sources.get(assetId)?.cover === true
}

export function resetAssetSources(): void {
  sources.clear()
}

const PAINTER_RGB: Record<string, readonly [number, number, number]> = {
  'painter-a': [0x6b, 0x8f, 0x71],
  'painter-b': [0xc4, 0xa5, 0x74],
  'painter-c': [0x8a, 0x9a, 0x84],
  'painter-d': [0xd0, 0x7a, 0x5a],
}

export function painterSourceFile(assetId: string): File {
  const color: readonly [number, number, number] = PAINTER_RGB[assetId] ?? [
    0x88, 0x88, 0x88,
  ]
  const bytes = solidPng(2, 2, color[0], color[1], color[2])
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new File([buffer], `${assetId}.png`, { type: 'image/png' })
}

function solidPng(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
): Uint8Array {
  const stride = 1 + width * 3
  const raw = new Uint8Array(height * stride)
  for (let y = 0; y < height; y += 1) {
    const row = y * stride
    raw[row] = 0
    for (let x = 0; x < width; x += 1) {
      const index = row + 1 + x * 3
      raw[index] = r
      raw[index + 1] = g
      raw[index + 2] = b
    }
  }
  return encodePng(width, height, raw)
}

function encodePng(width: number, height: number, raw: Uint8Array): Uint8Array {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  const ihdr = new Uint8Array(13)
  writeU32(ihdr, 0, width)
  writeU32(ihdr, 4, height)
  ihdr[8] = 8
  ihdr[9] = 2
  const chunks = [
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibStore(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]
  const size =
    signature.length + chunks.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(size)
  out.set(signature, 0)
  let offset = signature.length
  for (const part of chunks) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  writeU32(out, 0, data.length)
  out[4] = type.charCodeAt(0)
  out[5] = type.charCodeAt(1)
  out[6] = type.charCodeAt(2)
  out[7] = type.charCodeAt(3)
  out.set(data, 8)
  const crcInput = out.subarray(4, 8 + data.length)
  writeU32(out, 8 + data.length, crc32(crcInput))
  return out
}

function zlibStore(data: Uint8Array): Uint8Array {
  const len = data.length
  const out = new Uint8Array(7 + len + 4)
  out[0] = 0x78
  out[1] = 0x01
  out[2] = 0x01
  out[3] = len & 0xff
  out[4] = (len >> 8) & 0xff
  const nlen = ~len & 0xffff
  out[5] = nlen & 0xff
  out[6] = (nlen >> 8) & 0xff
  out.set(data, 7)
  const sum = adler32(data)
  const end = 7 + len
  out[end] = (sum >>> 24) & 0xff
  out[end + 1] = (sum >>> 16) & 0xff
  out[end + 2] = (sum >>> 8) & 0xff
  out[end + 3] = sum & 0xff
  return out
}

function adler32(data: Uint8Array): number {
  let a = 1
  let b = 0
  for (const byte of data) {
    a = (a + byte) % 65521
    b = (b + a) % 65521
  }
  return (b << 16) | a
}

function crc32(data: Uint8Array): number {
  let c = ~0
  for (const byte of data) {
    c ^= byte
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
  }
  return ~c >>> 0
}

function writeU32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = (value >>> 24) & 0xff
  target[offset + 1] = (value >>> 16) & 0xff
  target[offset + 2] = (value >>> 8) & 0xff
  target[offset + 3] = value & 0xff
}
