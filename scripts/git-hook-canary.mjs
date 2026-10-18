import { diffGitSnapshots, snapshotGitState } from './git-test-helper.mjs'

export { diffGitSnapshots, snapshotGitState }

/**
 * Snapshot the repo at `cwd`, run `run()`, snapshot again, fail if state drifted.
 * @param {string} cwd
 * @param {() => number | void | Promise<number | void>} run
 * @returns {Promise<number>}
 */
export async function withGitCanary(cwd, run) {
  const before = snapshotGitState(cwd)
  const code = await run()
  const status = typeof code === 'number' ? code : 0
  const after = snapshotGitState(cwd)
  const diff = diffGitSnapshots(before, after)
  if (diff) {
    console.error(
      'GIT ISOLATION CANARY: repository state changed while the hook command ran.\n' +
        diff,
    )
    return 1
  }
  return status
}
