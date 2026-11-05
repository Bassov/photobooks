/**
 * Builds two small JPEGs whose EXIF carries the live-caption tokens:
 * ImageDescription (title), Make + Model (camera), DateTimeOriginal (date).
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import jpeg from 'jpeg-js'
import { writeIfChanged } from './writeIfChanged.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const width = 60
const height = 40

const PHOTOS = [
  {
    file: 'meta-lake.jpg',
    rgb: [60, 110, 150],
    title: 'Morning on the lake',
    make: 'Canon',
    model: 'Canon EOS R5',
    taken: '2025:07:12 08:35:00',
  },
  {
    file: 'meta-hill.jpg',
    rgb: [150, 120, 60],
    title: 'Evening on the hill',
    make: 'Apple',
    model: 'iPhone 15 Pro',
    taken: '2024:03:05 18:10:00',
  },
]

const ASCII = 2
const LONG = 4

function solidJpeg([r, g, b]) {
  const data = Buffer.alloc(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = 255
  }
  return Buffer.from(jpeg.encode({ data, width, height }, 90).data)
}

/**
 * One little-endian IFD at `start` (TIFF offsets): 12-byte entries, then the
 * next-IFD link, then the ASCII values that do not fit in 4 bytes.
 */
function ifd(start, entries) {
  const head = 2 + entries.length * 12 + 4
  const values = []
  let valueAt = start + head
  const table = Buffer.alloc(head)
  table.writeUInt16LE(entries.length, 0)
  entries.forEach(({ tag, type, value }, index) => {
    const at = 2 + index * 12
    table.writeUInt16LE(tag, at)
    table.writeUInt16LE(type, at + 2)
    if (type === LONG) {
      table.writeUInt32LE(1, at + 4)
      table.writeUInt32LE(value, at + 8)
      return
    }
    const bytes = Buffer.from(`${value}\0`, 'ascii')
    table.writeUInt32LE(bytes.length, at + 4)
    table.writeUInt32LE(valueAt, at + 8)
    values.push(bytes)
    valueAt += bytes.length
  })
  return Buffer.concat([table, ...values])
}

function exifApp1(photo) {
  const ifd0Entries = [
    { tag: 0x010e, type: ASCII, value: photo.title },
    { tag: 0x010f, type: ASCII, value: photo.make },
    { tag: 0x0110, type: ASCII, value: photo.model },
    { tag: 0x8769, type: LONG, value: 0 },
  ]
  const first = ifd(8, ifd0Entries)
  ifd0Entries[3].value = 8 + first.length
  const ifd0 = ifd(8, ifd0Entries)
  const exif = ifd(8 + ifd0.length, [
    { tag: 0x9003, type: ASCII, value: photo.taken },
  ])
  const header = Buffer.alloc(8)
  header.write('II', 0)
  header.writeUInt16LE(42, 2)
  header.writeUInt32LE(8, 4)
  const payload = Buffer.concat([
    Buffer.from('Exif\0\0', 'ascii'),
    header,
    ifd0,
    exif,
  ])
  const app1 = Buffer.alloc(4 + payload.length)
  app1[0] = 0xff
  app1[1] = 0xe1
  app1.writeUInt16BE(payload.length + 2, 2)
  payload.copy(app1, 4)
  return app1
}

for (const photo of PHOTOS) {
  const plain = solidJpeg(photo.rgb)
  const out = join(__dirname, photo.file)
  writeIfChanged(
    out,
    Buffer.concat([plain.subarray(0, 2), exifApp1(photo), plain.subarray(2)]),
  )
  console.log(`wrote ${out} (${photo.title})`)
}
