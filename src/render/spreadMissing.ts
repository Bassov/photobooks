/**
 * Pure helpers for missing-asset hatch painting in SpreadView.
 */

export function frameShowsMissing(
  assetId: string | undefined,
  isMissingAsset: ((id: string) => boolean) | undefined,
): boolean {
  return assetId !== undefined && isMissingAsset?.(assetId) === true
}

export function previewUrlUnlessMissing(
  missing: boolean,
  assetId: string | undefined,
  previewUrlFor: (id: string) => string | undefined,
): string | undefined {
  if (missing || assetId === undefined) {
    return undefined
  }
  return previewUrlFor(assetId)
}

export function tierUnlessMissing(
  missing: boolean,
  assetId: string | undefined,
  tierFor: ((id: string) => number | undefined) | undefined,
): number | undefined {
  if (missing || assetId === undefined) {
    return undefined
  }
  return tierFor?.(assetId)
}

export function missingPlaceholderClass(missing: boolean): string {
  return missing
    ? 'spread-frame-placeholder spread-frame-missing'
    : 'spread-frame-placeholder'
}

export function missingPlaceholderTestId(missing: boolean): string {
  return missing ? 'spread-frame-missing' : 'spread-frame-placeholder'
}
