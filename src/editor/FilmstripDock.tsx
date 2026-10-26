import { useSyncExternalStore } from 'react'
import { getGalleryIdsSnapshot, subscribeGallery } from './bookStore'
import { Filmstrip } from './Filmstrip'

/** Kit bottom dock chrome wrapping the working product Filmstrip. */
export function FilmstripDock() {
  const gallery = useSyncExternalStore(
    subscribeGallery,
    getGalleryIdsSnapshot,
    getGalleryIdsSnapshot,
  )
  const count = gallery.length

  return (
    <div className="editor-dock shrink-0" data-testid="dock">
      <div className="editor-dock-head flex h-10 items-center gap-3 px-3">
        <span
          className="editor-dock-meta text-sm tabular-nums"
          data-testid="film-head"
        >
          <span data-testid="placed-count">Photos · {count}</span>
        </span>
      </div>
      <div className="mt-0 px-2 pb-1" data-testid="film-panel">
        <Filmstrip />
      </div>
    </div>
  )
}
