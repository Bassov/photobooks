import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fc } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import type { TextStyleId } from '../schema'
import { layoutTextFrame, type TextMetrics, textLineMm } from './textLayout'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number; numRuns: number } }

const runs = {
  seed: gates.pbt.seed,
  numRuns: Number(process.env.FC_NUM_RUNS ?? gates.pbt.numRuns),
}

const EPS = 1e-9

/** Proportional: `i` and space narrow, `m` wide. */
const METRICS: TextMetrics = {
  width: (text, font) =>
    Array.from(text).reduce(
      (sum, char) =>
        sum + (char === 'm' ? 0.9 : char === 'i' || char === ' ' ? 0.3 : 0.55),
      0,
    ) * font.sizeMm,
  ascent: (font) => font.sizeMm * 0.9,
  descent: (font) => font.sizeMm * 0.25,
}

const text = fc
  .array(fc.constantFrom('a', 'm', 'i', 'Я', ' ', '\n'), { maxLength: 80 })
  .map((chars) => chars.join(''))
const styleId = fc.constantFrom<TextStyleId>('title', 'caption', 'body')
const align = fc.constantFrom('left', 'center', 'right' as const)

describe('layoutTextFrame (PBT)', () => {
  it('keeps every line inside the frame, a line height apart, whole lines only', () => {
    fc.assert(
      fc.property(
        text,
        styleId,
        align,
        fc.double({ min: 10, max: 200, noNaN: true }),
        fc.double({ min: 0, max: 200, noNaN: true }),
        (value, style, side, width, height) => {
          const block = layoutTextFrame(
            { text: value, styleId: style, align: side },
            { width, height },
            METRICS,
          )
          const line = textLineMm(style)
          expect(block.lines.length * line).toBeLessThanOrEqual(height + EPS)
          block.lines.forEach((placed, index) => {
            const lineWidth = METRICS.width(placed.text, block.font)
            expect(placed.x).toBeGreaterThanOrEqual(-EPS)
            expect(placed.x + lineWidth).toBeLessThanOrEqual(width + EPS)
            expect(
              placed.baseline - (block.lines[0]?.baseline ?? 0),
            ).toBeCloseTo(index * line, 9)
          })
        },
      ),
      runs,
    )
  })

  it('loses no character but the spaces at line ends when every line shows', () => {
    fc.assert(
      fc.property(
        text,
        styleId,
        align,
        fc.double({ min: 10, max: 200, noNaN: true }),
        (value, style, side, width) => {
          const block = layoutTextFrame(
            { text: value, styleId: style, align: side },
            { width, height: 1e6 },
            METRICS,
          )
          const strip = (s: string) => s.replace(/[\s]/g, '')
          expect(block.lines.map((line) => strip(line.text)).join('')).toBe(
            strip(value),
          )
        },
      ),
      runs,
    )
  })
})
