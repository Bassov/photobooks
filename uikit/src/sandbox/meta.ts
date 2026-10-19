import { P } from "@/data"
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
export function fillTokens(tpl: string, photo: string | null) {
  if (!photo) return tpl.replace(/\{(date|title|caption|camera)\}/g, "—")
  const m = metaOf(photo)
  return tpl.replace("{date}", m.dateLabel).replace("{title}", m.title).replace("{caption}", m.caption || m.title).replace("{camera}", m.camera)
}
