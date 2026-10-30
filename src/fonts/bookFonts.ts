export type BookFontFamily = 'Inter Variable' | 'Lora Variable'
type BookFontScript = 'latin' | 'latin-ext' | 'cyrillic'
export type BookFontStyle = 'normal' | 'italic'

export interface BookFontFace {
  family: BookFontFamily
  style: BookFontStyle
  script: BookFontScript
  /** File name inside the book fonts folder (same bytes feed DOM and PDF). */
  file: string
  weightMin: number
  weightMax: number
  /** Inclusive codepoint ranges (CSS `unicode-range`). */
  ranges: readonly (readonly [number, number])[]
}

const INTER = {
  family: 'Inter Variable',
  weightMin: 100,
  weightMax: 900,
} as const
const LORA = {
  family: 'Lora Variable',
  weightMin: 400,
  weightMax: 700,
} as const

const CYRILLIC: BookFontFace['ranges'] = [
  [0x301, 0x301],
  [0x400, 0x45f],
  [0x490, 0x491],
  [0x4b0, 0x4b1],
  [0x2116, 0x2116],
]
const LATIN_EXT: BookFontFace['ranges'] = [
  [0x100, 0x2ba],
  [0x2bd, 0x2c5],
  [0x2c7, 0x2cc],
  [0x2ce, 0x2d7],
  [0x2dd, 0x2ff],
  [0x304, 0x304],
  [0x308, 0x308],
  [0x329, 0x329],
  [0x1d00, 0x1dbf],
  [0x1e00, 0x1e9f],
  [0x1ef2, 0x1eff],
  [0x2020, 0x2020],
  [0x20a0, 0x20ab],
  [0x20ad, 0x20c0],
  [0x2113, 0x2113],
  [0x2c60, 0x2c7f],
  [0xa720, 0xa7ff],
]
const LATIN: BookFontFace['ranges'] = [
  [0x0, 0xff],
  [0x131, 0x131],
  [0x152, 0x153],
  [0x2bb, 0x2bc],
  [0x2c6, 0x2c6],
  [0x2da, 0x2da],
  [0x2dc, 0x2dc],
  [0x304, 0x304],
  [0x308, 0x308],
  [0x329, 0x329],
  [0x2000, 0x206f],
  [0x20ac, 0x20ac],
  [0x2122, 0x2122],
  [0x2191, 0x2191],
  [0x2193, 0x2193],
  [0x2212, 0x2212],
  [0x2215, 0x2215],
  [0xfeff, 0xfeff],
  [0xfffd, 0xfffd],
]

const SCRIPTS = [
  ['cyrillic', CYRILLIC],
  ['latin-ext', LATIN_EXT],
  ['latin', LATIN],
] as const

function faces(
  base: typeof INTER | typeof LORA,
  prefix: string,
  style: BookFontStyle,
): BookFontFace[] {
  return SCRIPTS.map(([script, ranges]) => ({
    ...base,
    style,
    script,
    file: `${prefix}-${script}-wght-${style}.woff2`,
    ranges,
  }))
}

/** Curated set; mirrors `public/fonts/fonts.css` (a test keeps them in sync). */
export const BOOK_FONT_FACES: readonly BookFontFace[] = [
  ...faces(INTER, 'inter', 'normal'),
  ...faces(LORA, 'lora', 'normal'),
  ...faces(LORA, 'lora', 'italic'),
]

export function bookFontFamilies(): readonly BookFontFamily[] {
  return ['Inter Variable', 'Lora Variable']
}

export function bookFontFiles(): readonly string[] {
  return BOOK_FONT_FACES.map((f) => f.file)
}

export function faceCovers(face: BookFontFace, codePoint: number): boolean {
  return face.ranges.some(([lo, hi]) => codePoint >= lo && codePoint <= hi)
}

/** Faces of a family/style that carry the codepoint (script-specific first). */
export function facesForCodePoint(
  family: BookFontFamily,
  style: BookFontStyle,
  codePoint: number,
): BookFontFace[] {
  return BOOK_FONT_FACES.filter(
    (f) => f.family === family && f.style === style && faceCovers(f, codePoint),
  )
}

export function clampWeight(face: BookFontFace, weight: number): number {
  return Math.min(Math.max(weight, face.weightMin), face.weightMax)
}

function cp(n: number): string {
  return n.toString(16).toUpperCase().padStart(4, '0')
}

export function unicodeRangeCss(face: BookFontFace): string {
  return face.ranges
    .map(([lo, hi]) => (lo === hi ? `U+${cp(lo)}` : `U+${cp(lo)}-${cp(hi)}`))
    .join(', ')
}
