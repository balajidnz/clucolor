// @ts-check

/**
 * Morse.
 *
 * The carving on the bench is DERIVED from the answer, never written out by hand.
 * If the two were separate strings they could drift apart — someone edits the
 * answer, forgets the carving, and now the bench says one thing while the game
 * expects another. That bug would be invisible until someone actually sat down
 * and decoded it, which is to say: until her.
 */

/** @type {Record<string, string>} */
export const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
  G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
  M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
  S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
};

/** What is carved into the bench. The one thing it has always said. */
export const ANSWER = 'I LOVE YOU';

/** Just the letters, for comparison: 'ILOVEYOU'. */
export const LETTERS = ANSWER.replace(/[^A-Z]/gi, '').toUpperCase();

/**
 * The carving, as words of letters. Derived, so it can never disagree with the
 * answer.
 *
 * @type {{ letter: string, code: string }[][]}
 */
export const CARVING = ANSWER.split(' ').map((word) =>
  [...word.toUpperCase()].map((letter) => ({ letter, code: MORSE[letter] })),
);

/**
 * Reduce what she typed to comparable letters.
 *
 * Generous on purpose: "I love you", "iloveyou", "I LOVE YOU!" and "i-love-you"
 * are all the same answer, and rejecting any of them would be the game being
 * pedantic at the worst possible moment.
 *
 * @param {string} s
 */
export const normalize = (s) => s.replace(/[^A-Za-z]/g, '').toUpperCase();

/** The A-Z chart the companion remembers. She MUST produce this, or the puzzle
 *  is an unfair wall — nobody should have to leave the game and search the web. */
export const CHART = Object.entries(MORSE).map(([letter, code]) => ({ letter, code }));
