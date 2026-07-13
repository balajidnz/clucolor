// @ts-check
// Runs under the SAME CSP the game ships (default-src 'self'), which forbids
// inline scripts — hence a real module rather than a <script> block.
// Surface any throw in the terminal, or a failure here looks like silence.
const report = (name, ok) => fetch('/__report', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ suite: 'ending', ua: navigator.userAgent, results: [{ name, ok }] }),
}).catch(() => {});

window.addEventListener('error', (e) =>
  report(`THREW: ${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`, false));
window.addEventListener('unhandledrejection', (e) => report(`REJECTED: ${e.reason}`, false));

import { encode, decode, MAX_MESSAGE, MAX_NAME } from '../js/share/encode.js';
import { showEnding } from '../js/game/screens.js';
import { showMaker } from '../js/game/maker.js';
import { DEFAULT_MESSAGE } from '../data/dialogue.js';

/**
 * The ending renders a string that came out of the URL — i.e. fully
 * attacker-controlled. Someone WILL craft sunair.fun/#m=<payload> and send it to
 * a target. These tests exist to prove the payload stays inert.
 */
const results = [];
const check = (name, ok, detail) =>
  results.push({ name, ok, ...(ok || detail === undefined ? {} : { detail: String(detail) }) });

/** Mount showEnding against a given hash, in a detached root, and read it back. */
async function mount(hash) {
  const prev = location.hash;
  location.hash = hash;

  const root = document.createElement('div');
  document.body.append(root);
  await showEnding(root);   // async: it decodes the hash before it renders

  const panel = root.querySelector('.panel-ending');
  const msg = root.querySelector('.ending-message');
  const from = root.querySelector('.ending-from');

  location.hash = prev;
  return { root, panel, msg, from };
}

// --- the happy path ----------------------------------------------------------

{
  const text = 'happy birthday.\nI would find you in any world.';
  const { root, msg } = await mount('#m=' + await encode({ v: 1, msg: text }));
  check('custom message decodes and renders', msg.textContent === text, msg.textContent);
  check('newline preserved (pre-wrap, not <br>)', msg.textContent.includes('\n'));
  root.remove();
}

{
  const { root, msg } = await mount('');
  check('no hash -> DEFAULT_MESSAGE', msg.textContent === DEFAULT_MESSAGE, msg.textContent);
  root.remove();
}

{
  const { root, msg } = await mount('#m=!!!garbage!!!');
  check('malformed hash -> DEFAULT_MESSAGE (never blank, never throws)',
    msg.textContent === DEFAULT_MESSAGE, msg.textContent);
  root.remove();
}

{
  const { root, from } = await mount('#m=' + await encode({ v: 1, msg: 'x', from: 'balaji' }));
  check('from line renders', from?.textContent === '— balaji', from?.textContent);
  root.remove();
}

// --- unicode -----------------------------------------------------------------

{
  const text = 'i love you 💖 ❤️';
  const { root, msg } = await mount('#m=' + await encode({ v: 1, msg: text }));
  check('emoji survives the round trip (btoa would throw on it)', msg.textContent === text, msg.textContent);
  root.remove();
}

// --- XSS: the whole point ----------------------------------------------------

const PAYLOADS = [
  '<img src=x onerror=alert(1)>',
  '<script>alert(1)<\/script>',
  '<svg/onload=alert(1)>',
  '"><iframe src=javascript:alert(1)>',
  '<a href="javascript:alert(1)">click</a>',
];

for (const payload of PAYLOADS) {
  const { root, panel, msg } = await mount('#m=' + await encode({ v: 1, msg: payload }));

  const asText = msg.textContent === payload;
  // The real assertion: no ELEMENT was ever created from the payload.
  const noElements = panel.querySelectorAll('img, script, svg, iframe, a').length === 0;

  check(`XSS inert: ${payload.slice(0, 28)}…`, asText && noElements,
    asText ? 'created an element!' : msg.textContent);
  root.remove();
}

// --- the maker: the loop that makes this a thing people pass on ---------------
//
// Drives the real UI — types into the box, clicks the button, reads the link back
// out, and decodes it. This is the only test that proves the ENTIRE loop:
//   typed message -> link -> hash -> decode -> ending.

{
  const root = document.createElement('div');
  document.body.append(root);
  showMaker(root);

  const box = root.querySelector('.maker-text');
  const from = root.querySelector('.maker-from');
  const make = root.querySelector('.panel-btn');
  const link = root.querySelector('.maker-link');
  const counter = root.querySelector('.maker-count');

  check('maker: button disabled while empty', make.disabled);

  const typed = 'the words go here 💖\nsecond line';
  box.value = typed;
  box.dispatchEvent(new Event('input'));

  check('maker: button enables once there are words', !make.disabled);
  check('maker: counter counts CODE POINTS, not UTF-16 units',
    counter.textContent === `${[...typed].length} / ${MAX_MESSAGE}`, counter.textContent);

  from.value = 'someone';
  root.querySelectorAll('.maker-name')[0].value = 'Ravi';
  root.querySelectorAll('.maker-name')[1].value = 'Anu';
  make.click();
  await new Promise((r) => setTimeout(r, 60)); // the handler compresses; let it finish

  const decoded = await decode(new URL(link.value).hash);
  check('maker -> link -> decode round-trips the message',
    decoded?.msg === typed, decoded?.msg);
  check('maker -> link -> decode round-trips "from"',
    decoded?.from === 'someone', decoded?.from);
  check('maker: names ride into the link',
    decoded?.boy === 'Ravi' && decoded?.girl === 'Anu', `${decoded?.boy}/${decoded?.girl}`);
  check('maker: link points at this page', link.value.startsWith(location.origin));

  // Test the PAYLOAD, not the whole hash — `#m=` legitimately contains an '='.
  const payload = new URL(link.value).hash.replace(/^#m=/, '');
  check('maker: payload has no +, / or = (chat apps mangle those)',
    !/[+/=]/.test(payload), payload.slice(0, 40));

  // The cap must hold in the UI, not just in the encoder.
  box.value = 'x'.repeat(400);
  box.dispatchEvent(new Event('input'));
  check(`maker: typing past ${MAX_MESSAGE} is clamped in the box itself`,
    [...box.value].length === MAX_MESSAGE, [...box.value].length);

  root.remove();
}

// --- custom names -------------------------------------------------------------
//
// The sender can name the two of them. The names ride in the URL, which means
// they are attacker-controlled too, and get the same treatment as the message.

{
  const p = await decode('#m=' + await encode({ v: 1, msg: 'x', boy: 'Ravi', girl: 'Anu' }));
  check('names round-trip through the link', p?.boy === 'Ravi' && p?.girl === 'Anu',
    `${p?.boy}/${p?.girl}`);
}

{
  const p = await decode('#m=' + await encode({ v: 1, msg: 'x' }));
  check('no names in the link -> undefined, so the caller falls back to defaults',
    p?.boy === undefined && p?.girl === undefined, `${p?.boy}/${p?.girl}`);
}

{
  // An empty or whitespace name must NOT ride along — it would blank out the
  // speaker tag on the far side, and a nameless speaker looks like a bug.
  const p = await decode('#m=' + await encode({ v: 1, msg: 'x', boy: '   ', girl: '' }));
  check('blank names are dropped, not carried as empty strings',
    p?.boy === undefined && p?.girl === undefined, `${p?.boy}/${p?.girl}`);
}

{
  const p = await decode('#m=' + await encode({ v: 1, msg: 'x', boy: 'z'.repeat(100) }));
  check(`over-long name clamped to ${MAX_NAME}`, p?.boy?.length === MAX_NAME, p?.boy?.length);
}

{
  const p = await decode('#m=' + await encode({ v: 1, msg: 'x', boy: 'line\nbreak' }));
  check('a name cannot contain a newline (it is one line, not a message)',
    !p?.boy?.includes('\n'), JSON.stringify(p?.boy));
}

{
  const p = await decode('#m=' + await encode({ v: 1, msg: 'x', boy: '<img src=x onerror=alert(1)>' }));
  check('a hostile name survives only as inert text', typeof p?.boy === 'string' && p.boy.includes('<img'),
    p?.boy);
}

// --- the cap ------------------------------------------------------------------

{
  const long = 'a'.repeat(500);
  const { root, msg } = await mount('#m=' + await encode({ v: 1, msg: long }));
  check(`over-long message clamped to ${MAX_MESSAGE}`,
    [...msg.textContent].length === MAX_MESSAGE, [...msg.textContent].length);
  root.remove();
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

// A live one, so a human can look at it and confirm the payload is just text.
location.hash = '#m=' + await encode({ v: 1, msg: '<img src=x onerror=alert(1)>\nthis should be literal text', from: 'the attacker' });
await showEnding(document.getElementById('live'));

await fetch('/__report', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ suite: 'ending', ua: navigator.userAgent, results }),
}).catch(() => {});
