// @ts-check

/**
 * The 8-puzzle: a 3x3 sliding grid with one square missing.
 *
 * 3x3, NOT 4x4. A 15-puzzle is a five-minute slog that would wreck the pacing of
 * a seven-minute game.
 *
 * Two things here look like over-engineering and are not:
 *
 * 1. **Shuffling by random LEGAL MOVES, never a random permutation.** Exactly half
 *    of all 9! arrangements of an 8-puzzle are UNSOLVABLE. Shuffle by shuffling
 *    the array and there is a 50% chance you hand the player a puzzle that cannot
 *    be finished, and no amount of hinting will save them.
 *
 * 2. **Breadth-first search over the ENTIRE state space, once.** There are only
 *    181,440 reachable states, so we can walk backwards from the solved picture
 *    and record the exact distance of every state from the goal. That single table
 *    gives us a PERFECT hint ("move this tile, now") and a PERFECT auto-solve
 *    (walk downhill) — both optimal, both for free. It is the best value-per-line
 *    in the project.
 */

/** The blank. Tile ids 0..7 are picture pieces; 8 is the hole. */
export const BLANK = 8;

/** The solved picture: every piece in its own place. */
export const GOAL = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8]);

const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880];

/**
 * Lehmer code: map a permutation of 0..8 to a unique integer in [0, 362880).
 * Lets us index the depth table with a plain typed array instead of a Map.
 *
 * @param {ArrayLike<number>} p
 * @returns {number}
 */
export function rank(p) {
  let r = 0;
  for (let i = 0; i < 9; i++) {
    let smaller = 0;
    for (let j = i + 1; j < 9; j++) if (p[j] < p[i]) smaller++;
    r += smaller * FACT[8 - i];
  }
  return r;
}

/**
 * The positions a tile can slide FROM, for each position of the blank.
 * Precomputed: it is the innermost thing in the search.
 */
const NEIGHBOURS = Array.from({ length: 9 }, (_, b) => {
  const row = (b / 3) | 0;
  const col = b % 3;
  /** @type {number[]} */
  const out = [];
  if (row > 0) out.push(b - 3);
  if (row < 2) out.push(b + 3);
  if (col > 0) out.push(b - 1);
  if (col < 2) out.push(b + 1);
  return out;
});

/** @type {Uint8Array | null} */
let depth = null;

/**
 * Distance-to-goal for every reachable state, computed once by walking BFS
 * backwards from the solved picture.
 *
 * 255 = unreachable (the other half of the permutations — the unsolvable ones).
 */
export function buildSolver() {
  if (depth) return depth;

  const t0 = performance.now();

  depth = new Uint8Array(FACT[9]).fill(255);
  const start = GOAL.slice();
  depth[rank(start)] = 0;

  // A flat queue of states: 9 bytes each, no allocation per node.
  const queue = new Uint8Array(181440 * 9);
  queue.set(start, 0);
  let head = 0;
  let tail = 1;

  const cur = new Uint8Array(9);

  while (head < tail) {
    for (let i = 0; i < 9; i++) cur[i] = queue[head * 9 + i];
    head++;

    const d = depth[rank(cur)];
    const blank = cur.indexOf(BLANK);

    for (const from of NEIGHBOURS[blank]) {
      // Slide the tile at `from` into the blank.
      cur[blank] = cur[from];
      cur[from] = BLANK;

      const r = rank(cur);
      if (depth[r] === 255) {
        depth[r] = d + 1;
        queue.set(cur, tail * 9);
        tail++;
      }

      // Undo — we are reusing one buffer rather than allocating a state per edge.
      cur[from] = cur[blank];
      cur[blank] = BLANK;
    }
  }

  console.info(`[eight] solved ${tail} states in ${Math.round(performance.now() - t0)}ms`);
  return depth;
}

/**
 * Distance from `state` to the solved picture. Optimal.
 * @param {ArrayLike<number>} state
 */
export function distanceToGoal(state) {
  return buildSolver()[rank(state)];
}

/**
 * The position of the tile that should move next — the one move that takes this
 * state strictly closer to the goal. Optimal, because the table is exact.
 *
 * @param {number[]} state
 * @returns {number | null} board position to click, or null if already solved
 */
export function bestMove(state) {
  const table = buildSolver();
  const here = table[rank(state)];
  if (here === 0) return null;

  const blank = state.indexOf(BLANK);
  const work = state.slice();

  for (const from of NEIGHBOURS[blank]) {
    work[blank] = work[from];
    work[from] = BLANK;

    if (table[rank(work)] === here - 1) return from;

    work[from] = work[blank];
    work[blank] = BLANK;
  }

  return null; // unreachable: the table is exact, so some neighbour is always closer
}

/**
 * Slide the tile at `pos` into the blank, if they are adjacent.
 *
 * @param {number[]} state
 * @param {number} pos
 * @returns {number[] | null} the new state, or null if that tile cannot move
 */
export function move(state, pos) {
  const blank = state.indexOf(BLANK);
  if (!NEIGHBOURS[blank].includes(pos)) return null;

  const next = state.slice();
  next[blank] = next[pos];
  next[pos] = BLANK;
  return next;
}

/** @param {number[]} state */
export const isSolved = (state) => state.every((v, i) => v === i);

/**
 * Shuffle by walking AWAY from the goal with legal moves.
 *
 * Never `array.sort(() => Math.random() - 0.5)`. Half of all permutations of the
 * 8-puzzle are unsolvable, and handing the player an unsolvable board is a bug
 * they can neither see nor recover from.
 *
 * @param {number} minDistance how far from solved the result must be
 * @returns {number[]}
 */
export function shuffle(minDistance = 12) {
  const table = buildSolver();

  for (let attempt = 0; attempt < 50; attempt++) {
    let state = GOAL.slice();
    let last = -1;

    for (let i = 0; i < 40; i++) {
      const blank = state.indexOf(BLANK);
      // Don't immediately undo the previous move — it wastes shuffle steps.
      const options = NEIGHBOURS[blank].filter((p) => p !== last);
      const pick = options[Math.floor(Math.random() * options.length)];

      last = blank;
      state = /** @type {number[]} */ (move(state, pick));
    }

    if (table[rank(state)] >= minDistance) return state;
  }

  // Vanishingly unlikely, but never return something trivially solved.
  return [1, 2, 5, 3, 4, 8, 6, 7, 0];
}
