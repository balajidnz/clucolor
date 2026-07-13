// @ts-check

/**
 * Answer matching.
 *
 * This is the whole difficulty of a text riddle. Not "is the answer right" — the
 * player knows the answer within seconds — but "does the game ACCEPT the answer
 * they typed". A strict comparison turns a riddle into a wall you cannot see, and
 * the player has no idea whether they are wrong or merely phrased it differently.
 *
 * So: be generous. Then be more generous than that.
 */

/**
 * Reduce an answer to its essence.
 *
 * @param {string} s
 * @returns {string}
 */
export function normalize(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')          // strip accents: "mémoire" -> "memoire"
    .replace(/[^\p{L}\p{N}\s]/gu, '') // strip punctuation, quotes, trailing "?"
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(a|an|the|my|our|your|its) /, ''); // "the memory" -> "memory"
}

/**
 * Damerau-Levenshtein distance (optimal string alignment), capped.
 *
 * NOT plain Levenshtein. A plain edit distance scores a TRANSPOSITION as two
 * edits — so "meomry" is distance 2 from "memory" and gets rejected as a wrong
 * answer. But swapping two adjacent letters is the single most common typing
 * mistake there is. Counting it as one edit is the entire reason this function
 * exists.
 *
 * @param {string} a
 * @param {string} b
 * @param {number} max
 * @returns {number} the distance, or max+1 once it provably exceeds max
 */
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;

  // Three rows, because a transposition looks back TWO cells diagonally.
  let prev2 = /** @type {number[]} */ ([]);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      let d = Math.min(
        row[j - 1] + 1,      // insert
        prev[j] + 1,         // delete
        prev[j - 1] + cost,  // substitute
      );

      // Adjacent transposition: "ab" -> "ba" costs 1, not 2.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, prev2[j - 2] + 1);
      }

      row[j] = d;
      if (d < best) best = d;
    }

    if (best > max) return max + 1; // no cell in this row can lead anywhere good
    prev2 = prev;
    prev = row;
  }

  return prev[b.length];
}

/**
 * Does `input` match any accepted answer?
 *
 * Exact match after normalisation, PLUS a one-character edit — because "meomry"
 * is not a wrong answer, it is a typo, and treating it as a wrong answer is how
 * a puzzle becomes a wall.
 *
 * The tolerance scales with length: a 1-character slip in a 6-letter word is a
 * typo, but in a 2-letter word it is a different word entirely.
 *
 * @param {string} input
 * @param {string[]} accepted
 * @returns {boolean}
 */
export function matches(input, accepted) {
  const got = normalize(input);
  if (!got) return false;

  for (const answer of accepted) {
    const want = normalize(answer);
    if (got === want) return true;

    // Only forgive typos in words long enough for a typo to be unambiguous.
    if (want.length >= 5 && distance(got, want, 1) <= 1) return true;
  }

  return false;
}
