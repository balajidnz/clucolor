// @ts-check
/**
 * The 8-puzzle.
 *
 * Two bugs here would be invisible and unrecoverable:
 *   1. An UNSOLVABLE shuffle. Half of all 9! arrangements cannot be solved. Hand
 *      her one and she will slide tiles forever, and no hint can save her — the
 *      auto-solve would loop too.
 *   2. A WRONG hint. The companion pointing at the wrong piece is worse than no
 *      companion at all.
 */
import {
  GOAL, BLANK, rank, buildSolver, distanceToGoal,
  bestMove, move, isSolved, shuffle,
} from '../js/game/puzzles/eight.js';
import { createHints } from '../js/game/hints.js';
import { DIALOGUE } from '../data/dialogue.js';

const results = [];
const check = (name, ok, detail) =>
  results.push({ name, ok, ...(ok || detail === undefined ? {} : { detail: String(detail) }) });

// --- the search table ---------------------------------------------------------

const t0 = performance.now();
const table = buildSolver();
const buildMs = Math.round(performance.now() - t0);

check(`search built in ${buildMs}ms (budget: under 400ms, once, at load)`, buildMs < 400, buildMs);

const reachable = table.reduce((n, d) => n + (d !== 255 ? 1 : 0), 0);
check('exactly 181,440 states are reachable — half of 9!, as the maths says',
  reachable === 181440, reachable);

check('the solved picture is at distance 0', distanceToGoal(GOAL) === 0);

// The 8-puzzle's diameter is a known number. If this is wrong, the search is wrong.
const deepest = table.reduce((m, d) => (d !== 255 && d > m ? d : m), 0);
check('the hardest board is exactly 31 moves from solved (the known diameter)',
  deepest === 31, deepest);

// --- rank is a bijection ------------------------------------------------------

{
  const seen = new Set();
  const perms = [GOAL.slice(), [8, 7, 6, 5, 4, 3, 2, 1, 0], [1, 0, 2, 3, 4, 5, 6, 7, 8]];
  for (const p of perms) seen.add(rank(p));
  check('rank maps distinct permutations to distinct integers', seen.size === perms.length);
  check('rank of the goal is 0', rank(GOAL) === 0, rank(GOAL));
}

// --- shuffling: NEVER a random permutation -----------------------------------

{
  let worstUnsolvable = 0;
  let tooEasy = 0;
  let alreadySolved = 0;

  for (let i = 0; i < 300; i++) {
    const s = shuffle();
    if (distanceToGoal(s) === 255) worstUnsolvable++;
    if (distanceToGoal(s) < 12) tooEasy++;
    if (isSolved(s)) alreadySolved++;
  }

  check('300 shuffles: every single one is SOLVABLE', worstUnsolvable === 0, worstUnsolvable);
  check('300 shuffles: none is trivially close to solved', tooEasy === 0, tooEasy);
  check('300 shuffles: none starts already solved', alreadySolved === 0, alreadySolved);
}

{
  // Prove the danger is real: a naive shuffle produces unsolvable boards.
  let unsolvable = 0;
  for (let i = 0; i < 200; i++) {
    const p = GOAL.slice();
    for (let j = p.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [p[j], p[k]] = [p[k], p[j]];
    }
    if (distanceToGoal(p) === 255) unsolvable++;
  }
  check(`a NAIVE shuffle would be unsolvable ~half the time (${unsolvable}/200) — this is why we don't`,
    unsolvable > 60 && unsolvable < 140, unsolvable);
}

// --- moves --------------------------------------------------------------------

{
  const s = GOAL.slice(); // blank at 8 (bottom-right)
  check('a tile adjacent to the hole can move', move(s, 7) !== null);
  check('a tile adjacent to the hole can move (vertically)', move(s, 5) !== null);
  check('a tile NOT adjacent to the hole cannot move', move(s, 0) === null);
  check('the hole cannot move into itself', move(s, 8) === null);

  const after = /** @type {number[]} */ (move(s, 7));
  check('moving swaps the tile and the hole',
    after[7] === BLANK && after[8] === 7, after.join(''));
}

// --- the hint must be OPTIMAL, always ----------------------------------------

{
  let bad = 0;
  let noMove = 0;

  for (let i = 0; i < 400; i++) {
    const s = shuffle();
    const d = distanceToGoal(s);
    const pos = bestMove(s);

    if (pos === null) { noMove++; continue; }
    const next = move(s, pos);
    if (!next || distanceToGoal(next) !== d - 1) bad++;
  }

  check('400 boards: the hint ALWAYS moves strictly closer to solved', bad === 0, bad);
  check('400 boards: the hint always exists while unsolved', noMove === 0, noMove);
}

// --- the auto-solve must always terminate ------------------------------------
//
// This is the failsafe. If it can loop, she is stuck forever with no way out.

{
  let worstSteps = 0;
  let failed = 0;

  for (let i = 0; i < 200; i++) {
    let s = shuffle();
    let steps = 0;

    while (!isSolved(s) && steps < 100) {
      const pos = bestMove(s);
      if (pos === null) break;
      s = /** @type {number[]} */ (move(s, pos));
      steps++;
    }

    if (!isSolved(s)) failed++;
    if (steps > worstSteps) worstSteps = steps;
  }

  check('200 boards: the auto-solve ALWAYS reaches the solved picture', failed === 0, failed);
  check(`auto-solve never exceeds the 31-move diameter (worst seen: ${worstSteps})`,
    worstSteps <= 31, worstSteps);
}

// --- the clock must NOT finish this puzzle for her ---------------------------
//
// The riddle is know-it-or-you-don't, so a timed auto-solve there is a rescue.
// The slider is a task she is actively progressing on — solving it for her
// mid-move takes the thing out of her hands. The clock must escalate as far as
// "I'll point at the right piece" and stop.

/** Levels 0-1 are words. Level 2+ POINTS at the piece; level 4 does it for her. */
const TALK_ONLY = 1;

{
  const LINES = DIALOGUE.house.puzzle.hints;
  const run = (ctl, seconds, step = 0.5) => {
    for (let t = 0; t < seconds; t += step) ctl.update(step);
  };

  let autoSolved = false;
  const ctl = createHints({
    lines: LINES,
    isPaused: () => false,
    onHint: () => {},
    onAutoSolve: () => { autoSolved = true; },
    clockCeiling: TALK_ONLY,
  });

  run(ctl, 600); // ten minutes of sitting there

  check('the clock never SOLVES the sliding puzzle, however long she takes', !autoSolved);
  check('the clock never POINTS at a piece either — being shown it is being given it',
    ctl.level <= TALK_ONLY, ctl.level);
  check('the clock only ever TALKS', ctl.level === TALK_ONLY && !ctl.done, `${ctl.level}/${ctl.done}`);

  // But ASKING goes as far as she wants — because she chose it.
  ctl.ask();
  check('asking once gets her pointing at the piece', ctl.level === TALK_ONLY + 1, ctl.level);

  ctl.ask();
  ctl.ask();
  check('asking again and again hands it over entirely', autoSolved && ctl.done);
}

{
  // And the riddle keeps its timed rescue: being stuck on a riddle IS being stuck.
  let autoSolved = false;
  const ctl = createHints({
    lines: DIALOGUE.lion.riddle.hints,
    isPaused: () => false,
    onHint: () => {},
    onAutoSolve: () => { autoSolved = true; },
  });
  for (let t = 0; t < 130; t += 0.5) ctl.update(0.5);
  check('the RIDDLE still auto-solves on the clock — being stuck there is real',
    autoSolved);
}

// --- report -------------------------------------------------------------------

const list = document.getElementById('results');
for (const r of results) {
  const li = document.createElement('li');
  li.className = r.ok ? 'ok' : 'fail';
  const n = document.createElement('span');
  n.className = 'name';
  n.textContent = r.name;
  li.append(n);
  if (r.detail !== undefined) {
    const d = document.createElement('code');
    d.textContent = 'got: ' + r.detail;
    li.append(d);
  }
  list.append(li);
}

const failed = results.filter((r) => !r.ok);
const summary = document.getElementById('summary');
summary.textContent = failed.length ? `${failed.length} of ${results.length} FAILED` : `all ${results.length} passed`;
summary.className = 'sub ' + (failed.length ? 'fail' : 'ok');

await fetch('/__report', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ suite: 'slider', ua: navigator.userAgent, results }),
}).catch(() => {});
