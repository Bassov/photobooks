import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from 'react'
import { loadPhoto, revokePhotoPreview } from './loadPhoto'
import { photoInputAccept, pickPhotoWithFilePicker } from './pickPhoto'
import { UnsupportedPhotoFormatError, type PhotoCardModel } from './types'

export function useOpenPhoto(): {
  inputId: string
  inputRef: RefObject<HTMLInputElement | null>
  photo: PhotoCardModel | null
  error: string | null
  busy: boolean
  accept: string
  onOpenPhoto: () => Promise<void>
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void
} {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<PhotoCardModel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    return () => {
      if (photo) {
        revokePhotoPreview(photo)
      }
    }
  }, [photo])

  async function applyFile(file: File | null | undefined): Promise<void> {
    if (!file) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      const model = await loadPhoto(file)
      setPhoto(model)
    } catch (err) {
      setPhoto(null)
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

  return {
    inputId,
    inputRef,
    photo,
    error,
    busy,
    accept: photoInputAccept(),
    onOpenPhoto,
    onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      void applyFile(file)
    },
  }
}
