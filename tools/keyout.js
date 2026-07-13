// @ts-check

/**
 * Strip the painted-on transparency checkerboard from a generated image.
 *
 * The generator writes the transparency checkerboard into the image as ACTUAL
 * grey squares — the PNG has no alpha at all. Three things make this harder than
 * "delete everything grey":
 *
 *   1. The subject has its own light/grey pixels (a stone lion is grey all over,
 *      a bench has white highlights). Colour alone cannot discriminate.
 *   2. Regions of checkerboard get ENCLOSED by the subject (between a bench's
 *      backrest and its seat, between a lion's legs). A flood-fill from the
 *      border never reaches them.
 *   3. The renderer anti-aliases the checkerboard into the subject, leaving a
 *      pale fringe too impure to classify.
 *
 * The discriminator that actually works: a checkerboard region contains BOTH of
 * its two shades, touching. A real highlight is one flat colour.
 */

/**
 * @param {HTMLCanvasElement} canvas image already drawn into it
 * @param {(msg: string) => void} [log]
 * @returns {boolean} true if a checkerboard was found and removed
 */
export function keyOutCheckerboard(canvas, log = () => {}) {
  const W = canvas.width;
  const H = canvas.height;
  const cx = canvas.getContext('2d', { willReadFrequently: true });
  if (!cx) throw new Error('no 2d context');

  const img = cx.getImageData(0, 0, W, H);
  const data = img.data;

  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 8) transparent++;
  const pct = (transparent / (W * H)) * 100;
  log(`transparent pixels: ${pct.toFixed(1)}%`);

  if (pct >= 5) {
    log('alpha is real — nothing to key out');
    return false;
  }
  log('*** alpha is FAKE — the checkerboard is painted in. keying out. ***');

  /**
   * LEARN the two checker shades from the border. Do not hardcode them.
   *
   * The first version of this had the bench image's checks baked in (205 and 254,
   * with a floor of r > 180). The logo's checkerboard is 125 and 192 — the dark
   * square was below the floor, so nothing was recognised and nothing was erased.
   * The generator does not use one fixed checkerboard, so the keyer cannot assume
   * one.
   *
   * The border of a keyed image is, by definition, all checkerboard. So: take the
   * neutral pixels around the edge, and the two brightness clusters there ARE the
   * two squares.
   */
  /**
   * How far the channels may differ and still count as "grey".
   *
   * 30, not 14. The generator's output carries a faint WARM CAST, so its
   * checkerboard is not truly neutral — the anti-aliased pixels along every check
   * edge come out as rgb(160,160,144), rgb(160,144,144) and so on, differing by
   * 16-32. At a tolerance of 14 they failed the test, were never classified, and
   * survived as a halo (and as a watermark that stretched the crop box).
   *
   * Loose is safe here: the subjects are BLUE, ORANGE, RED — channels 150+ apart.
   * Nothing that is actually coloured comes close to 30.
   */
  const GREY_TOL = 30;
  const isGrey = (/** @type {number} */ r, /** @type {number} */ g, /** @type {number} */ b) =>
    Math.abs(r - g) < GREY_TOL && Math.abs(g - b) < GREY_TOL && Math.abs(r - b) < GREY_TOL;

  const border = [];
  const ring = (/** @type {number} */ x, /** @type {number} */ y) => {
    const i = (y * W + x) * 4;
    if (isGrey(data[i], data[i + 1], data[i + 2])) border.push(data[i]);
  };
  for (let x = 0; x < W; x++) { ring(x, 0); ring(x, H - 1); }
  for (let y = 0; y < H; y++) { ring(0, y); ring(W - 1, y); }

  if (border.length < 32) {
    log('could not read a checkerboard on the border — leaving the image alone');
    return false;
  }

  // Two clusters: split at the midpoint of the range, then take each side's mean.
  const lo = Math.min(...border);
  const hi = Math.max(...border);
  const mid = (lo + hi) / 2;
  const dark = border.filter((v) => v <= mid);
  const light = border.filter((v) => v > mid);

  const DARK = dark.length ? dark.reduce((a, b) => a + b, 0) / dark.length : lo;
  const LIGHT = light.length ? light.reduce((a, b) => a + b, 0) / light.length : hi;
  const TOL = Math.max(14, (LIGHT - DARK) * 0.35);

  log(`learned checker shades: ${Math.round(DARK)} and ${Math.round(LIGHT)} (tolerance ±${Math.round(TOL)})`);

  if (LIGHT - DARK < 10) {
    log('the two shades are indistinguishable — refusing to key, it would eat the subject');
    return false;
  }

  /**
   * 0 = not checker, 1 = darker square, 2 = lighter square.
   *
   * The band is CONTINUOUS from DARK-TOL to LIGHT+TOL, not two separate windows.
   * Two windows leave a gap in the middle — and the renderer anti-aliases the two
   * squares into each other, so the pixels along every checker edge land exactly
   * in that gap, are classified as neither, and survive as a pale halo around the
   * subject.
   *
   * The midpoint is then only used to tell the two shades APART, which is what the
   * both-shades test needs.
   */
  const MIDPOINT = (DARK + LIGHT) / 2;
  const FLOOR = DARK - TOL;

  // NO upper bound. The generator also stamps a near-WHITE sparkle watermark
  // (~240), which sits above any ceiling derived from the checker shades — so a
  // ceiling leaves the watermark behind as a ghost in the corner. Everything
  // neutral and light enough is a candidate; connectivity and the both-shades
  // test are what protect the subject's own highlights.
  const shade = (/** @type {number} */ i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (!isGrey(r, g, b) || r < FLOOR) return 0;
    return r >= MIDPOINT ? 2 : 1;
  };

  const seen = new Uint8Array(W * H);
  let erased = 0;

  // Label every connected region of neutral-light pixels, then erase a region
  // only if it holds BOTH checker shades, or reaches the image edge.
  for (let p0 = 0; p0 < W * H; p0++) {
    if (seen[p0] || shade(p0 * 4) === 0) continue;

    /** @type {number[]} */
    const region = [];
    const stack = [p0];
    seen[p0] = 1;
    let hasDark = false;
    let hasLight = false;
    let touchesEdge = false;

    while (stack.length) {
      const p = /** @type {number} */ (stack.pop());
      const x = p % W;
      const y = (p / W) | 0;

      const s = shade(p * 4);
      if (s === 1) hasDark = true;
      else if (s === 2) hasLight = true;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) touchesEdge = true;
      region.push(p);

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const np = ny * W + nx;
        if (seen[np] || shade(np * 4) === 0) continue;
        seen[np] = 1;
        stack.push(np);
      }
    }

    if ((hasDark && hasLight) || touchesEdge) {
      for (const p of region) data[p * 4 + 3] = 0;
      erased += region.length;
    } else {
      log(`kept a ${region.length}px light region (subject detail, not checker)`);
    }
  }

  // Erode the anti-aliased fringe: only pixels that are BOTH washed-out AND
  // already touching transparency, so interior detail survives.
  for (let pass = 0; pass < 3; pass++) {
    /** @type {number[]} */
    const kill = [];

    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const p = y * W + x;
        const i = p * 4;
        if (data[i + 3] === 0) continue;

        const r = data[i], g = data[i + 1], b = data[i + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (!(max > 170 && max - min < 60)) continue; // pale + low-saturation

        const nextToHole =
          data[(p - 1) * 4 + 3] === 0 || data[(p + 1) * 4 + 3] === 0 ||
          data[(p - W) * 4 + 3] === 0 || data[(p + W) * 4 + 3] === 0;

        if (nextToHole) kill.push(i);
      }
    }

    if (!kill.length) break;
    for (const i of kill) data[i + 3] = 0;
    erased += kill.length;
    log(`fringe pass ${pass + 1}: eroded ${kill.length}px`);
  }

  cx.putImageData(img, 0, 0);
  log(`erased ${((erased / (W * H)) * 100).toFixed(1)}% as background`);
  return true;
}

/**
 * Erase the generator's sparkle watermark by INPAINTING it.
 *
 * Cloning a patch from elsewhere does not work here: the watermark sits on a
 * narrow diagonal strip of red bench, and there is no clean patch of bench big
 * enough to copy from — copy from above and you paste grass into the bench.
 *
 * Instead: mask the sparkle's own pixels (it is a pale, desaturated overlay on a
 * saturated red background, so it is easy to tell apart), then grow the
 * surrounding pixels inward over the mask, one ring at a time. Colours are COPIED
 * from real neighbours rather than averaged, so no new colours are invented and
 * the pixel art stays pixel art.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{x: number, y: number, w: number, h: number}} box  where to look
 * @param {(msg: string) => void} [log]
 */
export function inpaintSparkle(canvas, box, log = () => {}) {
  const W = canvas.width;
  const cx = canvas.getContext('2d', { willReadFrequently: true });
  if (!cx) throw new Error('no 2d context');

  const img = cx.getImageData(0, 0, canvas.width, canvas.height);
  const data = img.data;

  // The sparkle is PALE and DESATURATED. The bench beneath it is a saturated red
  // (green and blue channels are low). That gap is the whole detector.
  const isSparkle = (/** @type {number} */ i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return r > 170 && Math.min(g, b) > 105;
  };

  /** @type {Set<number>} */
  const masked = new Set();
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      const p = y * W + x;
      if (isSparkle(p * 4)) masked.add(p);
    }
  }

  log(`sparkle: masked ${masked.size}px inside ${box.w}x${box.h} at (${box.x},${box.y})`);
  if (!masked.size) return;

  // Grow inward from the boundary. Each pass fills only the masked pixels that
  // already touch a known one, so the fill follows the bench's stripes in from
  // the edges rather than smearing a single colour across the hole.
  let pass = 0;
  while (masked.size && pass < 60) {
    /** @type {[number, number][]} */
    const filled = [];

    for (const p of masked) {
      const neighbours = [p - 1, p + 1, p - W, p + W].filter((n) => !masked.has(n));
      if (!neighbours.length) continue;
      // Copy, never average: averaging invents colours that are not in the palette.
      filled.push([p, neighbours[0]]);
    }

    if (!filled.length) break;

    for (const [p, src] of filled) {
      const d = p * 4;
      const s = src * 4;
      data[d] = data[s];
      data[d + 1] = data[s + 1];
      data[d + 2] = data[s + 2];
      data[d + 3] = 255;
      masked.delete(p);
    }
    pass++;
  }

  cx.putImageData(img, 0, 0);
  log(`sparkle: inpainted in ${pass} passes, ${masked.size}px left`);
}

/**
 * Opaque content box of a canvas.
 * @param {HTMLCanvasElement} canvas
 */
export function contentBounds(canvas) {
  const cx = canvas.getContext('2d', { willReadFrequently: true });
  if (!cx) throw new Error('no 2d context');
  const { data } = cx.getImageData(0, 0, canvas.width, canvas.height);

  let top = Infinity, bottom = -1, left = Infinity, right = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] > 8) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  return { left, top, w: right - left + 1, h: bottom - top + 1 };
}
