import type { Asset, Book, Frame, Spread } from '../core'
import { defaultAnchorFrame } from '../core/ops/frames'
import { resolveTextContent } from '../core/text/resolveText'

/** Chip order of the Live block (Designer live-captions). */
export const LIVE_TOKENS = ['date', 'title', 'caption', 'camera'] as const
export type LiveToken = (typeof LIVE_TOKENS)[number]

/** Kit separator between appended tokens. */
const TOKEN_JOIN = ' · '

/** Text field selection remembered at its last blur. */
export interface Caret {
  start: number
  end: number
}

export function isLive(frame: Frame): boolean {
  return frame.content?.type === 'template'
}

/** What the Text field edits: the template while Live, else the static text. */
export function editableText(frame: Frame): string {
  const content = frame.content
  if (content === undefined) {
    return ''
  }
  return content.type === 'template' ? content.template : content.text
}

export function imageFrames(spread: Spread): Frame[] {
  return spread.frames.filter((frame) => frame.kind !== 'text')
}

/** The frame a chip reads: the anchor while Live, else the one Live would pick. */
export function chipAnchor(spread: Spread, text: Frame): Frame | undefined {
  const anchored = isLive(text)
    ? spread.frames.find((frame) => frame.id === text.anchorFrameId)
    : undefined
  return anchored ?? defaultAnchorFrame(spread, text)
}

/** What `{token}` prints for `anchor`'s photo ('' when the photo lacks it). */
function tokenValue(
  book: Book,
  spread: Spread,
  anchor: Frame,
  token: LiveToken,
): string {
  const probe: Frame = {
    id: '',
    kind: 'text',
    rect: anchor.rect,
    z: 0,
    content: { type: 'template', template: `{${token}}` },
    anchorFrameId: anchor.id,
  }
  return resolveTextContent(book, spread, probe).text
}

/** Chip tooltip (the value, or why there is none) and whether it is missing. */
export function chipState(
  book: Book,
  spread: Spread,
  anchor: Frame | undefined,
  token: LiveToken,
): { title: string; missing: boolean } {
  if (anchor?.assetId === undefined) {
    return { title: 'No photo in this frame', missing: true }
  }
  const value = tokenValue(book, spread, anchor, token)
  return value === ''
    ? { title: 'Not in this photo', missing: true }
    : { title: value, missing: false }
}

function fileName(asset: Asset | undefined): string | undefined {
  const name = asset?.relativePath?.split('/').pop()
  return name === '' ? undefined : name
}

/** `Anchored to` options: every image frame, `Frame N · <file>` or `· empty`. */
export function anchorOptions(
  book: Book,
  spread: Spread,
  displayName: (assetId: string) => string,
): { value: string; label: string }[] {
  return imageFrames(spread).map((frame, index) => {
    const assetId = frame.assetId
    const name =
      assetId === undefined
        ? 'empty'
        : (fileName(book.assets[assetId]) ?? displayName(assetId))
    return { value: frame.id, label: `Frame ${String(index + 1)} · ${name}` }
  })
}

/**
 * `{token}` into `text`: over the remembered selection (caret after it), else
 * appended with the kit separator.
 */
export function insertToken(
  text: string,
  token: LiveToken,
  caret: Caret | null,
): { text: string; caret: Caret | null } {
  const tag = `{${token}}`
  if (caret === null) {
    return { text: text === '' ? tag : `${text}${TOKEN_JOIN}${tag}`, caret }
  }
  const at = caret.start + tag.length
  return {
    text: text.slice(0, caret.start) + tag + text.slice(caret.end),
    caret: { start: at, end: at },
  }
}
