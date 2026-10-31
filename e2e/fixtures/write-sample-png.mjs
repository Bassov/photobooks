import { deflateSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i]
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4)
  const crc = crc32(Buffer.concat([typeBuf, data]))
  crcBuf.writeUInt32BE(crc)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

/** 30x20 solid teal PNG — aspect 3:2 (RGB, colorType 2) */
function createPng(width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const row = Buffer.alloc(1 + width * 3)
  for (let x = 0; x < width; x += 1) {
    const o = 1 + x * 3
    row[o] = 15
    row[o + 1] = 107
    row[o + 2] = 92
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row))
  const idat = deflateSync(raw)

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * 32x32 RGBA PNG (colorType 6): opaque teal center, fully transparent
 * 8×8 corners — for preview-alpha regression sampling.
 */
function createTransparentCornersPng(size = 32, corner = 8) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const rows = []
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4)
    for (let x = 0; x < size; x += 1) {
      const nearLeft = x < corner
      const nearRight = x >= size - corner
      const nearTop = y < corner
      const nearBottom = y >= size - corner
      const transparent = (nearLeft || nearRight) && (nearTop || nearBottom)
      const o = 1 + x * 4
      row[o] = 15
      row[o + 1] = 107
      row[o + 2] = 92
      row[o + 3] = transparent ? 0 : 255
    }
    rows.push(row)
  }
  const idat = deflateSync(Buffer.concat(rows))

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Parallel workers re-run this; rewriting an identical file bumps its mtime and
// Chrome then fails reads of a File picked before the bump (NotReadableError).
function writeIfChanged(path, bytes) {
  if (existsSync(path) && readFileSync(path).equals(bytes)) return
  writeFileSync(path, bytes)
}

const out = join(__dirname, 'sample-3x2.png')
const rgb = createPng(30, 20)
writeIfChanged(out, rgb)
console.log(
  `wrote ${out} sha=${createHash('sha256').update(rgb).digest('hex').slice(0, 12)}`,
)

const transparentOut = join(__dirname, 'transparent_corners.png')
const rgba = createTransparentCornersPng()
writeIfChanged(transparentOut, rgba)
console.log(
  `wrote ${transparentOut} sha=${createHash('sha256').update(rgba).digest('hex').slice(0, 12)}`,
)
