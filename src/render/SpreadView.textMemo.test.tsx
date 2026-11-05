import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveSpread, type Book, type Frame } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { SpreadView } from './SpreadView'
import { textNodeStyle } from './textStyles'

vi.mock('./textStyles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./textStyles')>()
  return { ...actual, textNodeStyle: vi.fn(actual.textNodeStyle) }
})

function caption(id: string, anchorFrameId: string, x: number): Frame {
  return {
    id,
    kind: 'text',
    rect: { x, y: 60, width: 50, height: 8 },
    z: 5,
    content: { type: 'template', template: '{title}' },
    anchorFrameId,
  }
}

/** Photos in frames a / b / c; live captions follow a and b. */
function bookWith(assets: [string, string, string]): Book {
  const [a, b, c] = assets
  return makeBook({
    spreads: [
      makeSpread({
        frames: [
          makeFrame({
            id: 'a',
            rect: { x: 0, y: 0, width: 50, height: 50 },
            assetId: a,
          }),
          makeFrame({
            id: 'b',
            rect: { x: 60, y: 0, width: 50, height: 50 },
            assetId: b,
          }),
          makeFrame({
            id: 'c',
            rect: { x: 120, y: 0, width: 50, height: 50 },
            assetId: c,
          }),
          caption('ta', 'a', 0),
          caption('tb', 'b', 60),
        ],
      }),
    ],
    assets: {
      lake: { meta: { title: 'Lake' } },
      hill: { meta: { title: 'Hill' } },
      sea: { meta: { title: 'Sea' } },
    },
  })
}

function view(
  book: Book,
  options: { pxPerMm?: number; thumb?: boolean; editor?: boolean } = {},
) {
  const resolved = resolveSpread(book, 'spread-1')
  if (resolved === undefined) {
    throw new Error('unresolved')
  }
  return (
    <SpreadView
      spreadId="spread-1"
      resolved={resolved}
      previewUrlFor={() => undefined}
      pxPerMm={options.pxPerMm ?? 1}
      thumb={options.thumb ?? false}
      {...(options.editor === true
        ? { frameControlFor: () => ({ label: 'Frame', onActivate: vi.fn() }) }
        : {})}
    />
  )
}

/** `tb` restyled / realigned / resized (text frames only). */
function editCaption(book: Book, patch: Partial<Frame>): Book {
  return {
    ...book,
    spreads: book.spreads.map((spread) => ({
      ...spread,
      frames: spread.frames.map((frame) =>
        frame.id === 'tb' ? { ...frame, ...patch } : frame,
      ),
    })),
  }
}

// A memo skip leaves no DOM trace, so the paint is observed through the
// style builder every painted text node calls.
const style = vi.mocked(textNodeStyle)

afterEach(() => {
  cleanup()
  style.mockClear()
})

describe('SpreadView live caption repaint', () => {
  it('a swap repaints only the captions whose resolved string changed', () => {
    const { rerender } = render(view(bookWith(['lake', 'hill', 'sea'])))
    expect(style).toHaveBeenCalledTimes(2)
    rerender(view(bookWith(['sea', 'hill', 'lake'])))
    expect(style).toHaveBeenCalledTimes(3)
    expect(
      screen.getAllByTestId('frame-text').map((node) => node.textContent),
    ).toEqual(['Sea', 'Hill'])
  })

  it.each([
    [
      'style',
      {
        book: editCaption(bookWith(['lake', 'hill', 'sea']), {
          styleId: 'title',
        }),
      },
    ],
    [
      'align',
      {
        book: editCaption(bookWith(['lake', 'hill', 'sea']), {
          align: 'right',
        }),
      },
    ],
    [
      'height',
      {
        book: editCaption(bookWith(['lake', 'hill', 'sea']), {
          rect: { x: 60, y: 60, width: 50, height: 12 },
        }),
      },
    ],
    ['zoom', { pxPerMm: 2 }],
    ['thumb', { thumb: true }],
    ['editor', { editor: true }],
  ] as const)('a %s change repaints the caption', (_, change) => {
    const base = bookWith(['lake', 'hill', 'sea'])
    const { rerender } = render(view(base))
    style.mockClear()
    rerender(view(base))
    expect(style).not.toHaveBeenCalled()
    rerender(
      view(
        'book' in change ? change.book : base,
        'book' in change ? {} : change,
      ),
    )
    expect(style).toHaveBeenCalled()
  })
})
