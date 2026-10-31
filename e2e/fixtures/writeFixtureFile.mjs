import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'

/**
 * Every spec regenerates the photo fixtures at load, in parallel workers.
 * Chromium drops a picked `File` whose disk file changed after the pick
 * (NotReadableError, "Imported with 1 error(s)"), so an unchanged fixture is
 * left untouched. A changed one goes through a private temp file and a rename:
 * readers see the old or the new file, never a partial one.
 */
export function writeFixtureFile(path, data) {
  if (existsSync(path) && readFileSync(path).equals(data)) {
    return
  }
  const tmp = `${path}.${String(process.pid)}.tmp`
  writeFileSync(tmp, data)
  renameSync(tmp, path)
}
