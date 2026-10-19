export type Photo = { id: string; src: string; name: string; w: number; h: number; lowres?: boolean; credit: { title: string; author: string; url: string } }

/** CC0 photos from StockSnap.io (see /PHOTO-CREDITS.md). File names are fictional camera names; w/h = original size. */
const raw: [string, string, number, number, boolean, string, string, string][] = [
  ["p01.jpg", "IMG_4102.jpg", 6000, 4000, false, "Mountain Lake", "Aukje Leermakers", "https://stocksnap.io/photo/mountain-lake-5IGV8IZMBT"],
  ["p02.jpg", "IMG_4155-whatsapp.jpg", 800, 533, true, "Guy Man", "Joshua Ness", "https://stocksnap.io/photo/guy-man-1HH5ZHYI3F"],
  ["p03.jpg", "IMG_4160.jpg", 3499, 5241, false, "Woman Landscape", "Travel Adventures", "https://stocksnap.io/photo/woman-landscape-20MAQ3FKTB"],
  ["p04.jpg", "IMG_4171.jpg", 4096, 2144, false, "City Architecture", "Sergei Gussev", "https://stocksnap.io/photo/city-architecture-AFJ2YJAZUK"],
  ["p05.jpg", "IMG_4188.jpg", 5785, 3862, false, "Coffee Cappuccino", "Vicky Gu", "https://stocksnap.io/photo/coffee-cappuccino-9QUVG8OY1I"],
  ["p06.jpg", "IMG_4203.jpg", 3936, 2624, false, "Vineyard Farm", "Tim Mossholder", "https://stocksnap.io/photo/vineyard-farm-CA2BR3JS31"],
  ["p07.jpg", "IMG_4210.jpg", 4838, 3226, false, "Man Woman", "Freestocks.org", "https://stocksnap.io/photo/man-woman-DEQLZPT7JI"],
  ["p08.jpg", "IMG_4236.jpg", 5033, 3178, false, "Desert Road", "Tom Swinnen", "https://stocksnap.io/photo/desert-road-DH9VTNUICA"],
  ["p09.jpg", "IMG_4249.jpg", 3910, 2932, false, "Sunset Sea", "Sergei Gussev", "https://stocksnap.io/photo/sunset-sea-DL9RTMU7JI"],
  ["p10.jpg", "IMG_4251.jpg", 5037, 3358, false, "Forest Woods", "Michal Kulesza", "https://stocksnap.io/photo/forest-woods-F8IX8796HF"],
  ["p11.jpg", "IMG_4262.jpg", 3844, 2880, false, "Footprints Sand", "Sergei Gussev", "https://stocksnap.io/photo/footprints-sand-GBUFTJIRSS"],
  ["p12.jpg", "IMG_4270.jpg", 4016, 6016, false, "Mother Child", "Beauty and Fashion", "https://stocksnap.io/photo/mother-child-MJXYBR1LV2"],
  ["p13.jpg", "IMG_4288.jpg", 5501, 3667, false, "Woman Beach", "Josh Willink", "https://stocksnap.io/photo/woman-beach-MP2ZSG6XYP"],
  ["p14.jpg", "IMG_4301.jpg", 1920, 1280, false, "Small Boy", "Studio 7042", "https://stocksnap.io/photo/small-boy-QIJ4BAZL2D"],
  ["p15.jpg", "IMG_4312.jpg", 3861, 2574, false, "People Family", "Natalya Zaritskaya", "https://stocksnap.io/photo/people-family-Z59RZ5SREK"],
  ["p16.jpg", "IMG_4320.jpg", 6000, 4000, false, "Woman Adventure", "Ben Urcan", "https://stocksnap.io/photo/woman-adventure-XND3JD3ZJX"],
  ["p17.jpg", "IMG_4333.jpg", 5760, 3840, false, "Train Tracks", "Leeroy", "https://stocksnap.io/photo/train-tracks-46BADF516C"],
  ["p18.jpg", "IMG_4347.jpg", 3648, 5472, false, "Forest Path", "Free Nature Stock", "https://stocksnap.io/photo/forest-path-AXOFGKXCSI"],
  ["p19.jpg", "IMG_4359.jpg", 5184, 3456, false, "Sea Ocean", "Adam Sherez", "https://stocksnap.io/photo/sea-ocean-U94DINCLO0"],
  ["p20.jpg", "IMG_4366.jpg", 2731, 4096, false, "Toddler Standing", "Matt Bango", "https://stocksnap.io/photo/toddler-standing-H5DGO1ELXN"],
]
export const photos: Photo[] = raw.map(([f, name, w, h, lowres, title, author, url]) => ({
  id: f.split(".")[0], src: `photos/${f}`, name, w, h, lowres, credit: { title, author, url },
}))
/** Extra photos used only by specimens (not part of the demo gallery, so gallery counts stay 20).
 *  p21 = square centre crop of p05 (same CC0 photo), to show a 1:1 original next to landscape / portrait. */
export const extraPhotos: Photo[] = [
  { id: "p21", src: "photos/p21.jpg", name: "IMG_4391.jpg", w: 3862, h: 3862, credit: { title: "Coffee Cappuccino (square crop)", author: "Vicky Gu", url: "https://stocksnap.io/photo/coffee-cappuccino-9QUVG8OY1I" } },
]
export const P = (id: string) => (photos.find((p) => p.id === id) ?? extraPhotos.find((p) => p.id === id))!

/** frames in spread coordinates: % of spread width / height (spread = 2 square pages) */
export type Box = { x: number; y: number; w: number; h: number }
export type Template = { id: string; name: string; count: number; frames: Box[]; group: string }

export const templates: Template[] = [
  { id: "t-full", name: "Full bleed", count: 0, group: "1", frames: [{ x: 0, y: 0, w: 100, h: 100 }] },
  { id: "t-pair", name: "One per page", count: 0, group: "2", frames: [{ x: 5, y: 10, w: 40, h: 80 }, { x: 55, y: 10, w: 40, h: 80 }] },
  { id: "t-hero2", name: "Hero + two", count: 0, group: "3", frames: [{ x: 0, y: 0, w: 50, h: 100 }, { x: 55, y: 8, w: 41.25, h: 41 }, { x: 55, y: 51, w: 41.25, h: 41 }] },
  { id: "t-hero4", name: "Hero + grid", count: 0, group: "4", frames: [{ x: 4, y: 8, w: 42, h: 84 }, { x: 54, y: 8, w: 20, h: 40 }, { x: 76, y: 8, w: 20, h: 40 }, { x: 54, y: 52, w: 20, h: 40 }, { x: 76, y: 52, w: 20, h: 40 }] },
  { id: "t-pano", name: "Panorama", count: 0, group: "p", frames: [{ x: 0, y: 22, w: 100, h: 56 }] },
  { id: "t-three", name: "Three across", count: 0, group: "3", frames: [{ x: 4, y: 20, w: 28, h: 60 }, { x: 36, y: 20, w: 28, h: 60 }, { x: 68, y: 20, w: 28, h: 60 }] },
  { id: "t-margin", name: "Framed single", count: 0, group: "1", frames: [{ x: 54, y: 14, w: 42, h: 72 }] },
  { id: "t-six", name: "Contact grid", count: 0, group: "4", frames: [{ x: 4, y: 8, w: 13, h: 40 }, { x: 18.5, y: 8, w: 13, h: 40 }, { x: 33, y: 8, w: 13, h: 40 }, { x: 4, y: 52, w: 13, h: 40 }, { x: 18.5, y: 52, w: 13, h: 40 }, { x: 33, y: 52, w: 13, h: 40 }, { x: 54, y: 8, w: 42, h: 84 }] },
  { id: "t-stack", name: "Stacked pair", count: 0, group: "2", frames: [{ x: 4, y: 8, w: 42, h: 40 }, { x: 4, y: 52, w: 42, h: 40 }, { x: 50, y: 0, w: 50, h: 100 }] },
  { id: "t-wide", name: "Wide + caption", count: 0, group: "2", frames: [{ x: 0, y: 0, w: 100, h: 62 }, { x: 54, y: 68, w: 42, h: 24 }] },
  { id: "t-quad", name: "Four squares", count: 0, group: "4", frames: [{ x: 5, y: 10, w: 19, h: 38 }, { x: 26, y: 10, w: 19, h: 38 }, { x: 5, y: 52, w: 19, h: 38 }, { x: 26, y: 52, w: 19, h: 38 }, { x: 55, y: 10, w: 40, h: 80 }] },
  { id: "t-offset", name: "Offset pair", count: 0, group: "2", frames: [{ x: 6, y: 6, w: 38, h: 60 }, { x: 56, y: 34, w: 38, h: 60 }] },
]
export const T = (id: string) => templates.find((t) => t.id === id)!

export type Spread = { template: string; photos: (string | null)[] }
export const book: Spread[] = [
  { template: "t-margin", photos: ["p13"] },
  { template: "t-full", photos: ["p09"] },
  { template: "t-hero2", photos: ["p16", "p07", "p11"] },
  { template: "t-pair", photos: ["p03", "p18"] },
  { template: "t-hero4", photos: ["p15", "p05", "p14", "p06", "p19"] },
  { template: "t-pano", photos: ["p04"] },
  { template: "t-three", photos: ["p12", "p20", "p10"] },
  { template: "t-offset", photos: [null, null] },
]
export const BOOK_TITLE = "Summer by the sea"
/** spread = two 200 × 200 mm pages */
export const SPREAD_MM = { w: 400, h: 200 }
export const books = [
  { title: "Summer by the sea", cover: "p16", spreads: 8, edited: "2 hours ago", folder: "~/Pictures/Summer 2025" },
  { title: "Mountains, July", cover: "p01", spreads: 18, edited: "Yesterday", folder: "~/Pictures/Mountains" },
  { title: "Family album 2025", cover: "p15", spreads: 24, edited: "Oct 2", folder: "~/Pictures/Family" },
  { title: "Road trip west", cover: "p08", spreads: 12, edited: "Sep 28", folder: "~/Pictures/Road trip" },
  { title: "Forest walks", cover: "p10", spreads: 10, edited: "Sep 14", folder: "~/Pictures/Forest" },
  { title: "Vineyards & coffee", cover: "p06", spreads: 6, edited: "Aug 30", folder: "~/Pictures/Autumn" },
]
templates.forEach((t) => { t.count = t.frames.length; t.group = t.id === "t-pano" ? "p" : t.count >= 4 ? "4" : String(t.count) })
