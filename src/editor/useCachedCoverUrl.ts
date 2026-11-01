import { useEffect, useState } from 'react'
import { getDerivedCache } from '../assets/derivedCache/instance'
import { THUMB_PRESET_ID, tierPresetId } from '../assets/derivedCache/presets'
import { WORKING_PREVIEW_EDGE } from '../photo/imageTiers'

/** Library cover sources, sharpest first: working preview, then filmstrip thumb. */
const COVER_PRESET_IDS = [
  tierPresetId(WORKING_PREVIEW_EDGE),
  THUMB_PRESET_ID,
] as const

async function readSharpestCover(
  cacheKey: string,
): Promise<{ bytes: ArrayBuffer; mimeType: string } | undefined> {
  const cache = await getDerivedCache()
  for (const presetId of COVER_PRESET_IDS) {
    const got = await cache.get(cacheKey, presetId)
    if (got.ok) {
      return got.value
    }
  }
  return undefined
}

/**
 * Object URL of a cached cover photo by DerivedCache key (the working preview
 * when the editor has encoded one, else the thumb); undefined while loading or
 * absent.
 */
export function useCachedCoverUrl(
  cacheKey: string | undefined,
): string | undefined {
  const [loaded, setLoaded] = useState<{ key: string; url: string }>()
  useEffect(() => {
    if (cacheKey === undefined) {
      return
    }
    let url: string | undefined
    let cancelled = false
    void readSharpestCover(cacheKey).then((entry) => {
      if (cancelled || entry === undefined) {
        return
      }
      url = URL.createObjectURL(
        new Blob([entry.bytes], { type: entry.mimeType }),
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
