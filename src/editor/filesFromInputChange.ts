/** Copy a live FileList before the input value is cleared; null when empty. */
export function filesFromInputChange(input: HTMLInputElement): File[] | null {
  const list = input.files
  if (!list || list.length === 0) {
    return null
  }
  const files = [...list]
  input.value = ''
  return files
}
