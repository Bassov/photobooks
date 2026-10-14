import { useSyncExternalStore } from 'react'
import { GridListItem } from 'react-aria-components'
import { getAssetAspectSnapshot, subscribeBookStore } from './bookStore'
import { getThumbUrl, subscribeThumb } from './thumbCache'
import { thumbSlotSize } from './thumbSlotSize'

function orientationLabel(aspect: number): 'portrait' | 'landscape' | 'square' {
  if (aspect < 0.95) {
    return 'portrait'
  }
  if (aspect > 1.05) {
    return 'landscape'
  }
  return 'square'
}

export function FilmstripItemView({ id, name }: { id: string; name: string }) {
  const thumbUrl = useSyncExternalStore(
    (listener) => subscribeThumb(id, listener),
    () => getThumbUrl(id),
    () => getThumbUrl(id),
  )
  const aspect = useSyncExternalStore(
    subscribeBookStore,
    () => getAssetAspectSnapshot(id),
    () => getAssetAspectSnapshot(id),
  )
  const { width, height } = thumbSlotSize(aspect)

  return (
    <GridListItem
      id={id}
      textValue={name}
      className="filmstrip-item"
      data-testid="filmstrip-item"
      data-asset-id={id}
      data-aspect={String(aspect)}
      data-orientation={orientationLabel(aspect)}
      style={{
        width,
        height,
      }}
    >
      {thumbUrl ? (
        <img
          className="filmstrip-thumb"
          data-testid="filmstrip-thumb"
          src={thumbUrl}
          alt=""
          decoding="async"
          width={width}
          height={height}
        />
      ) : (
        <div
          className="filmstrip-placeholder"
          data-testid="filmstrip-placeholder"
        />
      )}
    </GridListItem>
  )
}
