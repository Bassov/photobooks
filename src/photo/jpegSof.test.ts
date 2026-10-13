import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { readJpegSofSize, stripJpegExif } from './jpegSof'
import exifr from 'exifr'

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../e2e/fixtures',
)

describe('jpegSof', () => {
  it('reads SOF size and strips EXIF from orientation fixture', async () => {
    execFileSync(process.execPath, [join(fixturesDir, 'write-exif-jpeg.mjs')], {
      stdio: 'pipe',
    })
    const original = readFileSync(join(fixturesDir, 'sample-orient6.jpg'))
    const size = readJpegSofSize(
      original.buffer.slice(
        original.byteOffset,
        original.byteOffset + original.byteLength,
      ),
    )
    expect(size).toEqual({ width: 40, height: 20 })
    expect(await exifr.orientation(original)).toBe(6)

    const stripped = stripJpegExif(
      original.buffer.slice(
        original.byteOffset,
        original.byteOffset + original.byteLength,
      ),
    )
    expect(await exifr.orientation(stripped)).toBeUndefined()
    expect(readJpegSofSize(stripped)).toEqual({ width: 40, height: 20 })
  })
})
