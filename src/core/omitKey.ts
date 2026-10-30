/** Copy of `obj` without `key` (keeps optional props truly absent). */
export function omitKey<T extends object, K extends keyof T>(
  obj: T,
  key: K,
): Omit<T, K> {
  const entries = Object.entries(obj).filter(([name]) => name !== key)
  return Object.fromEntries(entries) as Omit<T, K>
}
