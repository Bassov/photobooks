/**
 * Builds a small JPEG with EXIF Orientation=6 (90° CW → swapped display size).
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import jpeg from 'jpeg-js'
import { writeFixtureFile } from './writeFixtureFile.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const width = 40
const height = 20
const orientation = 6

const frameData = Buffer.alloc(width * height * 4)
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const i = (y * width + x) * 4
    frameData[i] = x < width / 2 ? 220 : 20
    frameData[i + 1] = 40
    frameData[i + 2] = y < height / 2 ? 40 : 200
    frameData[i + 3] = 255
  }
}

const encoded = jpeg.encode({ data: frameData, width, height }, 90)

function buildExifApp1(orient) {
  // TIFF header + IFD0 with Orientation tag only (little-endian)
  const tiff = Buffer.alloc(26)
  tiff.write('II', 0) // little endian
  tiff.writeUInt16LE(42, 2)
  tiff.writeUInt32LE(8, 4) // offset to IFD0
  tiff.writeUInt16LE(1, 8) // 1 entry
  // Tag Orientation (0x0112), type SHORT (3), count 1, value in next 4 bytes
  tiff.writeUInt16LE(0x0112, 10)
  tiff.writeUInt16LE(3, 12)
  tiff.writeUInt32LE(1, 14)
  tiff.writeUInt16LE(orient, 18)
  tiff.writeUInt16LE(0, 20) // padding in value slot
  tiff.writeUInt32LE(0, 22) // next IFD

  const exifHeader = Buffer.from('Exif\0\0', 'ascii')
  const payload = Buffer.concat([exifHeader, tiff])
  const app1 = Buffer.alloc(4 + payload.length)
  app1[0] = 0xff
  app1[1] = 0xe1
  app1.writeUInt16BE(payload.length + 2, 2)
  payload.copy(app1, 4)
  return app1
}

const jpegBuf = Buffer.from(encoded.data)
// Insert APP1 after SOI (FFD8)
const withExif = Buffer.concat([
  jpegBuf.subarray(0, 2),
  buildExifApp1(orientation),
  jpegBuf.subarray(2),
])

const out = join(__dirname, 'sample-orient6.jpg')
writeFixtureFile(out, withExif)
console.log(
  `wrote ${out} (${width}x${height}, Orientation=${String(orientation)})`,
)
