// @ts-check

/**
 * The score. Four layers, played TOGETHER.
 *
 * Every stem is the same 8.000-second loop, so all four sources start at the same
 * instant and loop the same window — they are phase-locked forever, and a layer
 * can arrive mid-bar in perfect time. Solving a clue does not SWAP the music; it
 * ADDS to it. By the ending all four are playing at once.
 *
 * Two things this had to survive, both measured rather than assumed:
 *
 * 1. **The files were 66 seconds long and all different lengths** (66.009 /
 *    65.881 / 64.769 / 66.988). They looked unlayerable. They are not: each is
 *    the SAME 8.000s loop repeated, sample-for-sample (autocorrelation 1.0000 at
 *    exactly 8.000s). The 66s was just a different number of repeats. One cycle
 *    cut from each gives four files of identical length.
 *
 * 2. **AAC decoding adds ~2,751 frames of priming silence.** Loop the whole
 *    buffer and that silence lands in the music every 8 seconds — an audible
 *    stutter. So each file holds the loop TWICE and we loop the middle window
 *    (4s -> 12s): any 8-second window of a periodic signal is itself a seamless
 *    loop, the padding is never inside it, and taking the same window from all
 *    four keeps their phase.
 */

/** The musical period. Everything depends on this being identical for all four. */
const LOOP_SECONDS = 8;

/**
 * ============================= THE MIX =============================
 *
 * `start` is where each layer's 8-second loop window BEGINS inside its file.
 *
 * Every file holds the same loop twice, and a loop has no beginning — so moving
 * the window ROTATES that layer against the others, without changing its length
 * or breaking its seam. That is how a layer whose downbeat lands in the wrong
 * place gets pulled back into the bar.
 *
 * **These numbers are not tuned by ear. They are MEASURED.**
 *
 * Balaji supplied a reference mix of all four layered correctly. Each stem is
 * ADDITIVELY present in it, so an FFT cross-correlation of stem against reference
 * spikes at the exact alignment. It landed within a hair of the value you would
 * predict if the reference were a straight equal-gain sum:
 *
 *     file       corr    predicted     start
 *     dead       0.284     0.293      4.7514
 *     photo      0.145     0.147      5.7919
 *     alive      0.911     0.907      1.8010
 *
 * The lion was later RE-RECORDED, and measured against a two-track reference
 * (dead + new lion only). Deliberately two tracks, not four: correlation strength
 * is roughly |stem| / |whole mix|, so a quiet layer buried under a loud one is a
 * whisper under a shout. Against just the dead track the lion came in at 0.541
 * (predicted 0.522) instead of the ~0.18 it would have been in a full mix — and
 * the reconstruction of that reference from the two stems was 1.000, exactly.
 *
 *     lion       0.541     0.522      5.1157
 *
 * `start` belongs to the FILE, not the stage — so the stages can be reordered
 * freely without touching the alignment.
 *
 * Which proves two things: the offsets below are the true ones, and **the correct
 * gains are all 1.0**. The photo layer sounded "too loud" because I had boosted it
 * to 1.35; it and the lion sounded "off" because they were rotated wrong — and a
 * phase clash reads as harshness, which is easy to mistake for volume.
 *
 * (An earlier 20ms-step scan found none of this. At audio frequencies, being 10ms
 * out destroys correlation, so it stepped straight over every peak.)
 * ==================================================================
 */
const LAYERS = [
  // Balaji's running order. Reordering is FREE: `start` travels with the FILE, so
  // it only changes WHEN each layer arrives, never how they sit together. The full
  // arrangement at the end is the same mix whatever the order.
  { src: 'assets/audio/0-dead.m4a', gain: 1.00, start: 4.7514 },  // from the first step
  { src: 'assets/audio/1-lion.m4a', gain: 1.00, start: 5.1157 },  // + the lion falls (re-recorded)
  { src: 'assets/audio/2-photo.m4a', gain: 0.75, start: 5.7919 }, // + the photograph
  { src: 'assets/audio/3-alive.m4a', gain: 1.00, start: 1.8010 }, // + the world blooms
];

/** How muffled the music is in the dead world, and how open by the end. */
const CUTOFF_DEAD = 620;
const CUTOFF_ALIVE = 20000;

/** Seconds. Matched to the colour tween, so the music blooms as the world does. */
const FADE_IN = 2.2;

const MASTER = 0.7;

/**
 * @typedef {object} Audio
 * @property {(stage: number) => void} unlock  bring in every layer up to `stage`
 * @property {(c: number) => void} setColor    0..1 — drives the lowpass
 * @property {() => boolean} toggleMute
 */

/**
 * Must be called FROM A USER GESTURE — browsers refuse to start an AudioContext
 * otherwise, which is exactly why the title screen exists.
 *
 * Returns null if anything at all goes wrong. Silence is a bad outcome; a broken
 * game is a worse one.
 *
 * @returns {Promise<Audio | null>}
 */
export async function createAudio() {
  /** @type {AudioContext} */
  let ctx;
  try {
    ctx = new AudioContext();
    await ctx.resume();
  } catch {
    return null;
  }

  try {
    const master = ctx.createGain();
    master.gain.value = MASTER;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = CUTOFF_DEAD;
    filter.Q.value = 0.7;

    // Four layers summing can peak past 1.0. A gentle limiter is cheap insurance
    // against clipping at the exact moment the world blooms.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;

    filter.connect(limiter);
    limiter.connect(master);
    master.connect(ctx.destination);

    const buffers = await Promise.all(
      LAYERS.map(async (l) => {
        const res = await fetch(l.src);
        if (!res.ok) throw new Error(l.src);
        return ctx.decodeAudioData(await res.arrayBuffer());
      }),
    );

    /**
     * Every layer starts at the SAME instant, looping the SAME window, all at
     * silence except the first. That is what phase-locks them: a layer arriving
     * later is only a gain ramp, never a new source spinning up out of step.
     */
    const startAt = ctx.currentTime + 0.05;

    const voices = buffers.map((buffer, i) => {
      const gain = ctx.createGain();
      gain.gain.value = i === 0 ? LAYERS[i].gain : 0;
      gain.connect(filter);

      // Where this layer's loop window begins. Moving it ROTATES the layer against
      // the others — a loop has no beginning — without changing its length or
      // breaking its seam.
      const from = LAYERS[i].start;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = from;
      source.loopEnd = from + LOOP_SECONDS;
      source.connect(gain);

      // ALL of them start at the same instant. That is what phase-locks them; a
      // layer arriving later is only a gain ramp, never a source spinning up out
      // of step.
      source.start(startAt, from);

      return gain;
    });

    let muted = false;

    return {
      unlock(stage) {
        const now = ctx.currentTime;
        // Cumulative: every layer up to `stage` is playing. Nothing is ever taken
        // away — the music only ever grows.
        voices.forEach((gain, i) => {
          const target = i <= stage ? LAYERS[i].gain : 0;
          gain.gain.setTargetAtTime(target, now, FADE_IN / 4);
        });
      },

      setColor(c) {
        const t = Math.min(1, Math.max(0, c));
        // Exponential in frequency: the ear hears brightness that way, so a linear
        // sweep would do almost nothing until the very end.
        const hz = CUTOFF_DEAD * Math.pow(CUTOFF_ALIVE / CUTOFF_DEAD, t);
        filter.frequency.setTargetAtTime(hz, ctx.currentTime, 0.25);
      },

      toggleMute() {
        muted = !muted;
        master.gain.setTargetAtTime(muted ? 0 : MASTER, ctx.currentTime, 0.05);
        return muted;
      },
    };
  } catch {
    return null; // no music. The game plays on.
  }
}
