import { createMemoryDerivedCache } from './memory'
import { createOpfsDerivedCache } from './opfs'
import type { DerivedCache } from './types'

let override: DerivedCache | undefined
let cached: DerivedCache | undefined
let cachedPromise: Promise<DerivedCache> | undefined

export function setDerivedCacheForTests(cache: DerivedCache | undefined): void {
  override = cache
  cached = undefined
  cachedPromise = undefined
}

export async function getDerivedCache(): Promise<DerivedCache> {
  if (override !== undefined) {
    return override
  }
  if (cached !== undefined) {
    return cached
  }
  cachedPromise ??= createOpfsDerivedCache()
    .then((cache) => {
      cached = cache
      return cache
    })
    .catch(() => {
      const memory = createMemoryDerivedCache()
      cached = memory
      return memory
    })
  return cachedPromise
}
