/** Shared title prompt for create/rename. Cancel → null. */
export function promptBookTitle(
  message: string,
  initial: string,
): string | null {
  const entered = window.prompt(message, initial)
  if (entered === null) {
    return null
  }
  return entered
}
