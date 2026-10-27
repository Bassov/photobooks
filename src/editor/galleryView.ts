export type GallerySortKey = 'added' | 'captured' | 'name'

let collator: Intl.Collator | undefined

function nameCollator(): Intl.Collator {
  collator ??= new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: 'base',
  })
  return collator
}

/** Per-asset sort inputs; keep lookups cheap (called once per id). */
export interface GalleryViewSource {
  name(assetId: string): string
  /** Milliseconds since epoch from `capturedAt`, else file mtime; null when unknown. */
  timeMs(assetId: string): number | null
  isPlaced(assetId: string): boolean
}

/** Parse an asset `capturedAt` (ISO or EXIF `YYYY:MM:DD HH:MM:SS`) to epoch ms. */
export function parseCapturedAtMs(value: string | undefined): number | null {
  if (value === undefined) {
    return null
  }
  const exif = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}:\d{2}:\d{2}.*)$/.exec(value)
  const ms = Date.parse(
    exif === null
      ? value
      : `${exif[1] ?? ''}-${exif[2] ?? ''}-${exif[3] ?? ''}T${exif[4] ?? ''}`,
  )
  return Number.isNaN(ms) ? null : ms
}

/**
 * Derive the filmstrip id list from book gallery order. Pure and stable:
 * ties and undated photos keep added order (undated last for `captured`).
 * Returns `gallery` itself when nothing is filtered or reordered.
 */
export function deriveGalleryView(
  gallery: readonly string[],
  options: { sort?: GallerySortKey | undefined; unplacedOnly: boolean },
  source: GalleryViewSource,
): readonly string[] {
  const ids = options.unplacedOnly
    ? gallery.filter((id) => !source.isPlaced(id))
    : gallery
  if (options.sort === 'name') {
    return ids
      .map((id, index) => ({ id, index, name: source.name(id) }))
      .sort(
        (a, b) => nameCollator().compare(a.name, b.name) || a.index - b.index,
      )
      .map((entry) => entry.id)
  }
  if (options.sort === 'captured') {
    return ids
      .map((id, index) => ({ id, index, time: source.timeMs(id) ?? Infinity }))
      .sort((a, b) => {
        if (a.time !== b.time) {
          return a.time < b.time ? -1 : 1
        }
        return a.index - b.index
      })
      .map((entry) => entry.id)
  }
  return ids
}

/**
 * Re-order per-gallery-index `values` to follow `viewIds`. Returns `values`
 * itself when the view is the gallery (no copy on the import hot path).
 */
export function projectOntoView<T>(
  gallery: readonly string[],
  viewIds: readonly string[],
  values: readonly T[],
  fallback: (assetId: string) => T,
): readonly T[] {
  if (viewIds === gallery) {
    return values
  }
  const index = new Map(gallery.map((id, i) => [id, i] as const))
  return viewIds.map((id) => values[index.get(id) ?? -1] ?? fallback(id))
}
