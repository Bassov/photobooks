import { runDerivedCacheContract } from '../derivedCache.contract.test-helpers'
import { createOpfsDerivedCache } from './opfs'
import { createFakeOpfsDirectory } from './opfsDirectory.test-helpers'

runDerivedCacheContract(async () => {
  const root = createFakeOpfsDirectory()
  const cache = await createOpfsDerivedCache({ root })
  return {
    cache,
    seedCorrupted: async (assetHash, presetId) => {
      await cache.seedCorrupted(assetHash, presetId)
    },
    recreate: async () => createOpfsDerivedCache({ root }),
  }
})
