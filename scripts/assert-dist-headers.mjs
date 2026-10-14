import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const distHeaders = resolve(import.meta.dirname, '../dist/_headers')
const contents = readFileSync(distHeaders, 'utf8')
const required = [
  'Cross-Origin-Opener-Policy: same-origin',
  'Cross-Origin-Embedder-Policy: credentialless',
]

for (const snippet of required) {
  if (!contents.includes(snippet)) {
    console.error(`Missing in dist/_headers: ${snippet}`)
    process.exit(1)
  }
}

console.log('dist/_headers OK')
