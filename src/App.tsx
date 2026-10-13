import './App.css'
import { PhotoCard } from './photo/PhotoCard'
import { useOpenPhoto } from './photo/useOpenPhoto'

function App() {
  const {
    inputId,
    inputRef,
    photo,
    error,
    busy,
    accept,
    onOpenPhoto,
    onFileInputChange,
  } = useOpenPhoto()

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
          accept={accept}
          onChange={onFileInputChange}
        />
      </div>

      {error ? (
        <p className="photo-error" role="alert" data-testid="photo-error">
          {error}
        </p>
      ) : null}

      {photo ? <PhotoCard photo={photo} /> : null}
    </main>
  )
}

export default App
