import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fc } from '@fast-check/vitest'
import { ADOBE_RGB_ICC, colorJpeg } from '../testing/colorFixtures'
import {
  iccChannels,
  iccFamily,
  jpegIccProfile,
  pngDeflatedIcc,
  readSourceColor,
} from './iccProfile'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number; numRuns: number } }

const runs = {
  seed: gates.pbt.seed,
  numRuns: Number(process.env.FC_NUM_RUNS ?? gates.pbt.numRuns),
}

const bytes = fc.uint8Array({ maxLength: 600 })

/** Arbitrary tails behind the headers the readers look for. */
const prefixed = fc
  .tuple(
    fc.constantFrom(
      [],
      [0xff, 0xd8],
      [0xff, 0xd8, 0xff, 0xe2],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      [...ADOBE_RGB_ICC.subarray(0, 132)],
    ),
    bytes,
  )
  .map(([head, tail]) => new Uint8Array([...head, ...tail]))

/** A real profile with arbitrary bytes written over part of it. */
const corrupted = fc
  .tuple(
    fc.nat({ max: ADOBE_RGB_ICC.length - 1 }),
    fc.uint8Array({ minLength: 1, maxLength: 16 }),
  )
  .map(([at, patch]) => {
    const icc = ADOBE_RGB_ICC.slice()
    icc.set(patch.subarray(0, icc.length - at), at)
    return icc
  })

describe('iccProfile properties', () => {
  it('never throws on arbitrary bytes', async () => {
    await fc.assert(
      fc.asyncProperty(fc.oneof(prefixed, corrupted), async (input) => {
        jpegIccProfile(input)
        pngDeflatedIcc(input)
        iccChannels(input)
        iccFamily(input)
        const color = await readSourceColor(input)
        // Untagged (or unreadable) → sRGB.
        expect(color.icc !== undefined || color.family === 'srgb').toBe(true)
      }),
      runs,
    )
  })

  it('counts every untagged JPEG as sRGB', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 40 }), async (tag) => {
        await expect(readSourceColor(colorJpeg(tag))).resolves.toEqual({
          icc: undefined,
          family: 'srgb',
        })
      }),
      runs,
    )
  })

  it('reads back any profile split into any chunk size', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1, maxLength: 2000 }),
        // At most 255 chunks (one sequence byte).
        fc.integer({ min: 8, max: 700 }),
        (icc, chunk) => {
          expect(jpegIccProfile(colorJpeg('split', icc, { chunk }))).toEqual(
            icc,
          )
        },
      ),
      runs,
    )
  })
})
