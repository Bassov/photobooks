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
  }
  return {
    preview: (next) => {
      const value = clampThumbHeight(next)
      draft.current = value
      dockRef.current?.setAttribute('data-film-resizing', 'true')
      dockRef.current?.style.setProperty(
        '--film-preview-scale',
        String(value / getFilmstripThumbHeight()),
      )
    },
    commit: () => {
      const value = draft.current
      clear()
      if (value !== null) {
        setFilmstripThumbHeight(value)
      }
    },
    cancel: clear,
  }
}
