// @ts-check

/**
 * Fixed-ish game loop. `dt` is clamped so that alt-tabbing away and back does
 * not teleport the player across the level in a single 4-second frame.
 *
 * @param {(dt: number) => void} update seconds since last frame
 * @param {() => void} render
 * @returns {() => void} stop
 */
export function startLoop(update, render) {
  const MAX_DT = 1 / 30;
  let last = performance.now();
  let raf = 0;
  let running = true;

  /** @param {number} now */
  function frame(now) {
    if (!running) return;

    // Clamped at BOTH ends.
    //
    // The upper clamp stops alt-tabbing away and back from teleporting the player
    // across the level in one 4-second frame.
    //
    // The LOWER clamp matters just as much: a rAF timestamp is the time the frame
    // BEGAN, which can be earlier than the performance.now() captured just before
    // requestAnimationFrame was called. So the first dt is often slightly
    // NEGATIVE. Anything integrating time then goes backwards — an animation clock
    // reaches -0.007, Math.floor(-0.007 * fps) % frames is -1, and indexing a
    // frame array with -1 yields undefined, which explodes far away inside
    // drawImage with no hint as to why.
    const dt = Math.max(0, Math.min((now - last) / 1000, MAX_DT));
    last = now;

    update(dt);
    render();

    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);

  // A backgrounded tab stops firing rAF; without this, `last` goes stale and
  // the first frame back would produce a huge dt (clamped, but still a jump).
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) last = performance.now();
  });

  return () => {
    running = false;
    cancelAnimationFrame(raf);
  };
}
