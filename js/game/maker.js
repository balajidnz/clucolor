// @ts-check
import { buildLink, MAX_MESSAGE, MAX_NAME } from '../share/encode.js';
import { safeRender } from '../share/render.js';
import { NAMES } from '../../data/dialogue.js';

/**
 * "Now write your own."
 *
 * The half of the product that makes this a thing people pass on rather than a
 * thing one person plays. Everything is client-side: the message is base64url'd
 * into the URL fragment, which is never sent to a server — so the love letters
 * never touch GitHub's logs.
 */

/**
 * Count CODE POINTS, not UTF-16 units. '💖'.length is 2, but it is one
 * character to the person typing it, and the encoder caps by code point too —
 * so counting any other way would let the counter and the encoder disagree.
 *
 * @param {string} s
 */
const count = (s) => [...s].length;

/** @param {string} s */
const clampToCap = (s) => [...s].slice(0, MAX_MESSAGE).join('');

/**
 * @param {HTMLElement} root
 */
export function showMaker(root) {
  const panel = document.createElement('div');
  panel.className = 'panel panel-maker';

  const title = document.createElement('p');
  title.className = 'panel-ask';
  title.textContent = 'now write your own';

  const blurb = document.createElement('p');
  blurb.className = 'panel-sub';
  blurb.textContent = 'they play the same game — and find your words at the end.';

  const box = document.createElement('textarea');
  box.className = 'maker-text';
  box.rows = 4;
  box.placeholder = 'say the thing you would say';

  const counter = document.createElement('p');
  counter.className = 'maker-count';

  /**
   * The optional fields are HIDDEN until asked for.
   *
   * Four text boxes on screen at once makes the optional stuff compete with the
   * only thing that matters — the message. Almost nobody will rename the
   * characters; everybody will write the message. So the message gets the screen,
   * and the rest is one quiet link away.
   */
  const more = document.createElement('button');
  more.className = 'maker-more';
  more.textContent = 'name them · sign it';

  const extras = document.createElement('div');
  extras.className = 'maker-extras';
  extras.hidden = true;

  const nameRow = document.createElement('div');
  nameRow.className = 'maker-names';

  const boy = document.createElement('input');
  boy.className = 'maker-name';
  boy.type = 'text';
  boy.maxLength = MAX_NAME;
  boy.placeholder = NAMES.boy;

  const girl = document.createElement('input');
  girl.className = 'maker-name';
  girl.type = 'text';
  girl.maxLength = MAX_NAME;
  girl.placeholder = NAMES.girl;

  nameRow.append(boy, girl);

  const from = document.createElement('input');
  from.className = 'maker-from';
  from.type = 'text';
  from.maxLength = MAX_NAME;
  from.placeholder = 'from (optional)';

  extras.append(nameRow, from);

  more.addEventListener('click', () => {
    extras.hidden = false;
    more.hidden = true;
    boy.focus();
  });

  const make = document.createElement('button');
  make.className = 'panel-btn';
  make.textContent = 'make my link';
  make.disabled = true;

  const result = document.createElement('div');
  result.className = 'maker-result';
  result.hidden = true;

  const link = document.createElement('input');
  link.className = 'maker-link';
  link.readOnly = true;

  const row = document.createElement('div');
  row.className = 'panel-row';

  const copy = document.createElement('button');
  copy.className = 'panel-btn';
  copy.textContent = 'copy link';

  const share = document.createElement('button');
  share.className = 'panel-btn';
  share.textContent = 'share';

  // navigator.share only exists on devices that can actually do it — mostly
  // phones. Hiding it elsewhere avoids a button that does nothing.
  share.hidden = typeof navigator.share !== 'function';

  const note = document.createElement('p');
  note.className = 'maker-note';

  const update = () => {
    const n = count(box.value);
    if (n > MAX_MESSAGE) {
      box.value = clampToCap(box.value);
    }
    const used = count(box.value);
    safeRender(counter, `${used} / ${MAX_MESSAGE}`);
    counter.classList.toggle('is-full', used >= MAX_MESSAGE);
    make.disabled = used === 0;
  };

  box.addEventListener('input', update);
  update();

  make.addEventListener('click', async () => {
    make.disabled = true;
    const url = await buildLink(box.value, {
      from: from.value.trim(),
      boy: boy.value.trim(),
      girl: girl.value.trim(),
    });
    make.disabled = false;
    link.value = url;
    result.hidden = false;
    safeRender(note, `${url.length} characters — short enough for any chat app.`);
    link.focus();
    link.select();
  });

  copy.addEventListener('click', async () => {
    try {
      // Needs a secure context (https or localhost) AND a user gesture — which a
      // click is. This is why the site had to have HTTPS before anything else.
      await navigator.clipboard.writeText(link.value);
      copy.textContent = 'copied';
      setTimeout(() => { copy.textContent = 'copy link'; }, 1600);
    } catch {
      // Clipboard denied or unavailable: fall back to selecting it so they can
      // copy by hand. Never leave them with a dead button.
      link.focus();
      link.select();
      copy.textContent = 'press ⌘C';
      setTimeout(() => { copy.textContent = 'copy link'; }, 2400);
    }
  });

  share.addEventListener('click', async () => {
    try {
      await navigator.share({ title: 'CluColor', url: link.value });
    } catch {
      // The user dismissed the share sheet. Not an error.
    }
  });

  row.append(copy, share);
  result.append(link, row, note);
  panel.append(title, blurb, box, counter, more, extras, make, result);
  root.append(panel);

  box.focus();
}
