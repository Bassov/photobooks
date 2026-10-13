/**
 * Generate a ~24MP JPEG (6000x4000) for LoAF e2e using jpeg-js.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import jpeg from 'jpeg-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const width = Number(process.env.JPEG_WIDTH ?? 6000)
const height = Number(process.env.JPEG_HEIGHT ?? 4000)
const outPath = join(__dirname, process.env.JPEG_OUT ?? 'large-24mp.jpg')

mkdirSync(__dirname, { recursive: true })
const started = Date.now()
const frameData = Buffer.alloc(width * height * 4)
for (let i = 0; i < frameData.length; i += 4) {
  frameData[i] = 15
  frameData[i + 1] = 107
  frameData[i + 2] = 92
  frameData[i + 3] = 255
}

const encoded = jpeg.encode({ data: frameData, width, height }, 50)
writeFileSync(outPath, encoded.data)
console.log(
  `Wrote ${outPath} ${width}x${height} (${encoded.data.length} bytes) in ${String(Date.now() - started)}ms`,
)
