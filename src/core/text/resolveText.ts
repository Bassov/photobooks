import type { Book, Frame, Spread, TextStyleId } from '../schema'

export interface ResolvedTextItem {
  frameId: string
  text: string
  styleId: TextStyleId
  align: 'left' | 'center' | 'right'
  /** Image frame the text follows; omitted when unanchored. */
  anchorFrameId?: string
}

const DEFAULT_TEXT_STYLE: TextStyleId = 'caption'
const DEFAULT_TEXT_ALIGN = 'left' as const

export function isTextFrame(frame: Frame): boolean {
  return frame.kind === 'text'
}

function anchorCaption(book: Book, spread: Spread, frame: Frame): string {
  const anchor = spread.frames.find((f) => f.id === frame.anchorFrameId)
  const meta = anchor?.assetId ? book.assets[anchor.assetId]?.meta : undefined
  return meta?.caption ?? meta?.title ?? ''
}

/** Replaces `{title}`, `{caption}` and `{spread}` (1-based); unknown tokens stay literal. */
function fillTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (token, name: string) =>
    Object.hasOwn(values, name) ? (values[name] ?? token) : token,
  )
}

/** Pure: text frames of a spread with content resolved against the book, in z order. */
export function resolveTextItems(
  book: Book,
  spread: Spread,
): ResolvedTextItem[] {
  const spreadNo = String(book.spreads.indexOf(spread) + 1)
  return spread.frames
    .filter(isTextFrame)
    .toSorted((a, b) => a.z - b.z)
    .map((frame) => {
      const content = frame.content
      const text =
        content === undefined
          ? ''
          : content.type === 'static'
            ? content.text
            : fillTemplate(content.template, {
                title: book.title ?? '',
                caption: anchorCaption(book, spread, frame),
                spread: spreadNo,
              })
      return {
        frameId: frame.id,
        text,
        styleId: frame.styleId ?? DEFAULT_TEXT_STYLE,
        align: frame.align ?? DEFAULT_TEXT_ALIGN,
        ...(frame.anchorFrameId === undefined
          ? {}
          : { anchorFrameId: frame.anchorFrameId }),
      }
    })
}
