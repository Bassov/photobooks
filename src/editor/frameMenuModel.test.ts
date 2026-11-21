import { describe, expect, it } from 'vitest'
import type { Book, Frame } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import {
  disabledRowIds,
  frameMenuRows,
  type FrameMenuContext,
  type FrameMenuEntry,
} from './frameMenuModel'

const PAGES: FrameMenuContext = {
  set: null,
  mirrorHasFrames: false,
  editScope: true,
}

/** f0 (under test) below f1 and f2 on spread s; gallery a, b. */
function book(f0: Partial<Frame> = {}, gallery = ['a', 'b']): Book {
  return makeBook({
    assets: Object.fromEntries(gallery.map((id) => [id, {}])),
    gallery,
    spreads: [
      makeSpread({
        id: 's',
        frames: [
          makeFrame({ id: 'f0', z: 1, ...f0 }),
          makeFrame({ id: 'f1', z: 2 }),
          makeFrame({ id: 'f2', z: 3 }),
        ],
      }),
    ],
  })
}

const target = { spreadId: 's', frameId: 'f0' }

/** Row ids, `|` for a separator, `!` before a disabled row. */
function shape(entries: readonly FrameMenuEntry[]): string[] {
  return entries.map((entry) =>
    entry === 'separator' ? '|' : `${entry.enabled ? '' : '!'}${entry.id}`,
  )
}

const EDIT = ['cut', 'copy', '!paste', 'duplicate']
const ORDER_BOTTOM = ['front', 'forward', '!backward', '!back']
const LOCK_DELETE = ['lock', 'delete']

describe('frameMenuRows', () => {
  it('filled photo frame: photo 4, edit 4, order 4, Lock + Delete', () => {
    const entries = frameMenuRows(book({ assetId: 'a' }), target, PAGES)
    expect(shape(entries)).toEqual([
      ...['replace', 'remove', 'fit', 'crop'],
      '|',
      ...EDIT,
      '|',
      ...ORDER_BOTTOM,
      '|',
      ...LOCK_DELETE,
    ])
    const rows = entries.filter((entry) => entry !== 'separator')
    expect(rows.map((entry) => [entry.label, entry.icon, entry.keys])).toEqual([
      ['Replace photo…', 'replace', undefined],
      ['Remove photo', 'imageOff', undefined],
      ['Fit photo to frame', 'shrink', undefined],
      ['Crop', 'crop', undefined],
      ['Cut', 'scissors', 'Ctrl+X'],
      ['Copy', 'copy', 'Ctrl+C'],
      ['Paste', 'clipboardPaste', 'Ctrl+V'],
      ['Duplicate', 'copyPlus', 'Ctrl+D'],
      ['Bring to front', 'bringToFront', 'Shift+Ctrl+]'],
      ['Bring forward', 'arrowUp', 'Ctrl+]'],
      ['Send backward', 'arrowDown', 'Ctrl+['],
      ['Send to back', 'sendToBack', 'Shift+Ctrl+['],
      ['Lock', 'lock', 'Ctrl+Shift+L'],
      ['Delete frame', 'delete', 'Del'],
    ])
    expect(rows.filter((entry) => entry.destructive === true)).toEqual([
      rows.at(-1),
    ])
  })

  it('a Fit frame offers Fill frame', () => {
    const fit = frameMenuRows(book({ assetId: 'a', fit: 'fit' }), target, PAGES)
    // No `keys` property on a row without a shortcut.
    expect(fit[2]).toStrictEqual({
      id: 'fit',
      label: 'Fill frame',
      icon: 'expand',
      enabled: true,
    })
  })

  it('empty photo frame: Place photo…, edit, order, Lock + Delete', () => {
    expect(shape(frameMenuRows(book(), target, PAGES))).toEqual([
      'place',
      '|',
      ...EDIT,
      '|',
      ...ORDER_BOTTOM,
      '|',
      ...LOCK_DELETE,
    ])
  })

  it('an empty gallery disables Place / Replace', () => {
    expect(shape(frameMenuRows(book({}, []), target, PAGES))[0]).toBe('!place')
    expect(
      shape(frameMenuRows(book({ assetId: 'a' }, []), target, PAGES))[0],
    ).toBe('!replace')
  })

  it('text frame: edit, order, Lock + Delete', () => {
    expect(shape(frameMenuRows(book({ kind: 'text' }), target, PAGES))).toEqual(
      [...EDIT, '|', ...ORDER_BOTTOM, '|', ...LOCK_DELETE],
    )
  })

  it('locked: Replace and Cut disabled; Remove, Fit, Crop, Copy, Duplicate, Delete enabled', () => {
    const entries = frameMenuRows(
      book({ assetId: 'a', locked: true }),
      target,
      { ...PAGES, mirrorHasFrames: true },
    )
    expect(shape(entries)).toEqual([
      ...['!replace', 'remove', 'fit', 'crop'],
      '|',
      ...['!cut', 'copy', 'paste', 'duplicate'],
      '|',
      ...ORDER_BOTTOM,
      '|',
      ...['lock', 'delete'],
    ])
    expect(entries).toContainEqual({
      id: 'lock',
      label: 'Unlock',
      icon: 'unlock',
      enabled: true,
      keys: 'Ctrl+Shift+L',
    })
    expect(disabledRowIds(entries)).toEqual([
      'replace',
      'cut',
      'backward',
      'back',
    ])
  })

  it('a set: edit, set moves, Lock + Delete N frames; Cut while any is unlocked', () => {
    const set = { spreadId: 's', frameIds: ['f0', 'f1'] }
    const locked = book({ assetId: 'a', locked: true })
    const entries = frameMenuRows(locked, target, { ...PAGES, set })
    expect(shape(entries)).toEqual([
      ...EDIT,
      '|',
      ...['front', 'forward', '!backward', '!back'],
      '|',
      ...LOCK_DELETE,
    ])
    const labels = entries.flatMap((entry) =>
      entry === 'separator' ? [] : [entry.label],
    )
    // One of the two is unlocked: the set locks.
    expect(labels.slice(-2)).toEqual(['Lock', 'Delete 2 frames'])
  })

  it('a set gone from the book has no rows', () => {
    const set = { spreadId: 's', frameIds: ['gone'] }
    expect(frameMenuRows(book(), target, { ...PAGES, set })).toEqual([])
    expect(
      frameMenuRows(book(), { spreadId: 's', frameId: 'gone' }, PAGES),
    ).toEqual([])
  })

  it('outside the Pages canvas: order + Lock + Delete only', () => {
    expect(
      shape(
        frameMenuRows(book({ assetId: 'a' }), target, {
          ...PAGES,
          editScope: false,
        }),
      ),
    ).toEqual([...ORDER_BOTTOM, '|', ...LOCK_DELETE])
  })

  it('override copy: Reset / Hide, photo, edit, Lock; no order rows, no Delete', () => {
    const copyBook = makeBook({
      assets: { a: {} },
      gallery: ['a'],
      parents: [
        {
          id: 'm',
          name: 'Master A',
          frames: [makeFrame({ id: 'logo' })],
          guides: [],
        },
      ],
      defaultParentId: 'm',
      spreads: [
        makeSpread({
          id: 's',
          frames: [],
          parentOverrides: {
            frames: [
              {
                ...makeFrame({ id: 'copy', assetId: 'a' }),
                overridesId: 'logo',
              },
            ],
          },
        }),
      ],
    })
    const entries = frameMenuRows(
      copyBook,
      { spreadId: 's', frameId: 'copy' },
      PAGES,
    )
    expect(shape(entries)).toEqual([
      'reset-parent',
      'hide-parent',
      '|',
      ...['replace', 'remove', 'fit', 'crop'],
      '|',
      ...EDIT,
      '|',
      'lock',
    ])
    // A set holding the copy is a set: no copy rows, order + Delete N.
    const set = { spreadId: 's', frameIds: ['copy'] }
    expect(
      shape(
        frameMenuRows(
          copyBook,
          { spreadId: 's', frameId: 'copy' },
          {
            ...PAGES,
            set,
          },
        ),
      ),
    ).toEqual([
      ...EDIT,
      '|',
      ...['!front', '!forward', '!backward', '!back'],
      '|',
      ...LOCK_DELETE,
    ])
  })
})
