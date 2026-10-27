import type { Book } from '../core'
import type { RelinkStatus } from './relink/statusStore'

export type AssetsSort = 'status' | 'uses'

export interface AssetRow {
  assetId: string
  status: RelinkStatus
  uses: number
  /** 1-based spread numbers, ascending, unique. */
  spreads: readonly number[]
  /** Spread id of the first frame using the asset. */
  jumpSpreadId: string | null
}

export const ASSET_ROW_HEIGHT = 48
const ASSET_ROW_OVERSCAN = 6

const STATUS_ORDER: Record<RelinkStatus, number> = {
  missing: 0,
  modified: 1,
  ok: 2,
}

/** One row per gallery asset; statuses absent from the map are `ok`. */
export function buildAssetRows(
  book: Book,
  statuses: ReadonlyMap<string, RelinkStatus>,
): AssetRow[] {
  const uses = new Map<string, number>()
  const spreads = new Map<string, number[]>()
  const jump = new Map<string, string>()
  book.spreads.forEach((spread, index) => {
    for (const frame of spread.frames) {
      const id = frame.assetId
      if (id === undefined) {
        continue
      }
      uses.set(id, (uses.get(id) ?? 0) + 1)
      const list = spreads.get(id) ?? []
      if (list[list.length - 1] !== index + 1) {
        list.push(index + 1)
      }
      spreads.set(id, list)
      if (!jump.has(id)) {
        jump.set(id, spread.id)
      }
    }
  })
  return book.gallery.map((assetId) => ({
    assetId,
    status: statuses.get(assetId) ?? 'ok',
    uses: uses.get(assetId) ?? 0,
    spreads: spreads.get(assetId) ?? [],
    jumpSpreadId: jump.get(assetId) ?? null,
  }))
}

/** Stable sort: status = missing, modified, ok; uses = most used first. */
export function sortAssetRows(
  rows: readonly AssetRow[],
  sort: AssetsSort,
): AssetRow[] {
  const indexed = rows.map((row, index) => ({ row, index }))
  indexed.sort((a, b) => {
    const byKey =
      sort === 'status'
        ? STATUS_ORDER[a.row.status] - STATUS_ORDER[b.row.status] ||
          b.row.uses - a.row.uses
        : b.row.uses - a.row.uses
    return byKey || a.index - b.index
  })
  return indexed.map((item) => item.row)
}

export function usesLabel(row: AssetRow): string {
  if (row.uses === 0) {
    return 'unused'
  }
  return `${String(row.uses)}× · spread ${row.spreads.join(', ')}`
}

/** Half-open [start, end) row window for a fixed-height virtual list. */
export function rowWindow(
  scrollTop: number,
  viewportHeight: number,
  count: number,
  rowHeight = ASSET_ROW_HEIGHT,
  overscan = ASSET_ROW_OVERSCAN,
): { start: number; end: number } {
  const first = Math.floor(Math.max(0, scrollTop) / rowHeight)
  const last = Math.ceil((Math.max(0, scrollTop) + viewportHeight) / rowHeight)
  return {
    start: Math.min(count, Math.max(0, first - overscan)),
    end: Math.min(count, Math.max(0, last + overscan)),
  }
}
