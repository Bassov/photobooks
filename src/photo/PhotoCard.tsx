import type { PhotoCardModel } from './types'

export function PhotoCard({ photo }: { photo: PhotoCardModel }) {
  return (
    <article
      className="photo-card"
      data-testid="photo-card"
      data-orientation={String(photo.orientation)}
    >
      <img
        className="photo-card__preview"
        src={photo.previewUrl}
        alt={photo.name}
        data-testid="photo-preview"
      />
      <dl className="photo-card__meta">
        <div>
          <dt>Dimensions</dt>
          <dd data-testid="photo-dimensions">
            {photo.correctedWidth}×{photo.correctedHeight}
          </dd>
        </div>
        <div>
          <dt>Aspect</dt>
          <dd data-testid="photo-aspect">{photo.aspectLabel}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd data-testid="photo-size">{photo.sizeLabel}</dd>
        </div>
      </dl>
    </article>
  )
}
