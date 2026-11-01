import { useSyncExternalStore } from 'react'
import { getThumbUrl, subscribeThumb } from './thumbCache'

const noUnsubscribe = (): void => undefined
const subscribeNothing = (): (() => void) => noUnsubscribe

/**
 * Filmstrip thumb URL of a photo; undefined until it is published. Inspector
 * thumbnails only: canvas surfaces go through `useTierPreviewUrl`.
 */
export function useThumbUrl(assetId: string | undefined): string | undefined {
  return useSyncExternalStore(
    assetId === undefined
      ? subscribeNothing
      : (listener) => subscribeThumb(assetId, listener),
    () => (assetId === undefined ? undefined : getThumbUrl(assetId)),
    () => undefined,
  )
}
