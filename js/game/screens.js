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
 * The loading screen.
 *
 * Without it, the page is BLANK BLACK while ~1.5MB of images and audio come down.
 * She opens a link and sees nothing — the worst first impression available, and on
 * a slow connection it lasts long enough for her to close the tab.
 *
 * @param {HTMLElement} root
 * @returns {{done: () => void}}
 */
export function showLoading(root) {
  const panel = document.createElement('div');
  panel.className = 'panel panel-loading';

  const dot = document.createElement('div');
  dot.className = 'loading-dot';

  const word = document.createElement('p');
  word.className = 'panel-sub';
  word.textContent = 'loading';

  panel.append(dot, word);
  root.append(panel);

  return {
    done() {
      panel.classList.add('is-done');
      setTimeout(() => panel.remove(), 420);
    },
  };
}

/**
 * The logo, and "press to start".
 *
 * This click is NOT decorative. Browsers refuse to start an AudioContext without a
 * user gesture, so the game needs one before the music can exist at all — and all
 * four layers must be started inside it, together, or they will never be in sync.
 * The title screen is where that gesture is collected.
 *
 * @param {HTMLElement} root
 * @returns {Promise<void>}
 */
export function showLogo(root) {
  return new Promise((resolve) => {
    const panel = document.createElement('div');
    panel.className = 'panel panel-logo';

    const logo = document.createElement('img');
    logo.className = 'logo';
    logo.src = 'assets/img/logo.png';
    logo.alt = 'CluColor';
    logo.width = 584;
    logo.height = 130;

    const press = document.createElement('button');
    press.className = 'press-start';
    press.textContent = 'press to start';

    const go = () => {
      document.removeEventListener('keydown', onKey);
      panel.remove();
      resolve();
    };

    /** @param {KeyboardEvent} e */
    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); go(); }
    };

    panel.addEventListener('click', go);
    document.addEventListener('keydown', onKey);

    panel.append(logo, press);
    root.append(panel);
  });
}

/**
 * Who are you?
 *
 * @param {HTMLElement} root
 * @param {{boy: string, girl: string}} names  from the link, or the defaults
 * @returns {Promise<boolean>} true if the player chose to be the boy
 */
export function showPicker(root, names) {
  return new Promise((resolve) => {
    const panel = document.createElement('div');
    panel.className = 'panel panel-title';

    const ask = document.createElement('p');
    ask.className = 'panel-ask';
    ask.textContent = 'who are you?';

    const row = document.createElement('div');
    row.className = 'panel-row';

    // The names may have been chosen by whoever sent the link, so they go through
    // safeRender like any other text off the URL.
    for (const [name, isBoy] of /** @type {[string, boolean][]} */ ([
      [names.boy, true],
      [names.girl, false],
    ])) {
      const btn = document.createElement('button');
      btn.className = 'panel-btn';
      safeRender(btn, name);
      btn.addEventListener('click', () => {
        panel.remove();
        resolve(isBoy);
      });
      row.append(btn);
    }

    panel.append(ask, row);
    root.append(panel);
  });
}

/**
 * A mute toggle that stays on screen for the whole game.
 *
 * The title click is a real user gesture, so the music may legitimately start —
 * but a stranger who has just opened a link should never feel trapped with sound
 * they did not ask for. It is always one click away, always in the same place.
 *
 * @param {HTMLElement} root
 * @param {{toggleMute: () => boolean}} audio
 */
export function mountMuteButton(root, audio) {
  const btn = document.createElement('button');
  btn.className = 'mute';
  btn.title = 'sound';
  btn.textContent = '♪';

  btn.addEventListener('click', () => {
    const muted = audio.toggleMute();
    btn.classList.toggle('is-muted', muted);
    btn.textContent = muted ? '✕' : '♪';
  });

  root.append(btn);
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
export async function showEnding(root) {
  const payload = await decode(location.hash);

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

  const row = document.createElement('div');
  row.className = 'panel-row ending-offer';

  const offer = document.createElement('button');
  offer.className = 'panel-btn';
  offer.textContent = 'send this to someone';
  offer.addEventListener('click', () => {
    panel.remove();
    showMaker(root);
  });

  // Play it again. Without this she has to reload the page by hand, which is a
  // silly thing to make someone do at the end of a gift.
  const again = document.createElement('button');
  again.className = 'panel-btn is-quiet';
  again.textContent = 'again';
  again.addEventListener('click', () => location.reload());

  row.append(offer, again);
  panel.append(row);

  root.append(panel);
}
