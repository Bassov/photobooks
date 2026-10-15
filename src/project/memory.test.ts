import { createMemoryLibraryStorage } from './memory'
import { runLibraryStorageContract } from './libraryStorage.contract.test-helpers'

runLibraryStorageContract(() => {
  const storage = createMemoryLibraryStorage()
  return {
    storage,
    setPermissionRequired: storage.setPermissionRequired,
    setLockedElsewhere: storage.setLockedElsewhere,
    seedRawBook: storage.seedRawBook,
  }
})
