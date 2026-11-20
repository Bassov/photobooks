/**
 * Nightly full mutation run, split into shards that each fit one CI job.
 * `STRYKER_SHARD=<index>` narrows `stryker.config.mjs` `mutate` to one shard;
 * the base excludes (`!…`) always apply. The last shard is the catch-all: the
 * base includes minus every other shard, so a new `src/` dir is never dropped.
 * Sizes are balanced by source lines (~10–13k each; `src/editor/` is flat and
 * split by first letter, case-sensitive). `src/core/` is split in two: its
 * PBT-heavy tests make each mutant slow (one 7.6k-mutant core shard ran past
 * 2.5 h).
 */

/** @type {readonly { name: string, include: readonly string[] | null }[]} */
export const SHARDS = Object.freeze([
  {
    name: 'core',
    include: [
      'src/core/*.{ts,tsx}',
      'src/core/{ops,templates,selectors,text}/**/*.{ts,tsx}',
    ],
  },
  {
    name: 'core-pdf-print',
    include: ['src/core/{pdf,print,geometry,grid}/**/*.{ts,tsx}'],
  },
  {
    name: 'site-publish',
    include: ['src/site/**/*.{ts,tsx}', 'src/publish/**/*.{ts,tsx}'],
  },
  {
    name: 'photo-project-render-assets',
    include: [
      'src/photo/**/*.{ts,tsx}',
      'src/project/**/*.{ts,tsx}',
      'src/render/**/*.{ts,tsx}',
      'src/assets/**/*.{ts,tsx}',
    ],
  },
  { name: 'editor-A-G-a-f', include: ['src/editor/[A-Ga-f]*.{ts,tsx}'] },
  { name: 'editor-H-Z', include: ['src/editor/[H-Z]*.{ts,tsx}'] },
  { name: 'editor-g-p', include: ['src/editor/[g-p]*.{ts,tsx}'] },
  { name: 'editor-q-z', include: ['src/editor/[q-z]*.{ts,tsx}'] },
  { name: 'rest', include: null },
])

/**
 * @param {string | undefined} raw `STRYKER_SHARD`
 * @returns {number | null} shard index, or null when unset
 */
export function parseShardIndex(raw) {
  if (raw === undefined || raw === '') return null
  const index = Number(raw)
  if (!Number.isInteger(index) || index < 0 || index >= SHARDS.length) {
    throw new Error(
      `STRYKER_SHARD must be 0..${String(SHARDS.length - 1)}, got "${raw}"`,
    )
  }
  return index
}

/**
 * @param {readonly string[]} mutate base `mutate` (includes, then `!` excludes)
 * @param {number} index
 * @returns {string[]}
 */
export function shardMutate(mutate, index) {
  const bangs = mutate.filter((p) => p.startsWith('!'))
  const own = SHARDS[index].include
  if (own !== null) return [...own, ...bangs]
  const includes = mutate.filter((p) => !p.startsWith('!'))
  const others = SHARDS.flatMap((s) => s.include ?? []).map((p) => `!${p}`)
  return [...includes, ...others, ...bangs]
}

/**
 * Stryker's `mutate` semantics: patterns in order, `!` removes.
 * @param {readonly string[]} files
 * @param {readonly string[]} patterns
 * @param {(file: string, glob: string) => boolean} matches
 * @returns {string[]}
 */
export function selectFiles(files, patterns, matches) {
  return files.filter((file) => {
    let selected = false
    for (const pattern of patterns) {
      if (pattern.startsWith('!')) {
        if (selected && matches(file, pattern.slice(1))) selected = false
      } else if (!selected && matches(file, pattern)) {
        selected = true
      }
    }
    return selected
  })
}
