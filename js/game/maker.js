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
 *
 * ─── THE DESIGN, AND THE TWO WRONG TURNS BEFORE IT ───────────────────────────
 *
 * V1 was a textarea, a counter, and a button reading "name them · sign it".
 * A playtester: *"it wasn't clear that that part was the one changing"* and
 * *"clicking sign with name and signature isn't doing anything"*.
 *
 * V2 answered that by ADDING: a live preview, a caption, a label and a hint per
 * field, a counter, a disclosure button. It was correct and it was awful — a wall
 * of instructions in front of a love letter. Balaji: *"if I was a user looking at
 * all of it, I would just leave."* Right. The cure for "not enough feedback" is
 * never "more chrome".
 *
 * V3 — this one — deletes the distinction instead of explaining it:
 *
 *   **YOU TYPE INTO THE ENDING ITSELF.**
 *
 * The box is not a form field that *previews* the ending; it IS the ending, with
 * a caret in it. Same panel, same typography, same width, same line-breaking. So:
 *
 *   - no preview, because the input is the preview
 *   - no "what they will see" caption, because it obviously is
 *   - no field labels, because nothing needs naming
 *   - no disclosure button — the names are two inline blanks in a sentence, and
 *     an editable blank does not need a button to announce itself
 *
 * What's left on screen is a card, a sentence, and one button. Everything visible
 * is either the gift or the way to send it.
 */

/**
 * Count CODE POINTS, not UTF-16 units. '💖'.length is 2, but it is one character
 * to the person typing it, and the encoder caps by code point too — so counting
 * any other way would let the counter and the encoder disagree.
 *
 * @param {string} s
 */
const count = (s) => [...s].length;

/** @param {string} s */
const clampToCap = (s) => [...s].slice(0, MAX_MESSAGE).join('');

/** Only warn near the ceiling. A counter ticking from 0 is a word limit nagging you. */
const COUNTER_FROM = Math.floor(MAX_MESSAGE * 0.8);

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

  // --- the card: this is the ending, and you are typing into it ---------------
  //
  // Built from the REAL ending's classes (`panel-ending`, `ending-message`,
  // `ending-from` — see screens.js), so it cannot drift out of sync with the thing
  // it is. Not a lookalike: the same CSS.

  const card = document.createElement('div');
  card.className = 'panel panel-ending is-maker';

  const box = document.createElement('textarea');
  box.className = 'ending-message maker-input';
  box.rows = 1;
  box.placeholder = 'say the thing you would say';
  box.setAttribute('aria-label', 'your message');

  // The signature sits exactly where it will sit at the ending. Empty, it is a
  // faint invitation; filled, it is the thing itself. No label required.
  const sign = document.createElement('input');
  sign.className = 'ending-from maker-sign';
  sign.type = 'text';
  sign.maxLength = MAX_NAME;
  sign.placeholder = '— sign it';
  sign.setAttribute('aria-label', 'sign it with your name');

  card.append(box, sign);

  // --- the names: two blanks in a sentence ------------------------------------
  //
  // No disclosure button. V1 had one and it was BROKEN — `.maker-extras` set
  // `display: grid`, which outranks the UA stylesheet's `[hidden] { display: none }`,
  // so `.hidden = true` did nothing and the fields were on screen the whole time.
  // Clicking the button really did nothing, exactly as the tester said.
  //
  // A blank you can type in doesn't need a button to announce it. Deleting the
  // control deletes the bug class along with it.

  const who = document.createElement('p');
  who.className = 'maker-who';

  const boy = document.createElement('input');
  boy.className = 'maker-name';
  boy.type = 'text';
  boy.maxLength = MAX_NAME;
  boy.placeholder = NAMES.boy;
  boy.size = 6;
  boy.setAttribute('aria-label', 'name for the boy');

  const girl = document.createElement('input');
  girl.className = 'maker-name';
  girl.type = 'text';
  girl.maxLength = MAX_NAME;
  girl.placeholder = NAMES.girl;
  girl.size = 6;
  girl.setAttribute('aria-label', 'name for the girl');

  const lead = document.createElement('span');
  lead.textContent = 'they’re called ';
  const mid = document.createElement('span');
  mid.textContent = ' and ';

  who.append(lead, boy, mid, girl);

  // --- the rest ---------------------------------------------------------------

  const counter = document.createElement('p');
  counter.className = 'maker-count';
  counter.hidden = true;

  /**
   * ONE action, not two.
   *
   * It used to be "make my link" -> a link box appears -> "copy". Two steps for a
   * thing nobody wants to look at: the link is not the point, sending it is. Now
   * the button copies, and the link only surfaces afterwards, for anyone who wants
   * to see it or copy it by hand.
   */
  const row = document.createElement('div');
  row.className = 'panel-row';

  const copy = document.createElement('button');
  copy.className = 'panel-btn';
  copy.textContent = 'copy my link';
  copy.disabled = true;

  const share = document.createElement('button');
  share.className = 'panel-btn';
  share.textContent = 'share';
  share.disabled = true;

  // navigator.share only exists on devices that can actually do it — mostly
  // phones. Hiding it elsewhere avoids a button that does nothing.
  share.hidden = typeof navigator.share !== 'function';

  row.append(copy, share);

  const result = document.createElement('div');
  result.className = 'maker-result';
  result.hidden = true;

  const link = document.createElement('input');
  link.className = 'maker-link';
  link.readOnly = true;

  const note = document.createElement('p');
  note.className = 'maker-note';

  // --- behaviour ---------------------------------------------------------------

  /**
   * A textarea does not grow with its content, so a long message would scroll
   * inside a little box — and the whole promise here is that what you see is the
   * ending. It has to be as tall as the words are.
   */
  const grow = () => {
    box.style.height = 'auto';
    box.style.height = `${box.scrollHeight}px`;
  };

  const update = () => {
    if (count(box.value) > MAX_MESSAGE) box.value = clampToCap(box.value);
    grow();

    const used = count(box.value);
    const empty = used === 0;
    copy.disabled = empty;
    share.disabled = empty;

    // The count is ALWAYS correct; it is only SHOWN once it starts to matter.
    // (Keeping the text live rather than skipping the render keeps the counter and
    // the encoder in lockstep — they must agree on what a character is, and a test
    // pins exactly that.)
    //
    // Silent until 80%: a counter ticking up from 0/280 turns writing something
    // heartfelt into filling in a form.
    safeRender(counter, `${used} / ${MAX_MESSAGE}`);
    counter.classList.toggle('is-full', used >= MAX_MESSAGE);
    counter.hidden = used < COUNTER_FROM;
  };

  /**
   * ⚠ THE LINK IS BUILT AS THEY TYPE, NOT WHEN THEY CLICK. This is not an
   * optimisation — it is the only way the copy button can work reliably.
   *
   * `buildLink` is async: it awaits `CompressionStream`. A clipboard write must
   * happen inside the USER GESTURE, and an `await` in the click handler can end
   * that gesture — Chrome is lenient, **Safari rejects the write outright**. So
   * "click -> await encode -> write" is a copy button that silently fails on every
   * Mac and iPhone.
   *
   * Keeping a freshly-built URL on hand means the click is synchronous: gesture
   * intact, clipboard happy, everywhere.
   */
  const fields = () => ({
    msg: box.value,
    from: sign.value.trim(),
    boy: boy.value.trim(),
    girl: girl.value.trim(),
  });

  /** What the cached URL was built FROM. If this drifts, the URL is a lie. */
  const keyOf = (/** @type {ReturnType<typeof fields>} */ f) => JSON.stringify(f);

  let url = '';
  let builtKey = '';
  /** @type {Promise<string> | null} */
  let building = null;

  const rebuild = () => {
    const f = fields();
    const key = keyOf(f);

    url = '';
    builtKey = '';

    if (!f.msg.trim()) { building = null; return null; }

    const pending = buildLink(f.msg, f).then((built) => {
      // A slow encode that lands AFTER a newer keystroke must not publish a stale
      // result over a fresher one. Only the most recent build may win.
      if (building !== pending) return built;
      url = built;
      builtKey = key;
      if (!result.hidden) reveal(built);
      return built;
    });

    building = pending;
    return pending;
  };

  for (const el of [box, sign, boy, girl]) {
    el.addEventListener('input', () => {
      update();
      rebuild();
    });
  }

  const reveal = (/** @type {string} */ u) => {
    link.value = u;
    result.hidden = false;
    safeRender(note, `${u.length} characters — short enough for any chat app.`);
  };

  const copied = () => {
    copy.textContent = 'copied — now send it';
    setTimeout(() => { copy.textContent = 'copy my link'; }, 2600);
  };

  const copyByHand = () => {
    // Clipboard denied or unavailable: select it so they can copy by hand.
    // Never leave them with a dead button.
    link.focus();
    link.select();
    copy.textContent = 'press ⌘C to copy';
    setTimeout(() => { copy.textContent = 'copy my link'; }, 3000);
  };

  /**
   * @param {(u: string) => void} act  what to do once we have a fresh URL
   *
   * The fast path is SYNCHRONOUS on purpose: no `await` before the clipboard call,
   * because an await can end the user gesture and Safari then refuses the write.
   * The cached URL is fresh in every real interaction — typing rebuilt it — and the
   * key check proves it rather than assuming it. Only if it is genuinely stale do
   * we fall back to awaiting, where a failed clipboard write lands on copy-by-hand.
   */
  const withUrl = (act) => {
    const key = keyOf(fields());
    if (url && builtKey === key) { act(url); return; }
    const pending = rebuild();
    if (pending) void pending.then((u) => { if (u) act(u); });
  };

  copy.addEventListener('click', () => withUrl((u) => {
    reveal(u);
    try {
      // Needs a secure context (https or localhost) AND a user gesture — which a
      // click is. This is why the site had to have HTTPS before anything else.
      navigator.clipboard.writeText(u).then(copied, copyByHand);
    } catch {
      copyByHand();
    }
  }));

  share.addEventListener('click', () => withUrl((u) => {
    reveal(u);
    // A dismissed share sheet rejects. That is not an error.
    void navigator.share({ title: 'CluColor', url: u }).catch(() => {});
  }));

  result.append(link, note);
  panel.append(title, blurb, card, who, counter, row, result);
  root.append(panel);

  box.focus();
  update();
  rebuild();
}
