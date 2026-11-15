import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  type PDFDocument,
  PDFName,
  type PDFPage,
  PDFRawStream,
  PDFRef,
} from '@cantoo/pdf-lib'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { FontFileSource } from './pdfFonts'

/** The app's own font files (`public/fonts`), read from disk. */
export const bookFontFiles: FontFileSource = (file) =>
  Promise.resolve(
    new Uint8Array(readFileSync(resolve(process.cwd(), 'public/fonts', file))),
  )

function decoded(stream: PDFRawStream): string {
  return new TextDecoder('latin1').decode(decodePDFRawStream(stream).decode())
}

function lookup(doc: PDFDocument, value: unknown): unknown {
  return value instanceof PDFRef ? doc.context.lookup(value) : value
}

/** Glyph code (4 hex digits) → text, from a Type0 font's `ToUnicode`. */
function toUnicode(doc: PDFDocument, font: PDFDict): Map<string, string> {
  const cmap = lookup(doc, font.get(PDFName.of('ToUnicode')))
  const map = new Map<string, string>()
  if (!(cmap instanceof PDFRawStream)) return map
  for (const [, code = '', text = ''] of decoded(cmap).matchAll(
    /<([0-9a-fA-F]{4})> <([0-9a-fA-F]+)>/g,
  )) {
    const units = text.match(/.{4}/g) ?? []
    map.set(
      code.toLowerCase(),
      String.fromCharCode(...units.map((unit) => parseInt(unit, 16))),
    )
  }
  return map
}

/** The page's Type0 fonts by resource name. */
function pageFonts(doc: PDFDocument, page: PDFPage): Map<string, PDFDict> {
  const fonts = page.node.Resources()?.lookupMaybe(PDFName.of('Font'), PDFDict)
  const byName = new Map<string, PDFDict>()
  for (const [name, ref] of fonts?.entries() ?? []) {
    const font = lookup(doc, ref)
    if (font instanceof PDFDict) byName.set(name.asString(), font)
  }
  return byName
}

/** The page's content streams, decoded and joined. */
export function pageContent(doc: PDFDocument, page: PDFPage): string {
  const contents = page.node.normalizedEntries().Contents
  const streams =
    contents instanceof PDFArray
      ? contents.asArray().map((ref) => doc.context.lookup(ref))
      : []
  return streams
    .filter((stream): stream is PDFRawStream => stream instanceof PDFRawStream)
    .map(decoded)
    .join('\n')
}

/** Text of each `BT … ET` object on the page (one per set line), in order. */
export function pageLines(doc: PDFDocument, page: PDFPage): string[] {
  const maps = new Map(
    [...pageFonts(doc, page)].map(([name, font]) => [
      name,
      toUnicode(doc, font),
    ]),
  )
  return [...pageContent(doc, page).matchAll(/\bBT\b([\s\S]*?)\bET\b/g)].map(
    ([, body = '']) => {
      let map = new Map<string, string>()
      let text = ''
      for (const [, font, array] of body.matchAll(
        /\/(\S+) [\d.]+ Tf|\[([^\]]*)\] TJ/g,
      )) {
        if (font !== undefined)
          map = maps.get(`/${font}`) ?? new Map<string, string>()
        for (const [, hex = ''] of (array ?? '').matchAll(
          /<([0-9a-fA-F]*)>/g,
        )) {
          for (const code of hex.match(/.{4}/g) ?? []) {
            text += map.get(code.toLowerCase()) ?? '�'
          }
        }
      }
      return text
    },
  )
}
