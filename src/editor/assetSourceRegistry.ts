import type { AssetSource } from '../assets'

const assetSources = new Map<string, AssetSource>()

/** Register an in-session AssetSource root (memory or FSA). */
export function registerAssetSource(rootId: string, source: AssetSource): void {
  assetSources.set(rootId, source)
}

export function getRegisteredAssetSource(
  rootId: string,
): AssetSource | undefined {
  return assetSources.get(rootId)
}

export function clearRegisteredAssetSources(): void {
  assetSources.clear()
}
