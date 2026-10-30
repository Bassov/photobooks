import { describe, expect, it } from 'vitest'
import { adjustFilter, frameStyleCss } from './frameLookCss'

const style = (
  patch: Partial<NonNullable<Parameters<typeof frameStyleCss>[0]>>,
) => ({
  matMm: 0,
  strokeMm: 0,
  cornerRadiusMm: 0,
  ...patch,
})

describe('frameStyleCss', () => {
  it('is empty without a style or with an all-zero one', () => {
    expect(frameStyleCss(undefined, 4)).toEqual({})
    expect(frameStyleCss(style({}), 4)).toEqual({})
  })

  it('paints the mat ring in its colour, default white', () => {
    expect(frameStyleCss(style({ matMm: 2, matColor: '#112233' }), 3)).toEqual({
      boxShadow: '0 0 0 6px #112233',
    })
    expect(frameStyleCss(style({ matMm: 2 }), 3).boxShadow).toBe(
      '0 0 0 6px #ffffff',
    )
  })

  it('paints the stroke ring outside the mat, default ink', () => {
    expect(frameStyleCss(style({ strokeMm: 1 }), 2).boxShadow).toBe(
      '0 0 0 2px #1c1b1a',
    )
    expect(
      frameStyleCss(style({ matMm: 2, strokeMm: 1, strokeColor: '#445566' }), 2)
        .boxShadow,
    ).toBe('0 0 0 4px #ffffff, 0 0 0 6px #445566')
  })

  it('scales the corner radius to px', () => {
    expect(frameStyleCss(style({ cornerRadiusMm: 2 }), 5)).toEqual({
      borderRadius: 10,
    })
  })
})

describe('adjustFilter', () => {
  it('is absent without an adjustment', () => {
    expect(adjustFilter(undefined)).toBeUndefined()
  })

  it('maps −100…100 to 0…2 around 1', () => {
    expect(
      adjustFilter({ brightness: 100, contrast: -100, saturation: 0 }),
    ).toBe('brightness(2) contrast(0) saturate(1)')
    expect(adjustFilter({ brightness: 50, contrast: 0, saturation: -50 })).toBe(
      'brightness(1.5) contrast(1) saturate(0.5)',
    )
  })
})
