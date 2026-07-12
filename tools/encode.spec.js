// @ts-check
/**
 * Round-trip tests for the URL-hash message codec.
 *
 * Runs in a real browser (see tests/encode.test.html) rather than a JS runtime,
 * because `btoa`, `TextEncoder` and `TextDecoder` are host APIs — the only
 * meaningful place to test them is an engine someone will actually play on.
 * Primary target is a laptop browser; secondary is Android Chrome. Anything
 * that passes in Safari (the strictest of them) passes in Blink.
 *
 * The failure this exists to prevent: someone puts an emoji in the message and
 * `btoa` throws — on the 22nd. `btoa` rejects ANY character outside Latin-1, and
 * an emoji is the strictest case of that: 4 UTF-8 bytes AND a surrogate pair.
 */
import { encode, decode, MAX_MESSAGE } from '../js/share/encode.js';

/**
 * @typedef {{name: string, ok: boolean, detail?: string}} Result
 */

/** @returns {Result[]} */
export function runSpec() {
  /** @type {Result[]} */
  const results = [];

  /** @param {string} name @param {boolean} ok @param {unknown} [detail] */
  const check = (name, ok, detail) => {
    results.push({
      name,
      ok,
      ...(ok || detail === undefined ? {} : { detail: JSON.stringify(detail) }),
    });
  };

  /** @param {string} msg */
  const roundTrip = (msg) => decode('#m=' + encode({ v: 1, msg }))?.msg;

  /** @param {string} s @returns {string} */
  const b64url = (s) => {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  // --- round-trips ---------------------------------------------------------

  const plain = 'Happy birthday. I would find you in any world.';
  check('ascii', roundTrip(plain) === plain);

  const emoji = 'i love you 💖';
  check('emoji (outside Latin-1 — this is what breaks btoa)', roundTrip(emoji) === emoji, roundTrip(emoji));

  const zwj = 'family 👨‍👩‍👧 sequence';
  check('ZWJ emoji sequence', roundTrip(zwj) === zwj, roundTrip(zwj));

  const mixed = 'i love you 💖\nalways ❤️';
  check('multiple emoji + newline', roundTrip(mixed) === mixed, roundTrip(mixed));

  const newlines = 'line one\nline two\n\nline four';
  check('newlines preserved (pre-wrap depends on them)', roundTrip(newlines) === newlines);

  // --- limits --------------------------------------------------------------

  check(
    `clamps to ${MAX_MESSAGE} code points`,
    roundTrip('a'.repeat(500))?.length === MAX_MESSAGE,
    roundTrip('a'.repeat(500))?.length,
  );

  // A naive .slice(280) cuts a surrogate pair in half, leaving a lone surrogate
  // that renders as a replacement character.
  const clamped = roundTrip('💖'.repeat(400)) ?? '';
  const hasLoneSurrogate = [...clamped].some((c) => {
    const n = /** @type {number} */ (c.codePointAt(0));
    return n >= 0xd800 && n <= 0xdfff;
  });
  check('never splits an emoji at the cap', !hasLoneSurrogate, clamped.slice(-4));
  check('cap counts code points, not UTF-16 units', [...clamped].length === MAX_MESSAGE, [...clamped].length);

  const url = 'https://sunair.fun/#m=' + encode({ v: 1, msg: 'x'.repeat(MAX_MESSAGE) });
  check(`full-length ascii link stays under 1.6KB (${url.length}B)`, url.length < 1600);

  const emojiUrl = 'https://sunair.fun/#m=' + encode({ v: 1, msg: '💖'.repeat(MAX_MESSAGE) });
  check(`worst-case 4-byte-per-char link under 1.6KB (${emojiUrl.length}B)`, emojiUrl.length < 1600);

  // --- hostile input: must never throw, must yield null ---------------------

  check('oversized hash rejected before atob', decode('#m=' + 'A'.repeat(9000)) === null);
  check('garbage base64', decode('#m=!!!!not-base64!!!!') === null);
  check('empty hash', decode('') === null);
  check('no m= param', decode('#nope=1') === null);
  check('valid base64, not JSON', decode('#m=' + b64url('hello')) === null);
  check('valid JSON, wrong version', decode('#m=' + b64url('{"v":9,"msg":"x"}')) === null);
  check('valid JSON, msg not a string', decode('#m=' + b64url('{"v":1,"msg":42}')) === null);
  const badUtf8 = btoa(String.fromCharCode(0xff, 0xfe, 0xfd));
  check('malformed UTF-8 rejected (fatal decoder)', decode('#m=' + badUtf8) === null);

  // --- sanitisation --------------------------------------------------------

  const xss = '<img src=x onerror=alert(1)>';
  check('XSS payload survives as inert literal text', roundTrip(xss) === xss, roundTrip(xss));

  const bidi = 'safe‮reversed';
  check('bidi override stripped', roundTrip(bidi) === 'safereversed', roundTrip(bidi));

  const withCtrl = 'a' + String.fromCharCode(1) + 'b' + String.fromCharCode(127) + 'c';
  check('control chars stripped', roundTrip(withCtrl) === 'abc', roundTrip(withCtrl));

  // --- base64url alphabet: chat apps mangle + and = -------------------------

  const out = encode({ v: 1, msg: '???>>>~~~<<<'.repeat(9) });
  check('output contains no +, / or =', !/[+/=]/.test(out), out.slice(0, 40));

  return results;
}
