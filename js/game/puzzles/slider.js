// @ts-check
import { safeRender } from '../../share/render.js';
import { createHints } from '../hints.js';
import { DIALOGUE } from '../../../data/dialogue.js';
import { BLANK, bestMove, move, isSolved, shuffle, buildSolver } from './eight.js';

/**
 * Act 2 — the photograph that came apart.
 *
 * Rendered as DOM, not canvas: hit-testing, the slide animation and hover
 * feedback all come free, and a canvas version would be half a day of tween and
 * hit-test maths for no visual gain.
 *
 * Each piece keeps its OWN slice of the picture as a background, and its place on
 * the board is a `transform`. Sliding is therefore just changing a transform, and
 * CSS animates it.
 */

const PHOTO = 'assets/img/props/photo.png';

/** Native pixel size of one piece. The photo is 144 = 3 x 48. */
const PIECE = 48;

/** Integer upscale — 2x keeps the pixels square. Board is 3 x 96 = 288px. */
const ZOOM = 2;

const CELL = PIECE * ZOOM;
const BOARD = CELL * 3;

/** Seconds per move when the companion solves it for you. */
const AUTO_STEP = 320;

/** Kick the search off early, so it is never built during a click. */
export const prewarm = () => buildSolver();

/**
 * @param {HTMLElement} root
 * @param {object} deps
 * @param {(fn: (dt: number) => void) => () => void} deps.onTick
 * @param {() => boolean} deps.isPaused
 * @param {string} deps.companionName
 * @returns {Promise<void>} resolves when the picture is whole again
 */
export function showSlider(root, { onTick, isPaused, companionName }) {
  return new Promise((resolve) => {
    const panel = document.createElement('div');
    panel.className = 'panel panel-slider';

    const title = document.createElement('p');
    title.className = 'panel-ask';
    title.textContent = 'put it back';

    const board = document.createElement('div');
    board.className = 'slider-board';
    board.style.width = `${BOARD}px`;
    board.style.height = `${BOARD}px`;

    const companion = document.createElement('p');
    companion.className = 'riddle-companion';
    companion.hidden = true;

    const ask = document.createElement('button');
    ask.className = 'riddle-ask';
    ask.textContent = `ask ${companionName}`;

    let state = shuffle();
    let finished = false;
    let frozen = false; // true while the companion is solving it

    /** One div per picture piece, indexed by TILE id (not board position). */
    const pieces = Array.from({ length: 9 }, (_, tile) => {
      const el = document.createElement('button');
      el.className = 'slider-piece';
      el.style.width = `${CELL}px`;
      el.style.height = `${CELL}px`;
      el.style.backgroundImage = `url(${PHOTO})`;
      el.style.backgroundSize = `${BOARD}px ${BOARD}px`;
      el.style.backgroundPosition =
        `${-(tile % 3) * CELL}px ${-Math.floor(tile / 3) * CELL}px`;

      // The blank. It exists — it is the missing piece, the two of them — but it
      // is hidden until the picture is whole.
      if (tile === BLANK) el.classList.add('is-blank');

      el.addEventListener('click', () => tryMove(pos(tile)));
      board.append(el);
      return el;
    });

    /** Where a given tile currently sits on the board. */
    const pos = (/** @type {number} */ tile) => state.indexOf(tile);

    function layout() {
      for (let tile = 0; tile < 9; tile++) {
        const p = pos(tile);
        const x = (p % 3) * CELL;
        const y = Math.floor(p / 3) * CELL;
        pieces[tile].style.transform = `translate(${x}px, ${y}px)`;
      }
    }

    /** Highlight the piece the companion is pointing at. */
    function pointAt(/** @type {number | null} */ boardPos) {
      for (const el of pieces) el.classList.remove('is-hinted');
      if (boardPos === null) return;
      const tile = state[boardPos];
      pieces[tile]?.classList.add('is-hinted');
    }

    const hintCtl = createHints({
      lines: DIALOGUE.house.puzzle.hints,
      isPaused,

      /**
       * The clock may only ever TALK. Levels 0-1 are words; 2 and 3 POINT at the
       * exact piece, and 4 does it for her.
       *
       * Being SHOWN the answer is being GIVEN the answer — a highlighted piece
       * ends the puzzle just as surely as sliding it would. She is actively making
       * progress here; the game must not reach in and take it. So pointing and
       * solving are ASK-ONLY.
       */
      clockCeiling: 1,

      onHint: (line, level) => {
        companion.hidden = false;
        safeRender(companion, `${companionName}: ${line.text}`);
        companion.classList.remove('is-new');
        void companion.offsetWidth;
        companion.classList.add('is-new');
        ask.textContent = `ask ${companionName} again`;

        // Level 2 stops being talk and starts being help: she points at the exact
        // piece to move. The search makes that answer optimal, always.
        if (level >= 2) pointAt(bestMove(state));
      },
      onAutoSolve: () => {
        frozen = true;
        ask.disabled = true;
        pointAt(null);
        autoSolve();
      },
    });

    const unsubscribe = onTick((dt) => hintCtl.update(dt));

    /** She works it out, one optimal move at a time. Not a skip — a rescue. */
    function autoSolve() {
      const step = () => {
        if (finished) return;

        const next = bestMove(state);
        if (next === null) { win(); return; }

        state = /** @type {number[]} */ (move(state, next));
        layout();
        setTimeout(step, AUTO_STEP);
      };
      setTimeout(step, 500);
    }

    function tryMove(/** @type {number} */ boardPos) {
      if (finished || frozen) return;

      const next = move(state, boardPos);
      if (!next) return; // not adjacent to the hole; nothing to do

      state = next;
      layout();
      pointAt(null);

      if (isSolved(state)) { win(); return; }

      // If she is already being pointed at a piece, keep pointing at the RIGHT
      // one — the optimal move changes with every slide.
      if (hintCtl.level >= 2 && !hintCtl.done) pointAt(bestMove(state));
    }

    function win() {
      if (finished) return;
      finished = true;
      hintCtl.stop();
      unsubscribe();
      pointAt(null);

      // The missing piece fills in. That is the beat: the part of the picture
      // that was gone is the two of them, together.
      panel.classList.add('is-solved');
      pieces[BLANK].classList.remove('is-blank');

      setTimeout(() => {
        panel.remove();
        resolve();
      }, 2200);
    }

    ask.addEventListener('click', () => hintCtl.ask());

    /** @param {KeyboardEvent} e */
    const onKey = (e) => {
      if (finished) return;
      if (e.code === 'KeyH') {
        e.preventDefault();
        hintCtl.ask();
      }
    };
    document.addEventListener('keydown', onKey);

    const cleanup = () => document.removeEventListener('keydown', onKey);
    const originalResolve = resolve;
    resolve = (/** @type {any} */ v) => { cleanup(); originalResolve(v); };

    layout();
    panel.append(title, board, companion, ask);
    root.append(panel);
  });
}
