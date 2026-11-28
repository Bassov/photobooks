import React from 'react'
import {
  AbsoluteFill,
  Audio,
  Freeze,
  Img,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
} from 'remotion'
import { HEIGHT } from './shared/beats.js'
import { cameraAt, clickScaleAt, shotAt, springAt } from './shared/Springs.js'
import { Background } from './shared/Background.jsx'
import {
  Camera,
  DRAG,
  PARALLAX,
  boxToOutput,
  dragTilt,
  dragWidth,
  isFast,
  toOutput,
} from './shared/Camera.jsx'
import { Cursor } from './shared/Cursor.jsx'
import { EndCard, EndHero } from './shared/EndCard.jsx'
import { Finish } from './shared/Finish.jsx'
import { Focus } from './shared/Focus.jsx'
import { PdfSheet, pdfSheetSize } from './shared/PdfSheet.jsx'
import {
  BEAT_FRAMES,
  CLIP_DATA,
  PDF_PX_PER_MM,
  VP,
  pointerAt,
  whipOffset,
} from './c.shots.js'

// Reel C «Без ожидания» v2 (promo-reels-v2 §2–§5): the kit clips (walks-c.mjs) under hard beat cuts and whip pans on
// the G2 ground, dragged photos as G5 cards, the PDF pages built from the product's print geometry (G3: ≥ 880 px
// wide), the end card over the open book (G7). No text except the end card's. Audio: the reels-mix.mjs mix of the
// gate's track (reels-render.mjs stages it as audio/c.wav).

const REEL = 'c'
const photoSrc = (file) => staticFile(`photos/${file}`)

/** Clip frame of `clip` shown at reel frame `frame` when clip frame `at` plays on reel frame `from` (1×; the last
 *  frame holds past the clip's end). */
const clipIndex = (clip, at, from, frame) =>
  Math.max(
    0,
    Math.min(CLIP_DATA[clip].frames - 1, Math.round(frame) - from + at),
  )
const clipFrame = (shot, frame) =>
  clipIndex(shot.ui.clip, shot.ui.at, shot.from, frame)

/** True on the reel frames under motion blur (set from the real frame, outside the blur's sub-frame samples). */
const LoRes = React.createContext(false)

/** The kit clip at clip frame `index`, the full CSS viewport in plane px. Under motion blur the DPR-1 copy
 *  (`.lo.mp4`, from walks-c.mjs --pack): 10 samples of the 3840×4320 clip run past Remotion's 30 s timeout. */
const ClipFrame = ({ clip, index, onVideoFrame }) => (
  <Freeze frame={index}>
    <OffthreadVideo
      src={staticFile(
        `clips/${clip}${React.useContext(LoRes) ? '.lo' : ''}.mp4`,
      )}
      onVideoFrame={onVideoFrame}
      muted
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: VP.w,
        height: VP.h,
      }}
    />
  </Freeze>
)

/** The plane's one decoded clip frame, shared by its cut-outs (ClipCut): a second OffthreadVideo per cut-out would
 *  fetch the same 3840×4320 frame again and run past the 30 s per-frame timeout. */
const Cuts = React.createContext(null)

function makeCuts() {
  let img = null
  const canvases = new Set()
  /** Mean of channel `ch` over plane box `b` of the current frame. */
  const mean = (b, ch) => {
    const k = img.naturalWidth / VP.w
    const s = document.createElement('canvas')
    s.width = Math.max(1, Math.round(b.w * k))
    s.height = Math.max(1, Math.round(b.h * k))
    const sx = s.getContext('2d', { willReadFrequently: true })
    sx.drawImage(
      img,
      b.x * k,
      b.y * k,
      b.w * k,
      b.h * k,
      0,
      0,
      s.width,
      s.height,
    )
    const d = sx.getImageData(0, 0, s.width, s.height).data
    let sum = 0
    for (let i = ch; i < d.length; i += 4) sum += d[i]
    return sum / (d.length / 4)
  }
  const draw = (c) => {
    if (!img || !img.naturalWidth) return
    const k = img.naturalWidth / VP.w
    const { x, y, w, h } = JSON.parse(c.dataset.src)
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(img, x * k, y * k, w * k, h * k, 0, 0, c.width, c.height)
    if (!c.dataset.match) return
    // patch from another part of the wall: per-channel gain = wall above the slot / wall above the patch source
    const { ref, from } = JSON.parse(c.dataset.match)
    const gain = [0, 1, 2].map(
      (ch) => mean(ref, ch) / Math.max(1, mean(from, ch)),
    )
    const px = ctx.getImageData(0, 0, c.width, c.height)
    for (let i = 0; i < px.data.length; i += 4)
      for (let ch = 0; ch < 3; ch++) px.data[i + ch] *= gain[ch]
    ctx.putImageData(px, 0, 0)
  }
  return {
    frame: (i) => {
      img = i
      canvases.forEach(draw)
    },
    add: (c) => {
      canvases.add(c)
      draw(c)
    },
    remove: (c) => canvases.delete(c),
  }
}

/** A window of the clip: plane box `src` drawn into `dst` (default the same box), moved by `dy`. `match` = { ref,
 *  from }: scale the colours so plane box `from` would read like plane box `ref` (wall patches). The canvas keeps
 *  `dst`'s aspect at 3 px per plane px (G1). */
const ClipCut = ({ src, dst = src, dy = 0, match }) => {
  const cuts = React.useContext(Cuts)
  const ref = React.useRef(null)
  const key = JSON.stringify(src)
  const matchKey = match ? JSON.stringify(match) : ''
  React.useLayoutEffect(() => {
    const c = ref.current
    c.dataset.src = key
    c.dataset.match = matchKey
    cuts.add(c)
    return () => cuts.remove(c)
  }, [cuts, key, matchKey])
  return (
    <canvas
      ref={ref}
      width={Math.round(dst.w * 3)}
      height={Math.round(dst.h * 3)}
      style={{
        position: 'absolute',
        left: dst.x,
        top: dst.y + dy,
        width: dst.w,
        height: dst.h,
      }}
    />
  )
}

/** C9: spine books wait 60 px above their places and drop in one per beat (`heavy`). Only the 60 px under a raised
 *  book needs the case's back wall: one wall column (`shot.patchX`) stretched over it, colour-matched to the wall
 *  above the book. */
const DROP = 60
const Drops = ({ shot, frame }) => (
  <>
    {shot.drops.map((d, k) => {
      const t = frame - d.from
      if (t > 40) return null
      // the book's own box, ~1.5 px short on the right: a wider cut would carry a sliver of the next spine / wall;
      // whole CSS px, so each canvas (3 px per CSS px) keeps its box's aspect (G1, check 9)
      const slot = {
        x: Math.round(d.box.x),
        y: Math.round(d.box.y),
        w: Math.round(d.box.w - 1.5),
        h: Math.round(d.box.h),
      }
      const gap = { ...slot, y: slot.y + slot.h - DROP - 2, h: DROP + 2 }
      const strip = { x: slot.x, y: slot.y - 10, w: slot.w, h: 6 }
      const lift = t < 0 ? DROP : DROP * (1 - springAt(t, 'heavy'))
      return (
        <React.Fragment key={k}>
          <ClipCut
            src={{ ...gap, x: shot.patchX, w: 1 }}
            dst={{ ...gap, x: gap.x - 1, w: gap.w + 2 }}
            match={{ ref: strip, from: { ...strip, x: shot.patchX, w: 1 } }}
          />
          <ClipCut src={slot} dy={-lift} />
        </React.Fragment>
      )
    })}
  </>
)

const UiPlane = ({ shot }) => {
  const frame = useCurrentFrame()
  const cuts = React.useMemo(makeCuts, [])
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: VP.w,
        height: VP.h,
      }}
    >
      <ClipFrame
        clip={shot.ui.clip}
        index={clipFrame(shot, frame)}
        onVideoFrame={shot.drops ? cuts.frame : undefined}
      />
      {shot.drops && (
        <Cuts.Provider value={cuts}>
          <Drops shot={shot} frame={frame} />
        </Cuts.Provider>
      )}
    </div>
  )
}

/** Frames before the release the card starts its `light` landing (the spring first reaches the frame in ~4). */
const CARD_LAND = 6

/**
 * v2 G5 drag card (its own parallax layer, 1.03): the photo at 62 % of its target frame's width under the clip's
 * pointer, the drag shadow, tilted ≤ 3° by its speed; CARD_LAND frames before the release it springs (`light`) onto
 * the frame, and on the release it gives way to the clip, which shows the dropped photo from then on.
 */

const DragCard = ({ shot }) => {
  const frame = useCurrentFrame()
  const { drag } = shot
  // the card is gone on the release frame, when the clip shows the photo in the frame (and the frame's selection
  // handles, which a card on top would hide)
  if (frame < shot.from || frame >= drag.up) return null
  const ptr = (f) => pointerAt(shot.ui.clip, clipFrame(shot, f))
  const t = drag.target
  const aspect = t.h / t.w
  const cw = dragWidth(t.w)
  const land = drag.up - CARD_LAND
  const p0 = ptr(Math.min(frame, land))
  const card = { x: p0.x - cw / 2, y: p0.y - (cw * aspect) / 2, w: cw }
  const k = frame < land ? 0 : springAt(frame - land, 'light')
  const box = {
    x: card.x + (t.x - card.x) * k,
    y: card.y + (t.y - card.y) * k,
    w: card.w + (t.w - card.w) * k,
  }
  const vx = (ptr(frame).x - ptr(frame - 1).x) * cameraAt(shot, frame).s
  const tilt = dragTilt(vx) * (1 - Math.min(1, k))
  return (
    <div
      data-photo={drag.file}
      style={{
        position: 'absolute',
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.w * aspect,
        overflow: 'hidden',
        borderRadius: 2,
        boxShadow: DRAG.shadow,
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
      }}
    >
      <Img
        src={photoSrc(drag.file)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  )
}

/** Photo areas of the plane the clip's DOM can not name (the GL reader's pages): empty `data-photo` boxes. */
const PhotoBoxes = ({ shot }) => {
  const frame = useCurrentFrame()
  return (shot.photoBoxes?.(frame) ?? []).map((b, k) => (
    <div
      key={k}
      data-photo={b.id ?? 'page'}
      style={{
        position: 'absolute',
        left: b.x,
        top: b.y,
        width: b.w,
        height: b.h,
      }}
    />
  ))
}

/** C8 artwork of one PDF page: the photos side by side, cover = warm back + spine, photo front. */
const PageArt = ({ page }) => {
  const photo = (file, flex = 1) => (
    <div
      key={file}
      data-photo={file}
      style={{ flex, position: 'relative', overflow: 'hidden' }}
    >
      <Img
        src={photoSrc(file)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  )
  if (page.kind === 'cover') {
    const back = page.spineX / page.trimW
    const spine = page.spine / page.trimW
    return (
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        {photo(page.photos[1], back)}
        <div style={{ flex: spine, background: '#3A3633' }} />
        {photo(page.photos[0], 1 - back - spine)}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      {page.photos.map((f) => photo(f))}
    </div>
  )
}

/** The three sheets stacked down the 1080×1920 plane, overlapping evenly when they do not fit; each slams in from
 *  below on the `medium` spring and lands on its half-beat. */
const PdfPlane = ({ shot }) => {
  const frame = useCurrentFrame()
  const sizes = shot.pdf.map((p) =>
    pdfSheetSize(p.trimW, p.trimH, PDF_PX_PER_MM),
  )
  const n = shot.pdf.length
  const step = (shot.plane.h - sizes[n - 1].h) / (n - 1)
  return shot.pdf.map((page, k) => {
    if (frame < page.at) return null
    const size = sizes[k]
    const p = springAt(frame - page.at, 'medium')
    return (
      <PdfSheet
        key={k}
        trimW={page.trimW}
        trimH={page.trimH}
        pxPerMm={PDF_PX_PER_MM}
        cover={
          page.kind === 'cover'
            ? { spine: page.spine, spineX: page.spineX }
            : undefined
        }
        x={(shot.plane.w - size.w) / 2 + (k - 1) * 24}
        y={k * step + (1 - p) * HEIGHT}
      >
        <PageArt page={page} />
      </PdfSheet>
    )
  })
}

/** Whip pans move the picture inside the camera, so the motion blur samples them. */
const Whip = ({ shot, children }) => {
  const frame = useCurrentFrame()
  const dx = whipOffset(shot, frame) / cameraAt(shot, frame).s
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transform: dx ? `translate(${dx}px, 0px)` : undefined,
      }}
    >
      {children}
    </div>
  )
}

/**
 * C12 hero: the reader's book box of the shelf take (one resting clip frame, `end.frame`) with `end.margin` CSS px
 * of the lit room around it, in an output-px window eased by EndHero into END_BOX. The window shows the clip at one
 * scale (window w / book w) on both axes.
 */
const EndBook = ({ shot }) => {
  const { end } = shot
  const k = end.rect.w / end.book.w
  const m = Object.fromEntries(
    Object.entries(end.margin).map(([side, v]) => [side, v * k]),
  )
  return (
    <EndHero rect={end.rect} from={shot.from}>
      <div
        style={{
          position: 'absolute',
          left: -m.left,
          top: -m.top,
          width: end.rect.w + m.left + m.right,
          height: end.rect.h + m.top + m.bottom,
          overflow: 'hidden',
          // a lit card of the room on the dark end card, not a raw cut-out
          borderRadius: `${m.top * 0.5}px ${m.top * 0.5}px ${m.bottom}px ${m.bottom}px`,
          boxShadow: '0 28px 64px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: VP.w,
            height: VP.h,
            transformOrigin: '0 0',
            transform: `translate(${m.left - end.book.x * k}px, ${m.top - end.book.y * k}px) scale(${k})`,
          }}
        >
          <ClipFrame clip={end.clip} index={end.frame} />
        </div>
      </div>
    </EndHero>
  )
}

/** Pointer of the shot's clip in output px (cursor layer, parallax 1.03; drawn by Remotion, §2), or null. */
function cursorAt(shot, frame) {
  if (!shot.ui || shot.noCursor) return null
  const p = pointerAt(shot.ui.clip, clipFrame(shot, frame))
  const o = toOutput(shot, frame, p, PARALLAX.cursor)
  const downs = CLIP_DATA[shot.ui.clip].events
    .filter((e) => e[1] === 'down')
    .map((e) => e[0] - shot.ui.at + shot.from)
  return {
    x: o.x + whipOffset(shot, frame),
    y: o.y,
    scale: clickScaleAt(downs, frame),
  }
}

export const ReelC = ({ table, audio = true, probe = true }) => {
  const frame = useCurrentFrame()
  const shot = shotAt(table.shots, frame)
  const end = table.shots.find((s) => s.scale === 'end')
  const plane = shot.plane ?? table.plane
  const focusBox = shot.focus ? shot.focus(frame) : null
  const focus = focusBox ? boxToOutput(shot, frame, focusBox) : null
  const content = () => (
    <>
      <Camera shot={shot} plane={plane}>
        <Whip shot={shot}>
          {shot.pdf && <PdfPlane shot={shot} />}
          {shot.ui && <UiPlane shot={shot} />}
          {shot.end && <EndBook shot={shot} />}
          <PhotoBoxes shot={shot} />
        </Whip>
      </Camera>
      {shot.drag && (
        <Camera shot={shot} plane={plane} layer="drag">
          <Whip shot={shot}>
            <DragCard shot={shot} />
          </Whip>
        </Camera>
      )}
    </>
  )
  const cursor = cursorAt(shot, frame)
  return (
    <AbsoluteFill>
      <Background
        reel={REEL}
        photo={shot.ground ? photoSrc(shot.ground) : undefined}
      />
      {/* probe off = a 270×480 sheet cell (Root ReelSheet): 34 full-res clip frames in one still pass the 30 s
          timeout, and a cell shows the clip at ≤ 0.75 px per CSS px, so the DPR-1 copy loses nothing */}
      <LoRes.Provider value={!probe || isFast(shot, frame)}>
        <Focus reel={REEL} box={focus} render={content} />
      </LoRes.Provider>
      {cursor && <Cursor at={cursor} />}
      {end && (
        <EndCard
          from={end.from}
          beatFrames={BEAT_FRAMES}
          reel={REEL}
          probe={probe}
        />
      )}
      {audio && <Audio src={staticFile(`audio/${REEL}.wav`)} />}
      <Finish reel={REEL} probe={probe} />
    </AbsoluteFill>
  )
}
