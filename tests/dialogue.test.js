// @ts-check
/**
 * The dialogue box: click-anywhere to advance, and skip-this-run.
 *
 * Small surface, but every line of the story goes through it — and two of its
 * behaviours are the kind that break silently.
 */
import { createDialogue } from '../js/game/dialogue.js';

const results = [];
const check = (name, ok, detail) =>
  results.push({ name, ok, ...(ok || detail === undefined ? {} : { detail: String(detail) }) });

const NAMES = { boy: 'HIM', girl: 'HER' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A click, as the browser would deliver it. */
const clickOn = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

function harness() {
  const root = document.createElement('div');
  document.body.append(root);
  const dlg = createDialogue(root, NAMES);
  return {
    root,
    dlg,
    box: () => root.querySelector('.dialogue'),
    skip: () => root.querySelector('.dialogue-skip'),
    text: () => root.querySelector('.dialogue-text').textContent,
    who: () => root.querySelector('.dialogue-who').textContent,
    done: () => { dlg.destroy(); root.remove(); },
  };
}

/**
 * Deliberately VERY long — ~10 seconds of typing at 42 chars/sec.
 *
 * A short line finishes revealing in under 100ms, so by the time the click guard
 * expires it is already complete and a click would advance PAST it, testing
 * nothing. And a merely longish line is still flaky: a background tab throttles
 * setTimeout, so the typewriter can race ahead of the test's own clock. Make the
 * line long enough that no plausible throttling can finish it.
 */
const LONG = 'the first line is deliberately enormous so that it is unmistakably '
  + 'still revealing itself when the click arrives, no matter how the browser '
  + 'chooses to throttle timers in a tab that does not have focus, because a test '
  + 'that depends on wall-clock timing is a test that fails at random.';

const LINES = [
  { who: 'companion', text: LONG },
  { who: 'player', text: LONG },
  { who: 'companion', text: LONG },
];

// --- click anywhere advances --------------------------------------------------

{
  const h = harness();
  const playing = h.dlg.play(LINES, true);

  await sleep(30);
  check('box opens', !h.box().hidden && h.dlg.open);
  check('speaker resolves against who you chose to be', h.who() === 'HER', h.who());

  // Wait out the click guard, then click somewhere that is NOT the box.
  await sleep(260);
  check('the line is still being typed out at this point',
    h.text().length < LONG.length, `${h.text().length}/${LONG.length}`);

  clickOn(document.body);       // completes the typewriter
  await sleep(20);
  check('a click on the PAGE (not the box) completes the line',
    h.text() === LONG, `${h.text().length}/${LONG.length}`);

  clickOn(document.body);       // advances
  await sleep(30);
  check('a second click advances to the next line', h.who() === 'HIM', h.who());

  // Run it out.
  for (let i = 0; i < 10; i++) { clickOn(document.body); await sleep(25); }
  await playing;
  check('the run resolves once the last line is dismissed', !h.dlg.open);
  check('box hides afterwards', h.box().hidden);
  check('skip hides afterwards', h.skip().hidden);
  h.done();
}

// --- the click guard: the bug this exists to prevent ---------------------------
//
// A puzzle's "solve" button resolves a promise, and the dialogue that follows can
// open inside the SAME click dispatch. Without a guard, that one click would open
// the box and immediately eat its first line.

{
  const h = harness();

  const button = document.createElement('button');
  document.body.append(button);
  button.addEventListener('click', () => { void h.dlg.play(LINES, true); });

  clickOn(button); // opens the dialogue, from inside a click
  await sleep(40);

  check('the click that OPENED the box does not also advance it',
    h.dlg.open && h.who() === 'HER', `${h.dlg.open} / ${h.who()}`);

  button.remove();
  h.done();
}

// --- skip: this run only, not a mute ------------------------------------------

{
  const h = harness();
  const first = h.dlg.play(LINES, true);

  await sleep(30);
  check('skip button is visible while talking', !h.skip().hidden);

  clickOn(h.skip());
  await first;
  check('skip ends the run immediately, mid-line', !h.dlg.open);

  // The crucial half: the NEXT run must still play.
  const second = h.dlg.play([{ who: 'lion', text: 'STOP.' }], true);
  await sleep(30);
  check('skip is NOT a mute — the next scene still talks',
    h.dlg.open && h.who() === 'THE LION', `${h.dlg.open} / ${h.who()}`);
  check('skip button comes back for the new run', !h.skip().hidden);

  clickOn(h.skip());
  await second;
  h.done();
}

// --- escape also skips ---------------------------------------------------------

{
  const h = harness();
  const playing = h.dlg.play(LINES, true);
  await sleep(30);

  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
  await playing;
  check('Escape skips the run too', !h.dlg.open);
  h.done();
}

// --- ANY key advances ----------------------------------------------------------
//
// This is the playtest bug, pinned. The intro line reads "Hold → to walk", and
// advancing used to be Space/Enter/E ONLY — so every tester pressed the arrow the
// line had just named, and the game ignored it. The instruction pointed at a key
// that did nothing at the exact moment it pointed at it.

{
  const h = harness();

  /**
   * SHORT lines on purpose. The shared LINES[0] is deliberately ~10 seconds of
   * typewriter, so a snapshot of it mid-reveal keeps growing on its own — and
   * "nothing changed" can never hold against a string that is still being typed.
   * These finish revealing in well under the settle below, so the text is STILL,
   * and any change to it can only have come from an advance.
   */
  const SHORT = [
    { who: 'lion', text: 'ONE' },
    { who: 'lion', text: 'TWO' },
  ];

  const playing = h.dlg.play(SHORT, true);
  await sleep(320);          // line 1 fully typed, and past CLICK_GUARD_MS (220)

  const key = (code, init = {}) =>
    document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, ...init }));

  check('the line has settled before we test it', h.text() === 'ONE', h.text());

  // A modifier on its own is someone reaching for Shift, not asking for the next line.
  key('ShiftLeft');
  await sleep(20);
  check('a modifier alone does NOT advance', h.dlg.open && h.text() === 'ONE', h.text());

  // Cmd+R is a reload, not a page turn. Browser shortcuts stay the browser's.
  key('KeyR', { metaKey: true });
  await sleep(20);
  check('Cmd/Ctrl-combos do NOT advance', h.dlg.open && h.text() === 'ONE', h.text());

  /**
   * ⚠ THE BUG THAT NEARLY SHIPPED, PINNED.
   *
   * Walking to the lion with → held down: the browser auto-repeats keydown ~30x a
   * second, so the dialogue opened and ate the whole scene before the player's
   * thumb left the key. An event with `repeat` set is a key being HELD — you are
   * holding it to walk, not to read.
   */
  for (let i = 0; i < 30; i++) key('ArrowRight', { repeat: true });
  await sleep(60);
  check('a HELD key (auto-repeat) does NOT advance — 30 repeats change nothing',
    h.dlg.open && h.text() === 'ONE', h.text());

  // But a real press of the very same key must work — that is the whole point.
  key('ArrowRight');
  await sleep(160);
  check('a real ArrowRight press advances — the key the script tells you to press',
    h.text() === 'TWO', h.text());

  key('Escape');
  await playing;
  check('Escape still skips, and is not swallowed by the open-guard', !h.dlg.open);
  h.done();
}

// --- report --------------------------------------------------------------------

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
  body: JSON.stringify({ suite: 'dialogue', ua: navigator.userAgent, results }),
}).catch(() => {});
