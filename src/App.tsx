import { useId, useRef, useState } from 'react'
import './App.css'
import { loadPhoto, revokePhotoPreview } from './photo/loadPhoto'
import { photoInputAccept, pickPhotoWithFilePicker } from './photo/pickPhoto'
import { UnsupportedPhotoFormatError, type PhotoCardModel } from './photo/types'

function App() {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<PhotoCardModel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function applyFile(file: File | null | undefined): Promise<void> {
    if (!file) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      const model = await loadPhoto(file)
      setPhoto((previous) => {
        if (previous) {
          revokePhotoPreview(previous)
        }
        return model
      })
    } catch (err) {
      setPhoto((previous) => {
        if (previous) {
          revokePhotoPreview(previous)
        }
        return null
      })
      if (err instanceof UnsupportedPhotoFormatError) {
        setError(`Unsupported format: ${err.mimeType || 'unknown'}`)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to load photo')
      }
    } finally {
      setBusy(false)
    }
  }

  async function onOpenPhoto(): Promise<void> {
    const picked = await pickPhotoWithFilePicker()
    if (picked) {
      await applyFile(picked)
      return
    }
    inputRef.current?.click()
  }

  return (
    <main className="shell">
      <p className="brand">Photobooks</p>
      <h1 className="headline">Local-first photobook editor</h1>
      <p className="lede">
        Open a photo from disk to preview orientation, size, and aspect ratio.
      </p>

      <div className="actions">
        <button
          type="button"
          className="open-photo"
          onClick={() => {
            void onOpenPhoto()
          }}
          disabled={busy}
        >
          {busy ? 'Loading…' : 'Open photo'}
        </button>
        <input
          id={inputId}
          ref={inputRef}
          className="photo-file-input"
          data-testid="photo-file-input"
          type="file"
          accept={photoInputAccept()}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            void applyFile(file)
          }}
        />
      </div>

      {error ? (
        <p className="photo-error" role="alert" data-testid="photo-error">
          {error}
        </p>
      ) : null}

      {photo ? (
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
      ) : null}
    </main>
  )
}

export default App
