import { enqueueHash } from '../photo/assetPool'
import { whenMetadataIdle } from '../photo/poolCoordination'

export async function hashContent(buffer: ArrayBuffer): Promise<string> {
  // Metadata jobs run at background priority above hash.
  await whenMetadataIdle()
  return enqueueHash(buffer)
}
