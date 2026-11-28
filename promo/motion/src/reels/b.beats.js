// Reel B's beat grid (promo-reels-v2 spec §3 "Cut to the music"): the track gate's pick for reel B (Designer review 4),
// copied from promo/out/reels/sound/b.beats.json (`node promo/motion/scripts/reels-mix.mjs --analyse --reel b`).
// The shot table cuts on these beats; reels-render.mjs fails when the mix's beats.json differs (another track or
// excerpt: copy its grid here, the cut follows it). Plain data: Node and the Remotion bundle both import it.
export default {
  reel: 'b',
  track: 'tetrapod',
  title: 'Tetrapod',
  sha256: '676320de208dfcc3464132e793ddc571b745c0538bb8af135a901d816c180e24',
  bpm: 91.38,
  period: 0.65662,
  start: 13.4125,
  length: 18.3855,
  frames: 552,
  bars: 7,
  downbeats: [0, 4, 8, 12, 16, 20, 24],
  liftBar: 2,
  beats: [
    0, 0.6566, 1.3132, 1.9699, 2.6265, 3.2831, 3.9397, 4.5964, 5.253, 5.9096,
    6.5662, 7.2229, 7.8795, 8.5361, 9.1927, 9.8494, 10.506, 11.1626, 11.8192,
    12.4758, 13.1325, 13.7891, 14.4457, 15.1023, 15.759, 16.4156, 17.0722,
    17.7288,
  ],
}
