// @ts-check

/**
 * The shareable message, packed into a URL fragment.
 *
 * Three things shrink the link, in order of how much they matter:
 *
 *  1. **No JSON.** `{"v":1,"msg":"..."}` spends ~15 bytes on pure syntax, and
 *     base64 taxes every byte by 4/3 — so the punctuation alone cost ~20
 *     characters of every link. The format is now one version byte followed by
 *     the fields, separated by a control character. Nothing else.
 *
 *  2. **Compression, but only when it wins.** Below ~100 characters, deflate's
 *     own overhead makes the result LONGER. So we compress, compare, and keep
 *     whichever is shorter — the version byte says which it was.
 *
 *  3. base64url, not base64: `+` `/` `=` get mangled by chat-app link detection.
 *
 * What does NOT shrink a link: encryption. Ciphertext is at least as long as
 * plaintext, usually longer. And we don't need it — the fragment after `#` is
 * never sent to the server, so the message never touches anyone's logs.
 *
 * The floor is information-theoretic: a 54-character message is 54 bytes, and no
 * encoding gets under that.
 */

/** Longest hash we will even look at, before attempting to decode it. */
const MAX_HASH = 6000;

/** Message cap, in code points. Enforced on both encode and decode. */
export const MAX_MESSAGE = 280;

/** Names and the "from" line are short. A 280-character name is not a name. */
export const MAX_NAME = 24;

/** Format markers, and the field separator. */
const RAW = 0x32;      // '2' — the fields, as-is
const DEFLATED = 0x33; // '3' — the fields, raw-deflated
const SEP = 0x1f;      // ASCII unit separator; sanitize() strips it from content,
                       // so it can never appear inside a field.

/**
 * @typedef {object} Payload
 * @property {1} v
 * @property {string} msg
 * @property {string} [from]
 * @property {string} [boy]   who the boy is called; defaults to "boy"
 * @property {string} [girl]  who the girl is called; defaults to "girl"
 */

/** Field order on the wire. Trailing empties are dropped. */
const FIELDS = /** @type {const} */ (['msg', 'from', 'boy', 'girl']);

const toB64url = (/** @type {string} */ s) =>
  s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromB64url = (/** @type {string} */ s) =>
  s.replace(/-/g, '+').replace(/_/g, '/');

const LF = 10;
const SPACE = 32;
const DEL = 127;
const C1_END = 159;
const BIDI_FMT_LO = 0x202a;
const BIDI_FMT_HI = 0x202e;
const BIDI_ISO_LO = 0x2066;
const BIDI_ISO_HI = 0x2069;

/**
 * Drop control characters and bidi overrides, then cap the length.
 *
 * Iterating code points (rather than regex + `.slice`) does two jobs at once: it
 * avoids source-level escape sequences, and it means the cap can never cut an
 * emoji in half by splitting a surrogate pair.
 *
 * This is also what guarantees the field separator can never appear inside a
 * field: SEP is a control character, and control characters do not survive here.
 *
 * @param {string} s
 * @param {number} [cap] in code points
 */
function sanitize(s, cap = MAX_MESSAGE) {
  /** @type {string[]} */
  const out = [];
  const keepNewlines = cap === MAX_MESSAGE; // a name is one line

  for (const ch of s) {
    if (out.length >= cap) break;

    const c = /** @type {number} */ (ch.codePointAt(0));
    if (c === LF) { if (keepNewlines) out.push(ch); continue; }
    if (c < SPACE) continue;
    if (c >= DEL && c <= C1_END) continue;
    if (c >= BIDI_FMT_LO && c <= BIDI_FMT_HI) continue;
    if (c >= BIDI_ISO_LO && c <= BIDI_ISO_HI) continue;

    out.push(ch);
  }

  return out.join('');
}

/**
 * A short field (name, "from"). Returns undefined if nothing survives, so the
 * caller falls back to the default rather than showing an empty speaker tag.
 *
 * @param {unknown} v
 * @returns {string | undefined}
 */
function shortField(v) {
  if (typeof v !== 'string') return undefined;
  const clean = sanitize(v, MAX_NAME).trim();
  return clean || undefined;
}

/** @param {Uint8Array} bytes */
function bytesToB64url(bytes) {
  // A loop, not spread: String.fromCharCode(...bytes) overflows the call stack.
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return toB64url(btoa(bin));
}

/** @param {string} b64 */
function b64urlToBytes(b64) {
  const bin = atob(fromB64url(b64));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const hasCompression =
  typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

/**
 * @param {Uint8Array} bytes
 * @param {'deflate-raw'} format
 * @param {'CompressionStream' | 'DecompressionStream'} kind
 * @returns {Promise<Uint8Array>}
 */
async function pipe(bytes, format, kind) {
  const Stream = kind === 'CompressionStream' ? CompressionStream : DecompressionStream;
  const stream = new Blob([bytes]).stream().pipeThrough(new Stream(format));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * @param {Payload} payload
 * @returns {Promise<string>} base64url, safe to drop straight into a URL fragment
 */
export async function encode(payload) {
  /** @type {string[]} */
  const fields = [sanitize(payload.msg)];
  for (const key of FIELDS.slice(1)) fields.push(shortField(payload[key]) ?? '');

  // Drop trailing empties — most links carry only a message.
  while (fields.length > 1 && fields[fields.length - 1] === '') fields.pop();

  const body = new TextEncoder().encode(
    fields.join(String.fromCharCode(SEP)),
  );

  const raw = new Uint8Array(body.length + 1);
  raw[0] = RAW;
  raw.set(body, 1);

  if (!hasCompression) return bytesToB64url(raw);

  // Compress, then keep whichever is smaller. Below ~100 characters deflate's own
  // overhead makes the result LONGER, and a longer link is the thing we are here
  // to avoid.
  try {
    const squeezed = await pipe(body, 'deflate-raw', 'CompressionStream');
    if (squeezed.length >= body.length) return bytesToB64url(raw);

    const out = new Uint8Array(squeezed.length + 1);
    out[0] = DEFLATED;
    out.set(squeezed, 1);
    return bytesToB64url(out);
  } catch {
    return bytesToB64url(raw); // compression is an optimisation, never a requirement
  }
}

/**
 * Decode a URL fragment back into a payload. Never throws — malformed, hostile or
 * oversized input yields null, and the caller falls back to the default message.
 *
 * @param {string} hash e.g. `#m=abc123`, or the bare `abc123`
 * @returns {Promise<Payload | null>}
 */
export async function decode(hash) {
  try {
    if (!hash || hash.length > MAX_HASH) return null;

    const m = /(?:^|&)m=([A-Za-z0-9\-_]+)/.exec(hash.replace(/^#/, ''));
    if (!m) return null;

    const bytes = b64urlToBytes(m[1]);
    if (bytes.length < 2) return null;

    const marker = bytes[0];
    let body = bytes.subarray(1);

    if (marker === DEFLATED) {
      if (!hasCompression) return null;
      body = await pipe(body, 'deflate-raw', 'DecompressionStream');
    } else if (marker !== RAW) {
      return null; // not a format we know
    }

    // fatal:true so malformed UTF-8 throws rather than silently yielding U+FFFD.
    const text = new TextDecoder('utf-8', { fatal: true }).decode(body);
    const parts = text.split(String.fromCharCode(SEP));

    const msg = sanitize(parts[0] ?? '');
    if (!msg) return null;

    // Re-sanitize everything after decode. The URL is attacker-controlled; never
    // trust that it was produced by our own encoder.
    /** @type {Payload} */
    const out = { v: 1, msg };
    FIELDS.slice(1).forEach((key, i) => {
      const v = shortField(parts[i + 1]);
      if (v) out[key] = v;
    });

    return out;
  } catch {
    return null;
  }
}

/**
 * @param {string} msg
 * @param {{from?: string, boy?: string, girl?: string}} [extra]
 * @returns {Promise<string>} the full shareable URL
 */
export async function buildLink(msg, extra = {}) {
  const base = location.origin + location.pathname;
  return `${base}#m=${await encode({ v: 1, msg, ...extra })}`;
}
