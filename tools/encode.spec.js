// @ts-check
/**
 * The URL message codec.
 *
 * Runs in a real browser rather than a JS runtime: `btoa`, `TextEncoder` and
 * `CompressionStream` are host APIs, so the only meaningful place to test them is
 * an engine someone will actually play on.
 *
 * The failure this exists to prevent: someone puts an emoji in the message and
 * `btoa` throws — on the 22nd. `btoa` rejects ANY character outside Latin-1, and
 * an emoji is the strictest case: 4 UTF-8 bytes AND a surrogate pair.
 */
import { encode, decode, MAX_MESSAGE, MAX_NAME } from '../js/share/encode.js';

/**
 * @typedef {{name: string, ok: boolean, detail?: string}} Result
 */

/** @returns {Promise<Result[]>} */
export async function runSpec() {
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
  const trip = async (msg) => (await decode('#m=' + (await encode({ v: 1, msg }))))?.msg;

  /** The whole link, as it would land in a chat app. */
  const linkLen = async (/** @type {string} */ msg) =>
    'https://sunair.fun/#m='.length + (await encode({ v: 1, msg })).length;

  // --- round-trips ---------------------------------------------------------

  const plain = 'Happy birthday. I would find you in any world.';
  check('ascii', (await trip(plain)) === plain);

  const emoji = 'i love you 💖';
  check('emoji (outside Latin-1 — this is what breaks btoa)', (await trip(emoji)) === emoji, await trip(emoji));

  const zwj = 'family 👨‍👩‍👧 sequence';
  check('ZWJ emoji sequence', (await trip(zwj)) === zwj, await trip(zwj));

  const mixed = 'i love you 💖\nalways ❤️';
  check('multiple emoji + newline', (await trip(mixed)) === mixed, await trip(mixed));

  const newlines = 'line one\nline two\n\nline four';
  check('newlines preserved (pre-wrap depends on them)', (await trip(newlines)) === newlines);

  // --- all four fields ------------------------------------------------------

  {
    const p = await decode('#m=' + (await encode({ v: 1, msg: 'm', from: 'f', boy: 'b', girl: 'g' })));
    check('every field round-trips',
      p?.msg === 'm' && p?.from === 'f' && p?.boy === 'b' && p?.girl === 'g', JSON.stringify(p));
  }

  {
    // Trailing empties are dropped on the wire, so a bare message stays short.
    const bare = (await encode({ v: 1, msg: 'hello' })).length;
    const full = (await encode({ v: 1, msg: 'hello', from: 'x', boy: 'y', girl: 'z' })).length;
    check('a message with no extras carries no empty fields', bare < full, `${bare} vs ${full}`);
  }

  // --- THE LINK MUST BE SHORT ----------------------------------------------
  //
  // The old JSON format spent ~15 bytes on pure punctuation, and base64 taxes
  // every byte by 4/3 — so the syntax alone cost ~20 characters of every link.

  {
    const len = await linkLen('you are my spring');
    check(`17-char message -> ${len}-char link (was 66 as JSON)`, len < 55, len);
  }

  {
    const len = await linkLen('Spring is always around the corner - even a grey world');
    check(`54-char message -> ${len}-char link (was 116 as JSON)`, len < 100, len);
  }

  {
    // Real prose, not a repeated character — compression only bites where there is
    // genuine redundancy to find.
    const long = 'I kept trying to think of something clever to write here and everything I '
      + 'wrote sounded like someone else. So here is the plain version. You are the best '
      + 'thing that has happened to me. I would walk through a grey world for you and not '
      + 'even notice it was grey.';
    const len = await linkLen(long);
    check(`${long.length}-char message -> ${len}-char link (was ~420 as JSON)`, len < 320, len);
    check('...and it still round-trips exactly', (await trip(long)) === long);
  }

  {
    // Compression must never make a link LONGER. Below ~100 characters deflate
    // loses to its own overhead, so the encoder has to notice and keep the raw
    // form.
    const len = (await encode({ v: 1, msg: 'hi' })).length;
    check(`a 2-char message stays tiny (${len} chars) — compression is not forced`, len < 12, len);
  }

  // --- limits --------------------------------------------------------------

  check(
    `clamps to ${MAX_MESSAGE} code points`,
    (await trip('a'.repeat(500)))?.length === MAX_MESSAGE,
    (await trip('a'.repeat(500)))?.length,
  );

  // A naive .slice(280) cuts a surrogate pair in half, leaving a lone surrogate
  // that renders as a replacement character.
  const clamped = (await trip('💖'.repeat(400))) ?? '';
  const hasLoneSurrogate = [...clamped].some((c) => {
    const n = /** @type {number} */ (c.codePointAt(0));
    return n >= 0xd800 && n <= 0xdfff;
  });
  check('never splits an emoji at the cap', !hasLoneSurrogate, clamped.slice(-4));
  check('cap counts code points, not UTF-16 units', [...clamped].length === MAX_MESSAGE, [...clamped].length);

  {
    const p = await decode('#m=' + (await encode({ v: 1, msg: 'x', boy: 'z'.repeat(99) })));
    check(`over-long name clamped to ${MAX_NAME}`, p?.boy?.length === MAX_NAME, p?.boy?.length);
  }

  // --- hostile input: must never throw, must yield null ---------------------

  check('oversized hash rejected before decoding', (await decode('#m=' + 'A'.repeat(9000))) === null);
  check('garbage base64', (await decode('#m=!!!!not-base64!!!!')) === null);
  check('empty hash', (await decode('')) === null);
  check('no m= param', (await decode('#nope=1')) === null);
  check('unknown format marker', (await decode('#m=' + btoa('9abc'))) === null);
  check('truncated payload', (await decode('#m=Mg')) === null);
  check('claims to be deflated but is not', (await decode('#m=' + btoa('3garbagegarbage'))) === null);

  // --- sanitisation --------------------------------------------------------

  const xss = '<img src=x onerror=alert(1)>';
  check('XSS payload survives as inert literal text', (await trip(xss)) === xss, await trip(xss));

  const bidi = 'safe‮reversed';
  check('bidi override stripped', (await trip(bidi)) === 'safereversed', await trip(bidi));

  const withCtrl = 'a' + String.fromCharCode(1) + 'b' + String.fromCharCode(127) + 'c';
  check('control chars stripped', (await trip(withCtrl)) === 'abc', await trip(withCtrl));

  {
    // The field separator is a CONTROL CHARACTER, and sanitize() strips those.
    // That is precisely what makes it safe to use as a separator: a message
    // containing one could otherwise forge extra fields on the far side.
    const sneaky = 'msg' + String.fromCharCode(0x1f) + 'INJECTED';
    const p = await decode('#m=' + (await encode({ v: 1, msg: sneaky })));
    check('a message cannot forge extra fields using the separator',
      p?.msg === 'msgINJECTED' && p?.from === undefined, `${p?.msg} / ${p?.from}`);
  }

  // --- base64url alphabet: chat apps mangle + and = -------------------------

  const out = await encode({ v: 1, msg: '???>>>~~~<<<'.repeat(9) });
  check('output contains no +, / or =', !/[+/=]/.test(out), out.slice(0, 40));

  return results;
}
