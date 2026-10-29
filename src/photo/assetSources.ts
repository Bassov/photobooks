interface StoredSource {
  file: File
  cover: boolean
}

const sources = new Map<string, StoredSource>()

export function retainAssetSource(
  assetId: string,
  file: File,
  options: { cover?: boolean } = {},
): void {
  sources.set(assetId, { file, cover: options.cover === true })
}

export function getAssetSource(assetId: string): File | undefined {
  return sources.get(assetId)?.file
}

export function assetSourceCovers(assetId: string): boolean {
  return sources.get(assetId)?.cover === true
}

export function releaseAssetSource(assetId: string): void {
  sources.delete(assetId)
}

export function resetAssetSources(): void {
  sources.clear()
}
