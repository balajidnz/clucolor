// @ts-check

/**
 * The escalating-hint controller. One mechanism, all three puzzles.
 *
 * This is NOT a safety net bolted on the side. It is the game's PACING SYSTEM.
 * A riddle plus a sliding puzzle plus a morse decode, played honestly by a normal
 * person, is 12-18 minutes. The 120-second ceiling below is the only thing that
 * makes this a 7-minute game.
 *
 * It escalates on whichever comes first:
 *   1. time on the puzzle (the ceiling),
 *   2. N wrong answers,
 *   3. THE PLAYER ASKING.
 *
 * That third path matters as much as the other two. It runs through the same code,
 * but it turns a condescending system into an act of agency — you turn to the
 * person beside you and ask.
 *
 * Two rules that keep it from feeling bad:
 *   - The clock PAUSES while dialogue is open. Never punish someone for reading.
 *   - There is no "skip" button. The last level is the companion solving it WITH
 *     you, in character. The failsafe is the theme.
 */

/** Cumulative seconds at which each hint level fires. */
const SCHEDULE = [20, 45, 70, 95, 120];

/** Wrong answers at one level before it escalates on its own. */
const FAILS_PER_LEVEL = 2;

/**
 * @typedef {object} HintDeps
 * @property {import('./dialogue.js').Line[]} lines one per level; the LAST is the auto-solve
 * @property {(line: import('./dialogue.js').Line, level: number) => void} onHint
 * @property {() => void} onAutoSolve
 * @property {() => boolean} isPaused  true while dialogue is open
 * @property {number} [clockCeiling] the highest level the CLOCK may reach on its
 *   own. Asking always goes further. Defaults to the last level.
 */

/**
 * @param {HintDeps} deps
 */
export function createHints({ lines, onHint, onAutoSolve, isPaused, clockCeiling }) {
  let elapsed = 0;
  let level = -1;     // -1 = no hint given yet
  let fails = 0;
  let done = false;

  const last = lines.length - 1;

  /**
   * How far the CLOCK alone may push. ASKING can always go further.
   *
   * The riddle lets the clock go all the way. A riddle is know-it-or-you-don't,
   * so someone stuck at two minutes is genuinely stuck, and solving it for her is
   * a rescue.
   *
   * The sliding puzzle stops the clock at TALKING. She is actively making progress
   * on it, and anything that SHOWS her the answer — pointing at the piece, sliding
   * it for her — ends the puzzle just as surely as solving it would. Being shown
   * the answer is being given the answer. So on the clock the companion may only
   * ever talk; she may only point, and only take over, if she is ASKED.
   */
  const ceiling = Math.min(clockCeiling ?? last, last);

  /** Fire the next hint. The final one hands the puzzle to the companion. */
  function escalate() {
    if (done) return;

    level = Math.min(level + 1, last);
    fails = 0;
    onHint(lines[level], level);

    if (level >= last) {
      done = true;
      onAutoSolve();
    }
  }

  return {
    get level() { return level; },
    get done() { return done; },

    /** @param {number} dt seconds */
    update(dt) {
      if (done || isPaused()) return;

      elapsed += dt;

      // Cumulative, NOT idle-reset. An idle timer that resets on every keystroke
      // means someone who types slowly forever never reaches the ceiling — and
      // the ceiling is the entire point.
      const next = level + 1;
      if (next <= ceiling && elapsed >= SCHEDULE[next]) escalate();
    },

    /** A wrong answer. Enough of them and the companion speaks up unprompted. */
    wrong() {
      if (done) return;
      if (++fails >= FAILS_PER_LEVEL) escalate();
    },

    /** The player turned and asked. Same path, but it was their choice. */
    ask() {
      if (!done) escalate();
    },

    /** The player solved it themselves. Stop everything. */
    stop() {
      done = true;
    },
  };
}
