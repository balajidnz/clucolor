// @ts-check
import { safeRender } from '../../share/render.js';
import { createHints } from '../hints.js';
import { DIALOGUE } from '../../../data/dialogue.js';
import { CARVING, CHART, LETTERS, normalize } from '../../../data/morse.js';

/**
 * Act 3 — what is carved into the bench.
 *
 * Two things make this work, and both are cheap:
 *
 * 1. **The companion must produce the A-Z chart.** Nobody should have to leave
 *    the game and search the web to finish a birthday present. It arrives at hint
 *    level 1, always, and it can be asked for immediately.
 *
 * 2. **The letters light up ON THE CARVING as she types.** Wired to `input`, not
 *    to a submit button. Ten lines, and it is the difference between a puzzle and
 *    a moment: she types "I", and two scratches on a bench light up.
 *
 * There is no submit button. When the last letter lands, it is simply done.
 */

/**
 * The clock may give her the chart and every word of help, but it will NOT
 * decode it for her.
 *
 * Once she has the chart, morse is MECHANICAL — she is actively working through
 * it, exactly like the sliding puzzle, and finishing it for her mid-decode takes
 * the thing out of her hands. (The riddle is different: without the word, no
 * amount of effort gets you there, so a timed rescue is a real rescue.)
 *
 * Level 4 — "I love you. That's what it says." — is ASK-ONLY.
 */
const CLOCK_CEILING = 3;

/**
 * @param {HTMLElement} root
 * @param {object} deps
 * @param {(fn: (dt: number) => void) => () => void} deps.onTick
 * @param {() => boolean} deps.isPaused
 * @param {string} deps.companionName
 * @returns {Promise<void>} resolves when she has read it
 */
export function showMorse(root, { onTick, isPaused, companionName }) {
  return new Promise((resolve) => {
    const panel = document.createElement('div');
    panel.className = 'panel panel-morse';

    const title = document.createElement('p');
    title.className = 'panel-ask';
    title.textContent = 'scratched into the wood';

    // --- the carving ---------------------------------------------------------

    const carving = document.createElement('div');
    carving.className = 'morse-carving';

    /** One element per letter, in reading order — so index i is LETTERS[i]. */
    /** @type {HTMLElement[]} */
    const marks = [];

    CARVING.forEach((word, w) => {
      if (w > 0) {
        const gap = document.createElement('span');
        gap.className = 'morse-gap';
        gap.textContent = '/';
        carving.append(gap);
      }

      const wordEl = document.createElement('span');
      wordEl.className = 'morse-word';

      for (const { code } of word) {
        const mark = document.createElement('span');
        mark.className = 'morse-mark';
        mark.textContent = code;
        wordEl.append(mark);
        marks.push(mark);
      }

      carving.append(wordEl);
    });

    // --- what she types ------------------------------------------------------

    const input = document.createElement('input');
    input.className = 'riddle-input morse-input';
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = 'what does it say?';

    const chart = document.createElement('div');
    chart.className = 'morse-chart';
    chart.hidden = true;

    for (const { letter, code } of CHART) {
      const row = document.createElement('span');
      row.className = 'morse-chart-row';

      const l = document.createElement('b');
      l.textContent = letter;

      const c = document.createElement('i');
      c.textContent = code;

      row.append(l, c);
      chart.append(row);
    }

    const companion = document.createElement('p');
    companion.className = 'riddle-companion';
    companion.hidden = true;

    const ask = document.createElement('button');
    ask.className = 'riddle-ask';
    ask.textContent = `ask ${companionName}`;

    let finished = false;
    let flagged = false; // a full-length wrong answer already counted

    const hintCtl = createHints({
      lines: DIALOGUE.bench.puzzle.hints,
      isPaused,
      clockCeiling: CLOCK_CEILING,

      onHint: (line, level) => {
        companion.hidden = false;
        safeRender(companion, `${companionName}: ${line.text}`);
        companion.classList.remove('is-new');
        void companion.offsetWidth;
        companion.classList.add('is-new');
        ask.textContent = `ask ${companionName} again`;

        // The chart. Non-negotiable — without it this is a wall, and she would
        // have to leave the game to get past it.
        if (line.shows === 'morse-chart' || level >= 1) chart.hidden = false;
      },

      onAutoSolve: () => {
        ask.disabled = true;
        input.disabled = true;
        // Let her SEE it resolve, rather than just cutting to the next scene.
        revealTo(LETTERS.length);
        setTimeout(() => finish(), 2000);
      },
    });

    const unsubscribe = onTick((dt) => hintCtl.update(dt));

    /** Light the first `n` letters of the carving. @param {number} n */
    function revealTo(n) {
      marks.forEach((mark, i) => mark.classList.toggle('is-lit', i < n));
    }

    function onType() {
      if (finished) return;

      const typed = normalize(input.value);

      // How much of it she has right, from the start. This is the whole feedback
      // loop: the carving lights up under her as she reads it.
      let correct = 0;
      while (correct < typed.length && typed[correct] === LETTERS[correct]) correct++;

      revealTo(correct);

      const wrong = correct < typed.length;
      input.classList.toggle('is-wrong', wrong);

      if (typed === LETTERS) {
        solve();
        return;
      }

      // Only count a mistake once she has actually committed to a full-length
      // wrong answer — not on every keystroke on the way there.
      if (typed.length >= LETTERS.length && wrong && !flagged) {
        flagged = true;
        hintCtl.wrong();
      }
      if (typed.length < LETTERS.length) flagged = false;
    }

    function solve() {
      if (finished) return;
      input.disabled = true;
      ask.disabled = true;
      panel.classList.add('is-solved');
      revealTo(LETTERS.length);
      setTimeout(() => finish(), 1800);
    }

    function finish() {
      if (finished) return;
      finished = true;
      hintCtl.stop();
      unsubscribe();
      document.removeEventListener('keydown', onKey);
      panel.remove();
      resolve();
    }

    /** @param {KeyboardEvent} e */
    const onKey = (e) => {
      if (finished) return;
      if (e.code === 'KeyH' && document.activeElement !== input) {
        e.preventDefault();
        hintCtl.ask();
      }
    };

    input.addEventListener('input', onType);
    ask.addEventListener('click', () => hintCtl.ask());
    document.addEventListener('keydown', onKey);

    panel.append(title, carving, input, chart, companion, ask);
    root.append(panel);
    input.focus();
  });
}
