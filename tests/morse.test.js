// @ts-check
/**
 * The morse carving.
 *
 * The bug this suite exists to prevent: **the bench saying one thing while the
 * game expects another.** If the carving and the answer were two separate
 * strings, someone edits one and forgets the other, and the puzzle becomes
 * literally impossible — with no error, no warning, and no way for her to know
 * she is right. It would be discovered by the one person it must not be
 * discovered by.
 *
 * So the carving is DERIVED from the answer, and these tests prove it.
 */
import { MORSE, ANSWER, LETTERS, CARVING, CHART, normalize } from '../data/morse.js';
import { createHints } from '../js/game/hints.js';
import { DIALOGUE } from '../data/dialogue.js';

const results = [];
const check = (name, ok, detail) =>
  results.push({ name, ok, ...(ok || detail === undefined ? {} : { detail: String(detail) }) });

// --- the carving must SAY the answer -----------------------------------------

{
  const carved = CARVING.map((word) => word.map((l) => l.letter).join('')).join('');
  check('the carving spells exactly what the game expects', carved === LETTERS,
    `${carved} vs ${LETTERS}`);
}

{
  const bad = CARVING.flat().filter((l) => l.code !== MORSE[l.letter]);
  check('every mark on the bench is the correct morse for its letter', bad.length === 0,
    bad.map((l) => l.letter).join(','));
}

{
  const undefined_ = CARVING.flat().filter((l) => !l.code);
  check('no letter in the answer is missing from the alphabet', undefined_.length === 0,
    undefined_.map((l) => l.letter).join(','));
}

check('the words split on spaces', CARVING.length === ANSWER.split(' ').length,
  `${CARVING.length} words`);

check('the whole alphabet is in the chart she is given', CHART.length === 26, CHART.length);

// The carving, spelled out. If this ever changes, someone changed the answer.
{
  const shown = CARVING.map((w) => w.map((l) => l.code).join(' ')).join(' / ');
  check(`the bench reads: ${shown}`, shown === '.. / .-.. --- ...- . / -.-- --- ..-', shown);
}

// --- she must not be failed on a technicality --------------------------------

const ACCEPT = [
  'I LOVE YOU',
  'i love you',
  'iloveyou',
  'I love you.',
  'I-LOVE-YOU',
  '  i love you  ',
  'I  love   you!',
  'iLoveYou',
];

for (const typed of ACCEPT) {
  check(`accepts "${typed}"`, normalize(typed) === LETTERS, normalize(typed));
}

const REJECT = ['', 'i love u', 'love you', 'i love yo', 'i love yous'];
for (const typed of REJECT) {
  check(`rejects "${typed}"`, normalize(typed) !== LETTERS, normalize(typed));
}

// --- the lighting-up, letter by letter ---------------------------------------
//
// The carving lights up under her as she reads it. That is the whole feedback
// loop, so the "how much is right so far" maths had better be right.

/** How many letters of the carving should be lit, given what she has typed. */
const litFor = (typed) => {
  const t = normalize(typed);
  let n = 0;
  while (n < t.length && t[n] === LETTERS[n]) n++;
  return n;
};

check('typing nothing lights nothing', litFor('') === 0);
check('typing "I" lights the first mark', litFor('I') === 1);
check('typing "I LO" lights three', litFor('I LO') === 3, litFor('I LO'));
check('typing the whole thing lights all 8', litFor('I LOVE YOU') === LETTERS.length,
  litFor('I LOVE YOU'));
check('a wrong first letter lights nothing', litFor('X') === 0);
check('a wrong letter part-way stops the light there', litFor('I LX') === 2, litFor('I LX'));
check('she is not punished for a typo at the END of a correct prefix',
  litFor('I LOVE YOX') === 7, litFor('I LOVE YOX'));

// --- the hint ladder ----------------------------------------------------------

{
  const LINES = DIALOGUE.bench.puzzle.hints;
  const CEILING = 3; // must match morse.js

  // The chart MUST arrive early. Without it this is a wall, and she would have to
  // leave the game and search the web to finish a birthday present.
  const chartLevel = LINES.findIndex((l) => l.shows === 'morse-chart');
  check('the companion produces the A-Z chart by hint level 1', chartLevel === 1, chartLevel);

  let autoSolved = false;
  const ctl = createHints({
    lines: LINES,
    isPaused: () => false,
    onHint: () => {},
    onAutoSolve: () => { autoSolved = true; },
    clockCeiling: CEILING,
  });

  for (let t = 0; t < 600; t += 0.5) ctl.update(0.5);

  check('the clock never decodes it FOR her — she is actively working on it', !autoSolved);
  check('but the clock does give her every word of help, including the chart',
    ctl.level === CEILING, ctl.level);

  ctl.ask();
  check('asking hands it over — because she chose to', autoSolved && ctl.done);
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

await fetch('/__report', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ suite: 'morse', ua: navigator.userAgent, results }),
}).catch(() => {});
