/** Skip rename persistence when the normalized title is unchanged. */
export function shouldSkipLibraryRename(
  currentTitle: string | undefined,
  nextNormalized: string,
): boolean {
  return currentTitle === nextNormalized
}
