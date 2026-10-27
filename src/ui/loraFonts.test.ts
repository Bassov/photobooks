import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const FONTS_DIR = path.join(ROOT, 'public', 'fonts')
const ITALIC_FILES = [
  'lora-cyrillic-wght-italic.woff2',
  'lora-latin-ext-wght-italic.woff2',
  'lora-latin-wght-italic.woff2',
] as const

describe('Lora Variable italic faces', () => {
  it('ships italic woff2 files and @font-face declarations', () => {
    const css = fs.readFileSync(path.join(FONTS_DIR, 'fonts.css'), 'utf8')
    for (const file of ITALIC_FILES) {
      expect(fs.existsSync(path.join(FONTS_DIR, file))).toBe(true)
      expect(css).toContain(`url('./${file}')`)
    }
    expect(css).toMatch(
      /font-family:\s*'Lora Variable'[\s\S]*?font-style:\s*italic/,
    )
  })
})
