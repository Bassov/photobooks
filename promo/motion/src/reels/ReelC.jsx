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
import { reelConfig } from './shared/beats.js'
import { cameraAt, clickScaleAt, shotAt, springAt } from './shared/Springs.js'
import { Background } from './shared/Background.jsx'
import { Camera, boxToOutput } from './shared/Camera.jsx'
import { Cursor } from './shared/Cursor.jsx'
import { EndCard, endMove } from './shared/EndCard.jsx'
import { Focus } from './shared/Focus.jsx'
import { Grain } from './shared/Grain.jsx'
import { PdfSheet, pdfSheetSize } from './shared/PdfSheet.jsx'
import {
  CLIP_DATA,
  PDF_PX_PER_MM,
  ROOM_LIGHT,
  ROOM_SPREAD,
  SHELF_PATCH_X,
  VP,
  pointerAt,
  whipOffset,
} from './c.shots.js'

// Reel C «Без ожидания» (promo-reels-3 §5): the kit clips (walks-c.mjs) under hard beat cuts and whip pans on a
// near-black ground, the PDF pages built from the product's print geometry, the end card over the open book.
// No text except the end card's.

const REEL = 'c'

/** Clip frame shown at reel frame `frame` of `shot` (1×; the last frame holds past the clip's end). */
const clipFrame = (shot, frame) =>
  Math.max(
    0,
    Math.min(
      CLIP_DATA[shot.ui.clip].frames - 1,
      Math.round(frame) - shot.from + shot.ui.at,
    ),
  )

/** The kit clip at one frame, the full CSS viewport in plane px. */
const ClipFrame = ({ shot, frame, style }) => (
  <Freeze frame={clipFrame(shot, frame)}>
    <OffthreadVideo
      src={staticFile(`clips/${shot.ui.clip}.mp4`)}
      muted
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: VP.w,
        height: VP.h,
        ...style,
      }}
    />
  </Freeze>
)

/** A window of the clip: plane box `src` drawn at plane box `dst` (same size), optionally moved by `dy`. */
const ClipCut = ({ shot, frame, src, dx = 0, dy = 0 }) => (
  <div
    style={{
      position: 'absolute',
      left: src.x + dx,
      top: src.y + dy,
      width: src.w,
      height: src.h,
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        position: 'absolute',
        left: -src.x,
        top: -src.y,
        width: VP.w,
        height: VP.h,
      }}
    >
      <ClipFrame shot={shot} frame={frame} />
    </div>
  </div>
)

/** §2 photo landing: the graded photo springs (`light`) from 1.06 to the frame box, then gives way to the clip. */
const Landing = ({ land, frame }) => {
  const k = frame - land.frame
  if (k < 0 || k > 16) return null
  const p = springAt(k, 'light')
  const s = 1.06 + (1 - 1.06) * p
  if (k > 4 && Math.abs(s - 1) * land.box.w < 0.5) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: land.box.x,
        top: land.box.y,
        width: land.box.w,
        height: land.box.h,
        overflow: 'hidden',
        transform: `scale(${s})`,
        transformOrigin: '50% 50%',
      }}
    >
      <Img
        src={staticFile(`photos/${land.file}`)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  )
}

/** C8: spine books drop 60 px onto the shelf (`heavy`); before its drop a book's slot shows the case's back wall. */
const Drops = ({ shot, frame }) => (
  <>
    {shot.drops.map((d, k) => {
      const slot = {
        x: d.box.x - 3,
        y: d.box.y - 6,
        w: d.box.w + 6,
        h: d.box.h + 6,
      }
      const t = frame - d.from
      if (t < 0)
        return (
          <ClipCut
            key={k}
            shot={shot}
            frame={frame}
            src={{ ...slot, x: SHELF_PATCH_X }}
            dx={slot.x - SHELF_PATCH_X}
          />
        )
      const p = springAt(t, 'heavy')
      if (t > 40) return null
      return (
        <React.Fragment key={k}>
          <ClipCut
            shot={shot}
            frame={frame}
            src={{ ...slot, x: SHELF_PATCH_X }}
            dx={slot.x - SHELF_PATCH_X}
          />
          <ClipCut shot={shot} frame={frame} src={slot} dy={-60 * (1 - p)} />
        </React.Fragment>
      )
    })}
  </>
)

/** The reading room lit on the dark ground (C10, C11): a feathered window on the open book. */
function roomMask(frame, shot) {
  // the cover still swings up at the start of C10: the window starts tall and settles on the book
  const t = Math.min(1, Math.max(0, (frame - shot.from) / 20))
  const top = ROOM_LIGHT.y * t
  const h = ROOM_LIGHT.h + (ROOM_LIGHT.y - top)
  const f = 90
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${VP.w}" height="${VP.h}">` +
    `<filter id="f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${f / 2}"/></filter>` +
    `<rect x="${ROOM_LIGHT.x}" y="${top}" width="${ROOM_LIGHT.w}" height="${h}" rx="40" fill="#fff" filter="url(#f)"/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

const UiPlane = ({ shot }) => {
  const frame = useCurrentFrame()
  const mask = shot.room ? roomMask(frame, shot) : null
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: VP.w,
        height: VP.h,
        ...(mask
          ? {
              maskImage: mask,
              WebkitMaskImage: mask,
              maskSize: '100% 100%',
              WebkitMaskSize: '100% 100%',
            }
          : null),
      }}
    >
      <ClipFrame shot={shot} frame={frame} />
      {shot.drops && <Drops shot={shot} frame={frame} />}
      {shot.land && <Landing land={shot.land} frame={frame} />}
    </div>
  )
}

/** C7 artwork of one PDF page: the photos side by side, cover = dark back + spine, photo front. */
const PageArt = ({ page }) => {
  const photo = (file, flex = 1) => (
    <div key={file} style={{ flex, position: 'relative', overflow: 'hidden' }}>
      <Img
        src={staticFile(`photos/${file}`)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  )
  if (page.kind === 'cover') {
    const back = page.spineX / page.trimW
    const spine = page.spine / page.trimW
    return (
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        <div style={{ flex: back, background: '#3E3C3B' }} />
        <div style={{ flex: spine, background: '#2F2D2C' }} />
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

const PdfPlane = ({ shot }) => {
  const frame = useCurrentFrame()
  return (
    <>
      {shot.pdf.map((page, k) => {
        const size = pdfSheetSize(page.trimW, page.trimH, PDF_PX_PER_MM)
        const p = springAt(frame - page.at, 'medium')
        if (frame < page.at) return null
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
            x={(shot.plane.w - size.w) / 2 + (k - 1) * 40}
            y={page.y + (1 - p) * 1500}
          >
            <PageArt page={page} />
          </PdfSheet>
        )
      })}
    </>
  )
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
        transform: `translateX(${dx}px)`,
      }}
    >
      {children}
    </div>
  )
}

/** Pointer of the shot's clip in output px (cursor drawn by Remotion, §2), or null. */
function cursorAt(shot, frame) {
  if (!shot.ui || shot.scale === 'end') return null
  const cf = clipFrame(shot, frame)
  const p = pointerAt(shot.ui.clip, cf)
  const { s, tx, ty } = cameraAt(shot, frame)
  const downs = CLIP_DATA[shot.ui.clip].events
    .filter((e) => e[1] === 'down')
    .map((e) => e[0] - shot.ui.at + shot.from)
  return {
    x: p.x * s + tx + whipOffset(shot, frame),
    y: p.y * s + ty,
    scale: clickScaleAt(downs, frame),
  }
}

export const ReelC = ({ table, audio = true, probe = true }) => {
  const frame = useCurrentFrame()
  const { beatFrames } = reelConfig(REEL)
  const shot = shotAt(table.shots, frame)
  const end = table.shots.find((s) => s.scale === 'end')
  const plane = shot.plane ?? table.plane
  const focusBox = shot.focus ? shot.focus(frame) : null
  const focus = focusBox ? boxToOutput(shot, frame, focusBox) : null
  const content = () => (
    <Camera shot={shot} plane={plane}>
      <Whip shot={shot}>
        {shot.pdf ? <PdfPlane shot={shot} /> : <UiPlane shot={shot} />}
      </Whip>
    </Camera>
  )
  // end card: the open book eases into the box above the text (heavy spring), the camera keeps its slow push
  let move = null
  if (shot === end) {
    const rect = boxToOutput(end, end.from, ROOM_SPREAD)
    move = endMove(rect, frame, end.from)
  }
  const cursor = cursorAt(shot, frame)
  return (
    <AbsoluteFill>
      <Background reel={REEL} />
      <AbsoluteFill
        style={
          move
            ? {
                transformOrigin: '0 0',
                transform: `translate(${move.x}px, ${move.y}px) scale(${move.s})`,
              }
            : undefined
        }
      >
        <Focus reel={REEL} box={focus} render={content} />
      </AbsoluteFill>
      {cursor && <Cursor at={cursor} />}
      {end && <EndCard from={end.from} beatFrames={beatFrames} probe={probe} />}
      <Grain reel={REEL} />
      {audio && <Audio src={staticFile(`audio/${REEL}.wav`)} />}
    </AbsoluteFill>
  )
}
