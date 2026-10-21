import { useSyncExternalStore } from 'react'

export type ProductTheme = 'b' | 'b-dark'

export const THEME_STORAGE_KEY = 'photobooks-theme'

let theme: ProductTheme = 'b'
const subscribers = new Set<() => void>()

function notify(): void {
  for (const listener of subscribers) {
    listener()
  }
}

/** Read a persisted product theme, or null when unset / unavailable. */
export function readStoredTheme(
  storage: Pick<Storage, 'getItem'> | null,
): ProductTheme | null {
  if (storage === null) {
    return null
  }
  const value = storage.getItem(THEME_STORAGE_KEY)
  if (value === 'b') {
    return 'b'
  }
  if (value === 'b-dark') {
    return 'b-dark'
  }
  return null
}

/** Resolve boot theme: stored choice wins over prefers-color-scheme. */
export function resolveBootTheme(
  matchesDark: boolean,
  stored: ProductTheme | null,
): ProductTheme {
  if (stored === 'b') {
    return 'b'
  }
  if (stored === 'b-dark') {
    return 'b-dark'
  }
  if (matchesDark) {
    return 'b-dark'
  }
  return 'b'
}

/** Boot: storage → prefers; one attribute write on the root. */
export function applyBootTheme(
  root: Pick<HTMLElement, 'dataset'>,
  matchesDark: boolean,
  storage: Pick<Storage, 'getItem'> | null,
): ProductTheme {
  const next = resolveBootTheme(matchesDark, readStoredTheme(storage))
  root.dataset.theme = next
  theme = next
  return next
}

export function readPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function getProductTheme(): ProductTheme {
  return theme
}

/** One root attribute write + persist; notifies toggle subscribers only. */
export function setTheme(
  next: ProductTheme,
  root: Pick<HTMLElement, 'dataset'>,
  storage: Pick<Storage, 'setItem'> | null,
): void {
  theme = next
  root.dataset.theme = next
  if (storage === null) {
    notify()
    return
  }
  storage.setItem(THEME_STORAGE_KEY, next)
  notify()
}

export function subscribeProductTheme(listener: () => void): () => void {
  subscribers.add(listener)
  return () => {
    subscribers.delete(listener)
  }
}

/** Subscribe only from the theme toggle — never from spread/pasteboard trees. */
export function useProductTheme(): ProductTheme {
  return useSyncExternalStore(
    subscribeProductTheme,
    getProductTheme,
    getProductTheme,
  )
}
