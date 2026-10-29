import type { Book, Frame, Spread } from '../core'
import { fmtN, mmToCm, pageLabel } from './editorChromePanels'
import type { FrameSource } from './frameSelection'

export type InspectorView =
  | { kind: 'frame'; spread: Spread; spreadIndex: number; frame: Frame }
  | { kind: 'spread'; spread: Spread; spreadIndex: number }
  | { kind: 'empty' }

export interface InspectorRow {
  label: string
  value: string
}

/** What the panel paints: view kind and rows (no crop state). */
export interface InspectorPanel {
  kind: InspectorView['kind']
  /** Spread the Spread tab edits (the frame's spread for a frame), else null. */
  spreadId: string | null
  /** Photo rows of the selected frame; empty otherwise. */
  rows: readonly InspectorRow[]
  /** Summary rows of the spread in view; empty when there is none. */
  spreadRows: readonly InspectorRow[]
}

function sameRows(
  a: readonly InspectorRow[],
  b: readonly InspectorRow[],
): boolean {
  return (
    a.length === b.length &&
    a.every((row, i) => row.label === b[i]?.label && row.value === b[i].value)
  )
}

/** Value equality so book edits that leave the panel unchanged skip a render. */
export function sameInspectorPanel(
  a: InspectorPanel,
  b: InspectorPanel,
): boolean {
  return (
    a.kind === b.kind &&
    a.spreadId === b.spreadId &&
    sameRows(a.rows, b.rows) &&
    sameRows(a.spreadRows, b.spreadRows)
  )
}

/** Frame wins, then the active spread (unless Esc dismissed it), else empty. */
export function inspectorView(
  book: Book,
  frameSource: FrameSource | null,
  activeSpreadId: string | null,
  dismissedSpreadId: string | null,
): InspectorView {
  const picked = book.spreads.findIndex(
    (spread) => spread.id === frameSource?.spreadId,
  )
  const pickedSpread = book.spreads[picked]
  const frame = pickedSpread?.frames.find(
    (item) => item.id === frameSource?.frameId,
  )
  if (pickedSpread && frame) {
    return { kind: 'frame', spread: pickedSpread, spreadIndex: picked, frame }
  }
  const at = book.spreads.findIndex((spread) => spread.id === activeSpreadId)
  const spread = book.spreads[at]
  if (spread && activeSpreadId !== dismissedSpreadId) {
    return { kind: 'spread', spread, spreadIndex: at }
  }
  return { kind: 'empty' }
}

export function spreadTitle(index: number): string {
  return index === 0 ? 'Cover' : `Pages ${pageLabel(index)}`
}

export function spreadRows(spread: Spread): InspectorRow[] {
  return [
    {
      label: 'Template',
      value:
        spread.templateId === undefined
          ? 'Free layout'
          : spread.templateId.replace(/^t-/, '').replace(/-/g, ' '),
    },
    { label: 'Frames', value: String(spread.frames.length) },
    {
      label: 'Photos',
      value: String(
        spread.frames.filter((item) => item.assetId !== undefined).length,
      ),
    },
  ]
}

export function framePhotoRows(
  book: Book,
  frame: Frame,
  spreadIndex: number,
  uses: number,
): InspectorRow[] {
  const asset =
    frame.assetId === undefined ? undefined : book.assets[frame.assetId]
  const rows: InspectorRow[] = [
    { label: 'Spread', value: spreadTitle(spreadIndex) },
    {
      label: 'Size',
      value: `${fmtN(mmToCm(frame.rect.width))} × ${fmtN(mmToCm(frame.rect.height))} cm`,
    },
  ]
  if (asset?.widthPx !== undefined && asset.heightPx !== undefined) {
    rows.push({
      label: 'Pixels',
      value: `${String(asset.widthPx)} × ${String(asset.heightPx)}`,
    })
  }
  if (asset?.relativePath !== undefined) {
    rows.push({ label: 'File', value: asset.relativePath })
  }
  if (frame.assetId !== undefined) {
    rows.push({ label: 'Used', value: `${String(uses)}×` })
  }
  return rows
}
