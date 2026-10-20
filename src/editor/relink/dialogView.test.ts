import { describe, expect, it } from 'vitest'

import {
  badgeClassName,
  buildRelinkDialogView,
  filesFromFileList,
  rowBadgeLabel,
  rowStatusAttr,
  shouldCloseAfterResolve,
} from './dialogView'

describe('dialogView', () => {
  it('builds the dialog view from store snapshots', () => {
    const view = buildRelinkDialogView(
      new Map([
        ['a', 'missing'],
        ['b', 'ok'],
      ]),
      new Set(['a']),
      { total: 4, completed: 1, running: true },
      'problems',
    )

    expect(view.title).toBe('No photos need attention')
    expect(view.rows).toHaveLength(1)
    expect(view.rows[0]?.assetId).toBe('a')
    expect(view.scanning).toBe(true)
    expect(view.pct).toBe(25)
    expect(view.resolveCount).toBe(1)
    expect(view.resolveDisabled).toBe(true)
    expect(view.resolveText).toBe('Resolve 1')
  })

  it('marks idle resolve when not scanning', () => {
    const view = buildRelinkDialogView(
      new Map([['a', 'missing']]),
      new Set(),
      null,
      'all',
    )
    expect(view.title).toBe('1 photos need attention')
    expect(view.scanning).toBe(false)
    expect(view.resolveDisabled).toBe(true)
    expect(view.resolveText).toBe('Resolve')
    expect(view.rows).toHaveLength(1)
  })

  it('enables resolve when found and idle', () => {
    const view = buildRelinkDialogView(
      new Map([['a', 'missing']]),
      new Set(['a']),
      { total: 1, completed: 1, running: false },
      'problems',
    )
    expect(view.resolveDisabled).toBe(false)
  })

  it('filesFromFileList returns null for empty input', () => {
    expect(filesFromFileList(null)).toBeNull()
    const empty = { length: 0 } as FileList
    expect(filesFromFileList(empty)).toBeNull()
  })

  it('filesFromFileList copies a non-empty FileList', () => {
    const file = new File([new Uint8Array([1])], 'a.jpg')
    const list = {
      0: file,
      length: 1,
      item: (i: number) => (i === 0 ? file : null),
      [Symbol.iterator]: function* () {
        yield file
      },
    } as unknown as FileList
    expect(filesFromFileList(list)).toEqual([file])
  })

  it('shouldCloseAfterResolve is true only for positive counts', () => {
    expect(shouldCloseAfterResolve(0)).toBe(false)
    expect(shouldCloseAfterResolve(1)).toBe(true)
  })

  it('badge class helpers', () => {
    expect(badgeClassName(true, 'missing')).toBe(
      'relink-badge relink-badge-found',
    )
    expect(badgeClassName(false, 'missing')).toBe(
      'relink-badge relink-badge-missing',
    )
    expect(rowBadgeLabel(true, 'missing')).toBe('Found')
    expect(rowStatusAttr(false, 'modified')).toBe('modified')
  })
})
