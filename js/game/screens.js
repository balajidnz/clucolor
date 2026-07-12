// @ts-check
import { safeRender } from '../share/render.js';
import { decode } from '../share/encode.js';
import { showMaker } from './maker.js';
import { DEFAULT_MESSAGE } from '../../data/dialogue.js';

/**
 * Full-screen DOM panels: title, placeholder puzzle, ending.
 *
 * All text goes through safeRender (textContent). The ending message is decoded
 * from the URL hash, i.e. it is attacker-controlled — it must never touch
 * innerHTML.
 */

/**
 * Title screen. Also the user gesture that will unlock audio later: browsers
 * refuse to start an AudioContext without one, so a "press to begin" screen is
 * mandatory rather than decorative.
 *
 * @param {HTMLElement} root
 * @returns {Promise<boolean>} true if the player chose to be the boy
 */
export function showTitle(root) {
  return new Promise((resolve) => {
    const panel = document.createElement('div');
    panel.className = 'panel panel-title';

    const h1 = document.createElement('h1');
    h1.textContent = 'CluColor';

    const tag = document.createElement('p');
    tag.className = 'panel-sub';
    tag.textContent = 'two people wake in a world with no colour';

    const ask = document.createElement('p');
    ask.className = 'panel-ask';
    ask.textContent = 'who are you?';

    const row = document.createElement('div');
    row.className = 'panel-row';

    for (const [who, isBoy] of /** @type {[string, boolean][]} */ ([['the boy', true], ['the girl', false]])) {
      const btn = document.createElement('button');
      btn.className = 'panel-btn';
      btn.textContent = who;
      btn.addEventListener('click', () => {
        panel.remove();
        resolve(isBoy);
      });
      row.append(btn);
    }

    panel.append(h1, tag, ask, row);
    root.append(panel);
  });
}

/**
 * PLACEHOLDER puzzle. Replaced by the real riddle / sliding tile / morse on
 * days 5-7. It exists so the whole game is playable end to end today.
 *
 * @param {HTMLElement} root
 * @param {string} id
 * @returns {Promise<void>}
 */
export function showPlaceholderPuzzle(root, id) {
  return new Promise((resolve) => {
    const panel = document.createElement('div');
    panel.className = 'panel panel-puzzle';

    const label = document.createElement('p');
    label.className = 'panel-sub';
    label.textContent = `[ placeholder — the ${id} puzzle goes here ]`;

    const btn = document.createElement('button');
    btn.className = 'panel-btn';
    btn.textContent = 'solve it';

    const finish = () => {
      document.removeEventListener('keydown', onKey);
      panel.remove();
      resolve();
    };

    /** @param {KeyboardEvent} e */
    const onKey = (e) => {
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        finish();
      }
    };

    btn.addEventListener('click', finish);
    document.addEventListener('keydown', onKey);

    panel.append(label, btn);
    root.append(panel);
    btn.focus();
  });
}

/**
 * The ending. Shows the custom message decoded from the URL hash, or the
 * default if there isn't one (or if the hash is malformed, or hostile).
 *
 * The message is the whole gift, so it gets the screen to itself. Only once it
 * has been sitting there a while does the "write your own" offer appear —
 * showing a call-to-action underneath someone's love letter would cheapen it.
 *
 * @param {HTMLElement} root
 */
export function showEnding(root) {
  const payload = decode(location.hash);

  const panel = document.createElement('div');
  panel.className = 'panel panel-ending';

  const msg = document.createElement('p');
  msg.className = 'ending-message';
  // textContent only, ALWAYS. This string came out of the URL, so it is
  // attacker-controlled. Line breaks come from `white-space: pre-wrap` in CSS —
  // NOT from replacing \n with <br> and assigning innerHTML, which is exactly
  // how people reopen the hole they just closed.
  safeRender(msg, payload?.msg ?? DEFAULT_MESSAGE);
  panel.append(msg);

  if (payload?.from) {
    const from = document.createElement('p');
    from.className = 'ending-from';
    safeRender(from, `— ${payload.from}`);
    panel.append(from);
  }

  const offer = document.createElement('button');
  offer.className = 'panel-btn ending-offer';
  offer.textContent = 'send this to someone';
  offer.addEventListener('click', () => {
    panel.remove();
    showMaker(root);
  });
  panel.append(offer);

  root.append(panel);
}
