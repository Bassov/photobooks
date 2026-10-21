/** Home chrome / EmptyState actions are disabled while the session is busy. */
export function homeActionDisabled(interactive: boolean): boolean {
  return !interactive
}
