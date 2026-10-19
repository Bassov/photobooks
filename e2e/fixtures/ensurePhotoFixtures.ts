import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const fixturesDir = dirname(fileURLToPath(import.meta.url))

export const photoFixturePaths = {
  dir: fixturesDir,
  samplePng: join(fixturesDir, 'sample-3x2.png'),
  sampleOrient6: join(fixturesDir, 'sample-orient6.jpg'),
  sampleLossyWebp: join(fixturesDir, 'sample-lossy-3x2.webp'),
  sampleLosslessWebp: join(fixturesDir, 'sample-lossless-3x2.webp'),
  sampleCorruptWebp: join(fixturesDir, 'sample-corrupt.webp'),
  largeJpeg: join(fixturesDir, 'large-24mp.jpg'),
} as const

export function ensurePhotoFixtures(options?: {
  includeLargeJpeg?: boolean
}): void {
  execFileSync(process.execPath, [join(fixturesDir, 'write-sample-png.mjs')], {
    stdio: 'pipe',
  })
  execFileSync(process.execPath, [join(fixturesDir, 'write-exif-jpeg.mjs')], {
    stdio: 'pipe',
  })
  execFileSync(process.execPath, [join(fixturesDir, 'write-sample-webp.mjs')], {
    stdio: 'pipe',
  })

  if (options?.includeLargeJpeg !== false) {
    if (!existsSync(photoFixturePaths.largeJpeg)) {
      execFileSync(
        process.execPath,
        [join(fixturesDir, 'generate-large-jpeg.mjs')],
        { stdio: 'pipe' },
      )
    }
  }
}
