import { P } from "@/data"
import type { Frame } from "./model"
/* Fictional capture metadata for the CC0 sample photos (for captions, sorting, assets panel). */
const cams = ["Fujifilm X-T4", "iPhone 15 Pro", "Sony A7 IV", "Fujifilm X100V", "Pixel 8"]
export function metaOf(id: string) {
  const n = Number(id.slice(1))
  const day = 3 + ((n * 7) % 26), hour = 8 + ((n * 5) % 12), min = (n * 13) % 60
  const date = new Date(Date.UTC(2025, 6, day, hour, min))
  return {
    date, dateLabel: `${day} Jul 2025`, time: `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
    title: P(id).credit.title, camera: cams[n % cams.length], caption: n % 3 === 0 ? "" : `${P(id).credit.title}, evening light`,
    added: n,
  }
}
/* Designer live-captions: photo tokens of a live caption (same rules as core resolveText) */
export const TOKENS = ["date", "title", "caption", "camera"] as const
export type Token = (typeof TOKENS)[number]
const TOKEN_RE = /\{(date|title|caption|camera)\}/g
export function tokenValue(name: Token, photo: string) {
  const m = metaOf(photo)
  return name === "date" ? m.dateLabel : m[name]
}
/** No photo in the anchor → every token prints `—`; else empty values drop their ` · ` part. */
export function fillTokens(tpl: string, photo: string | null) {
  if (!photo) return tpl.replace(TOKEN_RE, "—")
  const out = tpl.replace(TOKEN_RE, (_, name: Token) => tokenValue(name, photo))
  return out.split(" · ").filter((p) => p.trim()).join(" · ")
}

const gap = (a: Frame, b: Frame) => Math.hypot(Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w)), Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h)))
/** Default anchor: the nearest image frame with a photo (rect-to-rect mm, ties → lower index), else the nearest empty one. */
export function defaultAnchor(frames: Frame[], text: Frame): Frame | undefined {
  const imgs = frames.filter((x) => x.kind === "image")
  const pool = imgs.some((x) => x.photo) ? imgs.filter((x) => x.photo) : imgs
  return pool.reduce<Frame | undefined>((best, x) => (!best || gap(x, text) < gap(best, text) ? x : best), undefined)
}
/** The photo a live caption reads from (null: no anchor, or the anchor frame is empty). */
export const anchorPhoto = (frames: Frame[], f: Frame) => (f.anchor ? frames.find((x) => x.id === f.anchor)?.photo ?? null : null)
