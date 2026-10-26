// Stryker disable all: kit dock chrome wrapper; Filmstrip behavior covered by filmstrip suite
import { useSyncExternalStore } from 'react'
import { getGalleryIdsSnapshot, subscribeGallery } from './bookStore'
import { BAR, SUB } from './editorChromeTokens'
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
    <div className="shrink-0" style={{ background: BAR }} data-testid="dock">
      <div className="flex h-10 items-center gap-3 px-3">
        <span
          className="text-sm tabular-nums"
          style={{ color: SUB }}
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
