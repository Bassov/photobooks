/**
 * Builds raw 20x40 (portrait pixels) JPEGs with EXIF Orientation 6 and 8 (both
 * display as 40x20 landscape) plus an unrotated 5x10 IFD1 thumbnail, like a
 * camera file. Also orientation 3 and 1 files (raw 40x20, display 40x20).
 * Raw quadrants: top-left red, top-right dark, bottom-left magenta,
 * bottom-right blue.
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import jpeg from 'jpeg-js'
import { writeIfChanged } from './writeIfChanged.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

function encode(width, height) {
  const data = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      data[i] = x < width / 2 ? 220 : 20
      data[i + 1] = 40
      data[i + 2] = y < height / 2 ? 40 : 200
      data[i + 3] = 255
    }
  }
  return Buffer.from(jpeg.encode({ data, width, height }, 90).data)
}

/** APP1 with IFD0 (Orientation) and IFD1 (JPEG thumbnail), little-endian. */
function buildExifApp1(orientation, thumb) {
  const ifd0Offset = 8
  const ifd1Offset = ifd0Offset + 2 + 12 + 4
  const thumbOffset = ifd1Offset + 2 + 12 * 3 + 4
  const tiff = Buffer.alloc(thumbOffset + thumb.length)
  tiff.write('II', 0)
  tiff.writeUInt16LE(42, 2)
  tiff.writeUInt32LE(ifd0Offset, 4)
  tiff.writeUInt16LE(1, ifd0Offset)
  tiff.writeUInt16LE(0x0112, ifd0Offset + 2)
  tiff.writeUInt16LE(3, ifd0Offset + 4)
  tiff.writeUInt32LE(1, ifd0Offset + 6)
  tiff.writeUInt16LE(orientation, ifd0Offset + 10)
  tiff.writeUInt32LE(ifd1Offset, ifd0Offset + 14)
  tiff.writeUInt16LE(3, ifd1Offset)
  let e = ifd1Offset + 2
  // Compression = 6 (JPEG), JPEGInterchangeFormat, JPEGInterchangeFormatLength
  for (const [tag, type, value] of [
    [0x0103, 3, 6],
    [0x0201, 4, thumbOffset],
    [0x0202, 4, thumb.length],
  ]) {
    tiff.writeUInt16LE(tag, e)
    tiff.writeUInt16LE(type, e + 2)
    tiff.writeUInt32LE(1, e + 4)
    if (type === 3) {
      tiff.writeUInt16LE(value, e + 8)
    } else {
      tiff.writeUInt32LE(value, e + 8)
    }
    e += 12
  }
  tiff.writeUInt32LE(0, e)
  thumb.copy(tiff, thumbOffset)
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'ascii'), tiff])
  const app1 = Buffer.alloc(4 + payload.length)
  app1[0] = 0xff
  app1[1] = 0xe1
  app1.writeUInt16BE(payload.length + 2, 2)
  payload.copy(app1, 4)
  return app1
}

function write(name, orientation, width, height) {
  const body = encode(width, height)
  const thumb = encode(width / 4, height / 4)
  const out = join(__dirname, name)
  writeIfChanged(
    out,
    Buffer.concat([
      body.subarray(0, 2),
      buildExifApp1(orientation, thumb),
      body.subarray(2),
    ]),
  )
  console.log(
    `wrote ${out} (raw ${width}x${height}, Orientation=${orientation})`,
  )
}

write('sample-orient6-landscape.jpg', 6, 20, 40)
write('sample-orient8-landscape.jpg', 8, 20, 40)
write('sample-orient3-landscape.jpg', 3, 40, 20)
write('sample-orient1-landscape.jpg', 1, 40, 20)
