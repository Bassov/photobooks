import { useRef, type RefObject } from 'react'
import {
  clampThumbHeight,
  getFilmstripThumbHeight,
  setFilmstripThumbHeight,
} from './filmstripSize'

export interface FilmstripResize {
  /** Draft height while dragging: only CSS vars change (no React / virtualizer). */
  preview: (next: number) => void
  /** Commit the draft once; the virtualizer re-lays out here. */
  commit: () => void
  cancel: () => void
}

const PREVIEW_ATTR = 'data-film-resizing'

/** Drop the preview scale on the dock that contains `node` (if resizing). */
export function endFilmstripResizePreview(node: HTMLElement | null): void {
  const dock = node?.closest<HTMLElement>(`[${PREVIEW_ATTR}]`)
  dock?.removeAttribute(PREVIEW_ATTR)
  dock?.style.removeProperty('--film-preview-scale')
  dock?.style.removeProperty('--film-preview-origin')
}

/**
 * Drives `--film-preview-scale` on the dock during a resize gesture and commits
 * the final height to the size store on release.
 */
export function useFilmstripResize(
  dockRef: RefObject<HTMLElement | null>,
): FilmstripResize {
  const draft = useRef<number | null>(null)
  const clear = (): void => {
    draft.current = null
    dockRef.current?.removeAttribute('data-film-resizing')
    dockRef.current?.style.removeProperty('--film-preview-scale')
    dockRef.current?.style.removeProperty('--film-preview-origin')
  }
  return {
    preview: (next) => {
      const value = clampThumbHeight(next)
      draft.current = value
      const dock = dockRef.current
      dock?.setAttribute('data-film-resizing', 'true')
      dock?.style.setProperty(
        '--film-preview-scale',
        String(value / getFilmstripThumbHeight()),
      )
      // Scale around the left edge of the scrollport: the commit keeps the
      // first visible photo there (Filmstrip.tsx anchors the scroll).
      const scroller = dock?.querySelector('.filmstrip-scroll')
      dock?.style.setProperty(
        '--film-preview-origin',
        `${String(scroller?.scrollLeft ?? 0)}px`,
      )
    },
    commit: () => {
      const value = draft.current
      draft.current = null
      if (value === null || value === getFilmstripThumbHeight()) {
        clear()
        return
      }
      // The strip clears the preview once it has re-laid out (Filmstrip.tsx).
      setFilmstripThumbHeight(value)
    },
    cancel: clear,
  }
}
