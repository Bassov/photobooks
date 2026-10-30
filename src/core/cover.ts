import type { Cover, Endpapers } from './schema'

/** A new book's cover text is its title (front and spine); the back starts blank. */
export function defaultCover(title: string): Cover {
  return {
    front: { text: title },
    spine: { text: title },
    back: { text: '' },
  }
}

export function defaultEndpapers(): Endpapers {
  return { front: {}, back: {} }
}
