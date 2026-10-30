import { useEffect, useState } from 'react'
import { getDerivedCache } from '../assets/derivedCache/instance'
import { THUMB_PRESET_ID } from '../assets/derivedCache/presets'

/** Object URL of a DerivedCache thumb by key; undefined while loading or absent. */
export function useCachedThumbUrl(
  cacheKey: string | undefined,
): string | undefined {
  const [loaded, setLoaded] = useState<{ key: string; url: string }>()
  useEffect(() => {
    if (cacheKey === undefined) {
      return
    }
    let url: string | undefined
    let cancelled = false
    void getDerivedCache()
      .then((cache) => cache.get(cacheKey, THUMB_PRESET_ID))
      .then((got) => {
        if (cancelled || !got.ok) {
          return
        }
        url = URL.createObjectURL(
          new Blob([got.value.bytes], { type: got.value.mimeType }),
        )
        setLoaded({ key: cacheKey, url })
      })
    return () => {
      cancelled = true
      if (url !== undefined) {
        URL.revokeObjectURL(url)
      }
    }
  }, [cacheKey])
  return loaded !== undefined && loaded.key === cacheKey
    ? loaded.url
    : undefined
}
