// @ts-check
import { safeRender } from '../../share/render.js';
import { matches } from './answers.js';
import { createHints } from '../hints.js';
import { DIALOGUE } from '../../../data/dialogue.js';

/**
 * Act 1 — the lion's riddle.
 *
 * The lion never says "wrong". It says something in character. A red X tells the
 * player they failed; a line of the lion's disdain tells them to keep going, and
 * those feel completely different at 1am on a birthday.
 *
 * The companion sits under the input and speaks as the hints escalate — inside
 * the puzzle, not by interrupting it, so the player never loses the riddle from
 * the screen.
 */

const { prompt, answers, hints, wrong } = DIALOGUE.lion.riddle;

/**
 * @param {HTMLElement} root
 * @param {object} deps
 * @param {(dt: number) => void => void} [deps._]
 * @param {(fn: (dt: number) => void) => () => void} deps.onTick  subscribe to the game clock
 * @param {() => boolean} deps.isPaused
 * @param {string} deps.companionName
 * @returns {Promise<void>} resolves when solved (by the player, or by the companion)
 */
export function showRiddle(root, { onTick, isPaused, companionName }) {
  return new Promise((resolve) => {
    const panel = document.createElement('div');
    panel.className = 'panel panel-riddle';

    const who = document.createElement('p');
    who.className = 'riddle-who';
    who.textContent = 'THE LION';

    const text = document.createElement('p');
    text.className = 'riddle-prompt';
    safeRender(text, prompt); // pre-wrap in CSS keeps the line breaks

    const form = document.createElement('div');
    form.className = 'riddle-form';

    const input = document.createElement('input');
    input.className = 'riddle-input';
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = 'answer';

    const submit = document.createElement('button');
    submit.className = 'panel-btn';
    submit.textContent = 'answer';

    const reply = document.createElement('p');
    reply.className = 'riddle-reply';

    const companion = document.createElement('p');
    companion.className = 'riddle-companion';
    companion.hidden = true;

    const ask = document.createElement('button');
    ask.className = 'riddle-ask';
    ask.textContent = `ask ${companionName}`;

    let wrongIndex = 0;
    let finished = false;

    const hintCtl = createHints({
      lines: hints,
      isPaused,
      onHint: (line) => {
        companion.hidden = false;
        safeRender(companion, `${companionName}: ${line.text}`);
        // Re-trigger the entrance animation on every new hint, so a hint the
        // player is already looking at still registers as *new*.
        companion.classList.remove('is-new');
        void companion.offsetWidth;
        companion.classList.add('is-new');

        // The button must say something DIFFERENT once it has been used, or
        // there is nothing to tell the player it can be pressed again — and
        // there is more help behind it.
        ask.textContent = `ask ${companionName} again`;
      },
      onAutoSolve: () => {
        // The companion works it out. Not a skip button — the failsafe is the
        // theme. Give the line a beat to land before the world changes.
        ask.disabled = true;
        input.disabled = true;
        submit.disabled = true;
        setTimeout(() => finish(), 1800);
      },
    });

    const unsubscribe = onTick((dt) => hintCtl.update(dt));

    function finish() {
      if (finished) return;
      finished = true;
      hintCtl.stop();
      unsubscribe();
      document.removeEventListener('keydown', onKey);
      panel.remove();
      resolve();
    }

    function tryAnswer() {
      if (finished) return;

      if (matches(input.value, answers)) {
        input.disabled = true;
        submit.disabled = true;
        ask.disabled = true;
        panel.classList.add('is-solved');
        setTimeout(() => finish(), 700);
        return;
      }

      // Never a red X. The lion is contemptuous, not a form validator.
      safeRender(reply, wrong[wrongIndex % wrong.length].text);
      wrongIndex++;
      reply.classList.remove('is-new');
      void reply.offsetWidth;
      reply.classList.add('is-new');

      input.select();
      hintCtl.wrong();
    }

    /** @param {KeyboardEvent} e */
    const onKey = (e) => {
      if (finished) return;
      if (e.code === 'Enter') {
        e.preventDefault();
        tryAnswer();
      } else if (e.code === 'KeyH' && document.activeElement !== input) {
        e.preventDefault();
        hintCtl.ask();
      }
    };

    submit.addEventListener('click', tryAnswer);
    ask.addEventListener('click', () => hintCtl.ask());
    document.addEventListener('keydown', onKey);

    form.append(input, submit);
    panel.append(who, text, form, reply, companion, ask);
    root.append(panel);
    input.focus();
  });
}
