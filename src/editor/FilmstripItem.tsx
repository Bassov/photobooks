import { useSyncExternalStore } from 'react'
import { GridListItem } from 'react-aria-components'
import { getThumbUrl, subscribeThumb } from './thumbCache'

export const THUMB_HEIGHT = 96
export const THUMB_WIDTH = 144

export function FilmstripItemView({ id, name }: { id: string; name: string }) {
  const thumbUrl = useSyncExternalStore(
    (listener) => subscribeThumb(id, listener),
    () => getThumbUrl(id),
    () => getThumbUrl(id),
  )

  return (
    <GridListItem
      id={id}
      textValue={name}
      className="filmstrip-item"
      data-testid="filmstrip-item"
      data-asset-id={id}
      style={{
        width: THUMB_WIDTH,
        height: THUMB_HEIGHT,
      }}
    >
      {thumbUrl ? (
        <img
          className="filmstrip-thumb"
          data-testid="filmstrip-thumb"
          src={thumbUrl}
          alt=""
          decoding="async"
          width={THUMB_WIDTH}
          height={THUMB_HEIGHT}
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
