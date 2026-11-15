#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook (Edit|MultiEdit|Write): `prettier --write` then
 * `eslint --fix` on the ONE edited file, so format / fixable lint failures do
 * not reach the commit hook or check:fast. Reads the hook JSON from stdin.
 *
 * Never fails the tool call: always exits 0, swallows errors, hard 9 s cap.
 * Silent on success; one `additionalContext` line when eslint errors remain.
 * ESLint runs without type information (typed parse costs ~3 s per file);
 * typed rules still run in the commit hook and check:fast.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const HARD_TIMEOUT_MS = 9000
export const PRETTIER_EXT = /\.(?:[cm]?[jt]sx?|css|md|json)$/
export const ESLINT_EXT = /\.(?:[cm]?[jt]sx?)$/

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * @param {string} root
 * @param {string | undefined} file
 * @returns {string | null} repo-relative POSIX path, or null when out of scope
 */
export function inRepoPath(root, file) {
  if (typeof file !== 'string' || file === '') return null
  const rel = path.relative(root, path.resolve(root, file))
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null
  const posix = rel.split(path.sep).join('/')
  if (/(?:^|\/)(?:node_modules|\.git)\//.test(posix)) return null
  return PRETTIER_EXT.test(posix) ? posix : null
}

/**
 * @param {string} root
 * @param {string} rel
 * @returns {Promise<boolean>} whether prettier rewrote the file
 */
async function runPrettier(root, rel) {
  const prettier = await import('prettier')
  const abs = path.join(root, rel)
  const info = await prettier.getFileInfo(abs, {
    ignorePath: [
      path.join(root, '.gitignore'),
      path.join(root, '.prettierignore'),
    ],
  })
  if (info.ignored || !info.inferredParser) return false
  const source = fs.readFileSync(abs, 'utf8')
  const options = (await prettier.resolveConfig(abs)) ?? {}
  const formatted = await prettier.format(source, { ...options, filepath: abs })
  if (formatted === source) return false
  fs.writeFileSync(abs, formatted)
  return true
}

/**
 * @param {string} root
 * @param {string} rel
 * @returns {Promise<string | null>} one-line summary of unfixed errors, or null
 */
async function runEslint(root, rel) {
  const { ESLint } = await import('eslint')
  const tseslint = (await import('typescript-eslint')).default
  const eslint = new ESLint({
    cwd: root,
    fix: true,
    cache: true,
    cacheLocation: path.join(root, '.cache', 'eslint-hook') + path.sep,
    cacheStrategy: 'content',
    overrideConfig: [
      {
        ...tseslint.configs.disableTypeChecked,
        files: ['**/*.{ts,tsx,mts,cts}'],
      },
    ],
  })
  if (await eslint.isPathIgnored(rel)) return null
  const results = await eslint.lintFiles([rel])
  await ESLint.outputFixes(results)
  const errors = results.flatMap((r) =>
    r.messages.filter((m) => m.severity === 2),
  )
  if (errors.length === 0) return null
  const [first] = errors
  return `lint-autofix: ${rel}: ${errors.length} eslint error(s) left after --fix (first ${first.line}:${first.column} ${first.ruleId ?? 'parse'})`
}

/**
 * @param {string} stdin hook JSON
 * @param {string} [root]
 * @returns {Promise<string | null>} additionalContext line, or null (silent)
 */
export async function lintAutofix(stdin, root = ROOT) {
  /** @type {{ tool_input?: { file_path?: string } }} */
  let input
  try {
    input = JSON.parse(stdin)
  } catch {
    return null
  }
  const rel = inRepoPath(root, input.tool_input?.file_path)
  if (!rel || !fs.existsSync(path.join(root, rel))) return null
  await runPrettier(root, rel)
  return ESLINT_EXT.test(rel) ? runEslint(root, rel) : null
}

/**
 * @param {string} line
 * @returns {string} PostToolUse hook output that reaches the model
 */
export function hookOutput(line) {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: line,
    },
  })
}

async function readStdin() {
  let s = ''
  for await (const chunk of process.stdin) s += chunk
  return s
}

/**
 * @param {string} [root]
 * @param {() => Promise<string>} [read]
 * @returns {Promise<0>}
 */
export async function main(root = ROOT, read = readStdin) {
  try {
    const line = await lintAutofix(await read(), root)
    if (line) process.stdout.write(`${hookOutput(line)}\n`)
  } catch {
    // Never fail the edit: commit hook and check:fast still gate.
  }
  return 0
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  setTimeout(() => process.exit(0), HARD_TIMEOUT_MS).unref()
  process.exitCode = await main()
}
