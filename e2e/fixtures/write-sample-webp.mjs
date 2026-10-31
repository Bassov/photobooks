import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFixtureFile } from './writeFixtureFile.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** 30×20 solid teal WebP (VP8X+VP8), landscape 3:2 — Chromium canvas export, ICC stripped. */
const LOSSY_B64 =
  'UklGRlgAAABXRUJQVlA4WAoAAAAAAAAAHQAAEwAAVlA4IDoAAAAwAwCdASoeABQAPm00lkekIyIhKAgAgA2JZQAALnWbi5jAAP7wuG32yd6X//+Ur/43f7suCwx78AAA'

/** 30×20 solid teal WebP (VP8X+VP8L), landscape 3:2 — Chromium canvas quality=1, ICC stripped. */
const LOSSLESS_B64 =
  'UklGRjAAAABXRUJQVlA4WAoAAAAAAAAAHQAAEwAAVlA4TBEAAAAvHcAEAAfQtT6Uq/+BiOh/AAA='

const lossy = Buffer.from(LOSSY_B64, 'base64')
const lossless = Buffer.from(LOSSLESS_B64, 'base64')
/** Truncated RIFF/WEBP header — undecodable. */
const corrupt = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56,
  0x50, 0x38, 0x20,
])

const lossyPath = join(__dirname, 'sample-lossy-3x2.webp')
const losslessPath = join(__dirname, 'sample-lossless-3x2.webp')
const corruptPath = join(__dirname, 'sample-corrupt.webp')

writeFixtureFile(lossyPath, lossy)
writeFixtureFile(losslessPath, lossless)
writeFixtureFile(corruptPath, corrupt)

console.log(
  `wrote ${lossyPath} sha=${createHash('sha256').update(lossy).digest('hex').slice(0, 12)}`,
)
console.log(
  `wrote ${losslessPath} sha=${createHash('sha256').update(lossless).digest('hex').slice(0, 12)}`,
)
console.log(
  `wrote ${corruptPath} sha=${createHash('sha256').update(corrupt).digest('hex').slice(0, 12)}`,
)
