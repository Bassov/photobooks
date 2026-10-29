import { inflateSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import { PAINTER_ASSET_IDS } from '../core/testing/painterFixture'
import { getBookStoreSnapshot, resetBookStore } from '../editor/bookStore'
import {
  assetSourceCovers,
  getAssetSource,
  resetAssetSources,
} from '../photo/assetSources'
import { loadPainterFixture } from './loadPainterFixture'
import { painterSourceFile } from './painterSourceFile'

afterEach(() => {
  resetAssetSources()
  resetBookStore()
})

interface PngChunk {
  type: string
  data: Uint8Array
  crc: number
  crcOk: boolean
}

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of data) {
    c ^= byte
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
  }
  return (c ^ 0xffffffff) >>> 0
}

function readChunks(bytes: Uint8Array): PngChunk[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const chunks: PngChunk[] = []
  let offset = 8
  while (offset < bytes.length) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    const data = bytes.subarray(offset + 8, offset + 8 + length)
    const crc = view.getUint32(offset + 8 + length)
    const crcOk = crc === crc32(bytes.subarray(offset + 4, offset + 8 + length))
    chunks.push({ type, data, crc, crcOk })
    offset += 12 + length
  }
  expect(offset).toBe(bytes.length)
  return chunks
}

async function decode(assetId: string) {
  const file = painterSourceFile(assetId)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const chunks = readChunks(bytes)
  const ihdr = new DataView(
    chunks[0].data.buffer,
    chunks[0].data.byteOffset,
    chunks[0].data.byteLength,
  )
  const pixels = inflateSync(chunks[1].data)
  return { file, bytes, chunks, ihdr, pixels }
}

describe('painterSourceFile', () => {
  it('builds a well-formed 2x2 RGB png named after the asset', async () => {
    const { file, bytes, chunks, ihdr, pixels } = await decode('painter-a')

    expect(file.name).toBe('painter-a.png')
    expect(file.type).toBe('image/png')
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(chunks.map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'IEND'])
    expect(chunks.every((c) => c.crcOk)).toBe(true)
    expect(chunks[2].data.length).toBe(0)
    expect(chunks[0].data.length).toBe(13)
    expect(ihdr.getUint32(0)).toBe(2)
    expect(ihdr.getUint32(4)).toBe(2)
    expect(chunks[0].data[8]).toBe(8)
    expect(chunks[0].data[9]).toBe(2)
    expect(chunks[0].data[10]).toBe(0)
    expect(chunks[0].data[11]).toBe(0)
    expect(chunks[0].data[12]).toBe(0)
    expect(pixels.length).toBe(2 * (1 + 2 * 3))
  })

  it('fills every pixel with the asset color', async () => {
    const expected: Record<string, number[]> = {
      'painter-a': [0x6b, 0x8f, 0x71],
      'painter-b': [0xc4, 0xa5, 0x74],
      'painter-c': [0x8a, 0x9a, 0x84],
      'painter-d': [0xd0, 0x7a, 0x5a],
      unknown: [0x88, 0x88, 0x88],
    }
    for (const [id, rgb] of Object.entries(expected)) {
      const { pixels } = await decode(id)
      for (let row = 0; row < 2; row += 1) {
        expect(pixels[row * 7]).toBe(0)
        for (let x = 0; x < 2; x += 1) {
          const at = row * 7 + 1 + x * 3
          expect([...pixels.subarray(at, at + 3)]).toEqual(rgb)
        }
      }
    }
  })
})

describe('loadPainterFixture', () => {
  it('loads the painter book and retains a covering png per asset', () => {
    loadPainterFixture()

    const snap = getBookStoreSnapshot()
    expect(snap.book.id).toBe('painter-fixture')
    expect(snap.importRunning).toBe(false)
    expect(snap.importExpectedCount).toBe(0)
    for (const assetId of PAINTER_ASSET_IDS) {
      expect(getAssetSource(assetId)?.type).toBe('image/png')
      expect(getAssetSource(assetId)?.name).toBe(`${assetId}.png`)
      expect(assetSourceCovers(assetId)).toBe(true)
    }
  })
})
