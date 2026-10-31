import { existsSync, readFileSync, writeFileSync } from 'node:fs'

/**
 * Parallel workers re-run the fixture writers; rewriting an identical file
 * bumps its mtime and Chrome then fails reads of a File picked before the bump
 * (NotReadableError "could not be read"). Write only when the bytes differ.
 */
export function writeIfChanged(path, bytes) {
  if (existsSync(path) && readFileSync(path).equals(bytes)) return
  writeFileSync(path, bytes)
}
