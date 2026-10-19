import { getDerivedCache } from '../assets/derivedCache/instance'
import { resetThumbCache } from './thumbCache'

/** E2E/unit: drop hot thumbs and wipe DerivedCache (OPFS or memory). */
export async function clearThumbsAndDerivedCacheForTests(): Promise<void> {
  resetThumbCache()
  const cache = await getDerivedCache()
  await cache.clear()
}
