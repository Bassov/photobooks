// Reels sound layer (Designer promo-reels-v2 spec §3): check the licence page of every music track and foley file in
// sound.json, download them to the gitignored promo/out/reels/sound/, verify each file's sha256, slice every foley
// variant (each must reach its cue type's minimum length), then run the track gate of reels-mix.mjs for reels A/B/C
// and write `<reel>.beats.json`. Audio files are never committed.
//
//   node promo/reels/sound.mjs                 licence check + download + sha256 + slices + track gate (exit 1 on any failure)
//   node promo/reels/sound.mjs --check         licence pages only (no downloads)
//   node promo/reels/sound.mjs --no-gate       skip the track gate (the slice check still runs)
//   node promo/reels/sound.mjs --reel a        gate only reel a (a | b | c)
//   node promo/reels/sound.mjs --pin           write the sha256 of entries that have none yet (a set hash never changes)
//   node promo/reels/sound.mjs --pack-list <id>  list the files inside a downloaded pack (to pick sfx entries)
//   node promo/reels/sound.mjs --list <file>   use another list (same shape as sound.json)
//
// Output: promo/out/reels/sound/{music/<id>.mp3, sfx/<id>.<ext>, packs/<id>.zip, manifest.json, <reel>.beats.json}.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const HERE = path.dirname(new URL(import.meta.url).pathname)
export const SOUND_OUT = path.resolve(HERE, '../out/reels/sound')
export const SOUND_JSON = path.join(HERE, 'sound.json')
const UA = 'photobooks-promo/1.0'
/** Licences we accept (spec §3): CC0 or CC BY 4.0. */
export const LICENCES = new Set(['CC0-1.0', 'CC-BY-4.0'])

export const sha256 = (bytes) =>
  createHash('sha256').update(bytes).digest('hex')

export function loadSound(file = SOUND_JSON) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

/** Every downloadable entry: `{ id, kind: 'music' | 'sfx', ...entry }`. */
export function soundEntries(list) {
  return [
    ...list.music.map((e) => ({ kind: 'music', ...e })),
    ...list.sfx.map((e) => ({ kind: 'sfx', ...e })),
  ]
}

/** Local path of an entry (music, sfx or pack). */
export function entryPath(e, out = SOUND_OUT) {
  if (e.kind === 'pack') return path.join(out, 'packs', `${e.id}.zip`)
  const ext = path.extname(e.entry ?? new URL(e.url).pathname).toLowerCase()
  return path.join(out, e.kind, `${e.id}${ext}`)
}

/** Shape errors of a sound list (ids, licences, sources, candidates, cue variants); [] when it is fine. */
export function listErrors(list) {
  const errors = []
  const ids = new Set()
  const packs = new Map((list.packs ?? []).map((p) => [p.id, p]))
  for (const e of [...soundEntries(list), ...(list.packs ?? [])]) {
    if (ids.has(e.id)) errors.push(`${e.id}: duplicate id`)
    ids.add(e.id)
    const src = list.sources[e.source]
    if (!src) errors.push(`${e.id}: unknown source "${e.source}"`)
    if (!LICENCES.has(e.licence ?? src?.licence))
      errors.push(`${e.id}: licence "${e.licence}" is not CC0-1.0 / CC-BY-4.0`)
    if (!e.page) errors.push(`${e.id}: no licence page`)
    if (!e.checked) errors.push(`${e.id}: no checked date`)
    if (e.licence === 'CC-BY-4.0' && !e.credit)
      errors.push(`${e.id}: CC BY needs a credit line`)
    if (e.pack && !packs.has(e.pack))
      errors.push(`${e.id}: unknown pack "${e.pack}"`)
    if (!e.pack && e.id && !e.url && e.kind) errors.push(`${e.id}: no url`)
  }
  const music = new Set(list.music.map((m) => m.id))
  for (const [reel, ids2] of Object.entries(list.candidates)) {
    if (ids2.length < 3) errors.push(`candidates ${reel}: fewer than 3 tracks`)
    for (const id of ids2)
      if (!music.has(id))
        errors.push(`candidates ${reel}: "${id}" is not a music entry`)
  }
  const variants = {}
  for (const s of list.sfx) {
    if (!s.cues?.length) errors.push(`${s.id}: no cues`)
    for (const c of s.cues ?? []) variants[c] = (variants[c] ?? 0) + 1
  }
  for (const [cue, n] of Object.entries(variants))
    if (n < 3) errors.push(`cue "${cue}": ${n} variant(s), spec §3 needs ≥ 3`)
  return errors
}

// ---------------------------------------------------------------- licence pages

const sleep = (ms) => new Promise((res) => setTimeout(res, ms))

async function get(url, headers = {}) {
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA, ...headers } })
    if (r.ok) return r
    if (attempt >= 6 || (r.status !== 429 && r.status < 500))
      throw new Error(`GET ${url}: ${r.status}`)
    const after = Number(r.headers.get('retry-after'))
    await sleep(after > 0 ? after * 1000 : 3000 * 2 ** (attempt - 1))
  }
}

/**
 * Licence page check of one entry: the page must carry its source's licence marker and, when the source says so, name
 * the file (FMA track pages embed the storage file name, so the file is the one the page licenses).
 */
export function pageProblems(e, src, html) {
  const problems = []
  if (!html.includes(src.marker))
    problems.push(`page does not show "${src.marker}"`)
  if (src.pageNamesFile && e.url) {
    const name = path.basename(new URL(e.url).pathname)
    if (!html.includes(name)) problems.push(`page does not name ${name}`)
  }
  return problems
}

async function checkPages(list) {
  const seen = new Map()
  let ok = true
  for (const e of [...soundEntries(list), ...(list.packs ?? [])]) {
    if (e.pack) continue // covered by its pack's page
    const src = list.sources[e.source]
    let html = seen.get(e.page)
    if (html === undefined) {
      html = await (await get(e.page)).text()
      seen.set(e.page, html)
      await sleep(400)
    }
    const problems = pageProblems(e, src, html)
    if (problems.length) ok = false
    console.log(
      `${problems.length ? 'FAIL' : 'ok  '} ${e.id.padEnd(28)} ${e.licence ?? src.licence}  ${e.page}${problems.length ? `  (${problems.join('; ')})` : ''}`,
    )
  }
  return ok
}

// ---------------------------------------------------------------- downloads

/** Kenney serves packs through a signed link that needs the asset page's session cookie (no login). */
async function kenneyUrl(pack) {
  const page = await get(pack.page)
  const cookie = page.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  const r = await get(`https://kenney.nl/download-link/${pack.downloadId}`, {
    Cookie: cookie,
    Referer: pack.page,
  })
  const { url } = await r.json()
  if (!url) throw new Error(`${pack.id}: Kenney gave no download link`)
  return { url, headers: { Cookie: cookie, Referer: pack.page } }
}

async function fetchTo(file, url, headers) {
  try {
    if (fs.statSync(file).size > 0) return false
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const r = await get(url, headers)
  const tmp = `${file}.part`
  fs.writeFileSync(tmp, Buffer.from(await r.arrayBuffer()))
  fs.renameSync(tmp, file)
  await sleep(600)
  return true
}

/** Entries of a ZIP file: `{ name, read() }` (stored or deflated; no dependency). */
export function zipEntries(bytes) {
  let eocd = -1
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--) {
    if (bytes.readUInt32LE(p) === 0x06054b50) {
      eocd = p
      break
    }
  }
  if (eocd < 0) throw new Error('not a zip file')
  const count = bytes.readUInt16LE(eocd + 10)
  let p = bytes.readUInt32LE(eocd + 16)
  const out = []
  for (let i = 0; i < count; i++) {
    if (bytes.readUInt32LE(p) !== 0x02014b50)
      throw new Error('bad zip directory')
    const method = bytes.readUInt16LE(p + 10)
    const size = bytes.readUInt32LE(p + 20)
    const nameLen = bytes.readUInt16LE(p + 28)
    const extraLen = bytes.readUInt16LE(p + 30)
    const commentLen = bytes.readUInt16LE(p + 32)
    const local = bytes.readUInt32LE(p + 42)
    const name = bytes.toString('utf8', p + 46, p + 46 + nameLen)
    p += 46 + nameLen + extraLen + commentLen
    out.push({
      name,
      read() {
        const start =
          local +
          30 +
          bytes.readUInt16LE(local + 26) +
          bytes.readUInt16LE(local + 28)
        const data = bytes.subarray(start, start + size)
        if (method === 0) return Buffer.from(data)
        if (method === 8) return zlib.inflateRawSync(data)
        throw new Error(`${name}: zip method ${method}`)
      },
    })
  }
  return out
}

/** Hash check; with `pin`, a missing hash is filled in. Returns 'ok' | 'pinned' | 'mismatch' | 'missing'. */
function verify(e, file, pin) {
  const got = sha256(fs.readFileSync(file))
  if (e.sha256 === got) return 'ok'
  if (!e.sha256 && pin) {
    e.sha256 = got
    return 'pinned'
  }
  console.log(`  ${e.id}: sha256 ${got} ≠ ${e.sha256 || '(none)'}`)
  return e.sha256 ? 'mismatch' : 'missing'
}

async function downloadAll(list, { pin }) {
  let ok = true
  const report = (e, state, fresh) => {
    if (state !== 'ok' && state !== 'pinned') ok = false
    console.log(`${state.padEnd(8)} ${fresh ? 'new ' : '    '}${e.id}`)
  }
  for (const pack of list.packs ?? []) {
    const p = { kind: 'pack', ...pack }
    const file = entryPath(p)
    let fresh = false
    if (!fs.existsSync(file)) {
      const { url, headers } = await kenneyUrl(pack)
      fresh = await fetchTo(file, url, headers)
    }
    report(pack, verify(pack, file, pin), fresh)
  }
  for (const e of soundEntries(list)) {
    const file = entryPath(e)
    let fresh = false
    if (e.pack) {
      if (!fs.existsSync(file)) {
        const pack = list.packs.find((q) => q.id === e.pack)
        const zip = fs.readFileSync(entryPath({ kind: 'pack', ...pack }))
        const hit = zipEntries(zip).find((z) => z.name === e.entry)
        if (!hit) throw new Error(`${e.id}: ${e.entry} is not in ${e.pack}`)
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, hit.read())
        fresh = true
      }
    } else {
      fresh = await fetchTo(file, e.url)
    }
    const state = verify(e, file, pin)
    // soundEntries() hands out copies: pin the hash on the list entry itself
    if (state === 'pinned')
      [...list.music, ...list.sfx].find((o) => o.id === e.id).sha256 = e.sha256
    report(e, state, fresh)
  }
  return ok
}

/** manifest.json: id → `{ kind, path, sha256, cues, licence, credit, title, author }` (what reels-mix.mjs reads). */
export function writeManifest(list, out = SOUND_OUT) {
  const files = {}
  for (const e of soundEntries(list)) {
    const src = list.sources[e.source]
    files[e.id] = {
      kind: e.kind,
      path: path.relative(out, entryPath(e, out)),
      sha256: e.sha256,
      cues: e.cues ?? [],
      licence: e.licence ?? src.licence,
      credit: e.credit ?? null,
      title: e.title,
      author: e.author ?? src.author ?? null,
      page: e.page,
    }
  }
  const manifest = { checked: list.checked, candidates: list.candidates, files }
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(
    path.join(out, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  return manifest
}

// ---------------------------------------------------------------- main

async function main() {
  const args = process.argv.slice(2)
  const flag = (name) => args.includes(name)
  const opt = (name) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : undefined
  }
  const listFile = path.resolve(opt('--list') ?? SOUND_JSON)
  const list = loadSound(listFile)

  if (opt('--pack-list')) {
    const pack = list.packs.find((p) => p.id === opt('--pack-list'))
    const zip = fs.readFileSync(entryPath({ kind: 'pack', ...pack }))
    for (const z of zipEntries(zip)) console.log(z.name)
    return 0
  }

  const errors = listErrors(list)
  for (const e of errors) console.log(`list: ${e}`)
  if (errors.length) return 1

  console.log('— licence pages')
  if (!(await checkPages(list))) return 1
  if (flag('--check')) return 0

  console.log('— downloads + sha256')
  const ok = await downloadAll(list, { pin: flag('--pin') })
  if (flag('--pin'))
    fs.writeFileSync(listFile, `${JSON.stringify(list, null, 2)}\n`)
  if (!ok) return 1
  const manifest = writeManifest(list)
  console.log(`manifest: ${path.join(SOUND_OUT, 'manifest.json')}`)

  console.log('— foley slices (minimum length per cue type)')
  const { sliceCheck, trackGate } =
    await import('../motion/scripts/reels-mix.mjs')
  const slices = await sliceCheck(manifest, SOUND_OUT)
  for (const line of slices.lines) console.log(line)
  if (!slices.ok) return 1
  if (flag('--no-gate')) return 0

  console.log('— track gate')
  const reels = opt('--reel') ? [opt('--reel')] : Object.keys(list.candidates)
  let gateOk = true
  for (const reel of reels) {
    const res = await trackGate(reel, manifest, SOUND_OUT)
    for (const line of res.lines) console.log(line)
    if (!res.ok) gateOk = false
  }
  return gateOk ? 0 : 1
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err)
      process.exit(1)
    },
  )
}
