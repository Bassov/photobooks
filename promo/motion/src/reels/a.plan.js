// Reel A v2 «Одна поездка» beat plan (Designer promo-reels-v2 spec §3 «Cut to the music», §4 item 3): the reel frame
// of every cut and every filmed event, on the track's own grid (`<reel>.beats.json`, gridBeatFrame). Pure: the capture
// walks (promo/reels/walks-a.mjs) time the kit clips with it, a.shots.js maps the clips back with constant offsets, so
// both sides read the same numbers. Another track = re-run the walks and the bridge (the grid moves every event).
import { gridBeatFrame, liftFrame } from './shared/beats.js'

/** Reel A cuts on these beats (24 beats = 6 bars of the excerpt; the end card sits on the last downbeat, b20). */
export const CUT_BEATS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 20]

/**
 * `grid` = beats.json → reel frames. The hero bar's downbeat (`liftBar`, b8 on Walking Away) carries Fill book's
 * Enter (Designer decision 2026-11-28), so the plan asserts that the lift sits on the cut it expects.
 */
export function planA(grid) {
  const b = (n, offset = 0) => gridBeatFrame(grid, n, offset)
  const cuts = CUT_BEATS.map((n) => b(n))
  const enter = liftFrame(grid)
  if (enter !== b(8))
    throw new Error(
      `a.plan: the track's lift bar ${grid.liftBar} is not bar 2 (frame ${enter}, reel A puts Fill book on b8 = ${b(8)})`,
    )
  return {
    frames: grid.frames,
    cuts,
    // A1: the GL turn; reel frame 0 is `lead` clip frames after the click's up (the leaf is lifted, G6)
    turnLead: 7,
    // A2: the filled book holds for a bar half, then its photos lift off into the strip from b3 (the rewind)
    cardsFrom: b(3),
    // A3: the thumb pick on b4 (the cut), the drop on b5
    pick: b(4),
    drop: b(5),
    // A4: the Fill book chip on b7; A5: Enter on the hero downbeat (b8)
    chip: b(7),
    enter,
    // A6: the pointer has left the lifted face-out book just before the cut; it clicks the book on b12 (the cut)
    leave: b(10, -8),
    open: b(12),
    // A8: the hand reaches the page corner; A9: the breath drag starts on b16 (the cut), 1300 ms
    breath: b(16),
    breathMs: 1300,
    // A10: the end card on the last downbeat
    end: b(20),
  }
}
