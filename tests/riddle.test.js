// @ts-check
/**
 * The riddle: answer matching + the hint ladder.
 *
 * These two are the difference between "she reads the message" and "she gives up
 * on level 1". The answer matcher decides whether a correct answer is ACCEPTED;
 * the hint ladder guarantees she reaches the end even if it isn't.
 */
import { normalize, matches } from '../js/game/puzzles/answers.js';
import { createHints } from '../js/game/hints.js';
import { DIALOGUE } from '../data/dialogue.js';

const results = [];
const check = (name, ok, detail) =>
  results.push({ name, ok, ...(ok || detail === undefined ? {} : { detail: String(detail) }) });

const ANSWERS = DIALOGUE.lion.riddle.answers;

// --- the answer must be accepted however it is typed --------------------------

const ACCEPT = [
  'memory',
  'Memory',
  'MEMORY',
  '  memory  ',
  'memory.',
  'memory?',
  '"memory"',
  'memories',
  'my memory',
  'the memory',
  'our memories',
  'Memories!',
  'meomry',   // transposed — a typo, not a wrong answer
  'memry',    // dropped letter
  'memmory',  // doubled letter
  'memorie',  // near-miss spelling
  'mémory',   // stray accent
];

for (const input of ACCEPT) {
  check(`accepts "${input}"`, matches(input, ANSWERS), normalize(input));
}

// --- but it must not accept just anything -------------------------------------

const REJECT = [
  '',
  '   ',
  'love',
  'time',
  'hope',
  'the sky',
  'nothing',
  'a shadow',
  'money',    // 1 edit from "memory"? no — m-e-m-o-r-y vs m-o-n-e-y is far
  'x',
];

for (const input of REJECT) {
  check(`rejects "${input}"`, !matches(input, ANSWERS), normalize(input));
}

// --- normalisation ------------------------------------------------------------

check('strips a leading article', normalize('The Memory') === 'memory', normalize('The Memory'));
check('strips punctuation', normalize('memory!?') === 'memory', normalize('memory!?'));
check('collapses whitespace', normalize('  our   memories ') === 'memories', normalize('  our   memories '));

// --- the hint ladder: she must ALWAYS reach the end ---------------------------

const LINES = DIALOGUE.lion.riddle.hints;

/** Drive a controller for `seconds` of game time. */
function run(ctl, seconds, step = 0.5) {
  for (let t = 0; t < seconds; t += step) ctl.update(step);
}

{
  const seen = [];
  let autoSolved = false;
  const ctl = createHints({
    lines: LINES,
    isPaused: () => false,
    onHint: (line, level) => seen.push(level),
    onAutoSolve: () => { autoSolved = true; },
  });

  run(ctl, 19);
  check('no hint before 20s — let her think', seen.length === 0, seen.length);

  run(ctl, 3);
  check('first hint at ~20s', seen.length === 1, seen.length);

  run(ctl, 130);
  check('AUTO-SOLVES by 120s — she can never be stuck', autoSolved);
  check('every hint level fired, in order',
    seen.join(',') === LINES.map((_, i) => i).join(','), seen.join(','));
}

{
  // The clock must PAUSE while dialogue is open, or she gets hint-nagged for reading.
  let paused = true;
  const ctl = createHints({
    lines: LINES,
    isPaused: () => paused,
    onHint: () => {},
    onAutoSolve: () => {},
  });

  run(ctl, 200);
  check('clock pauses while dialogue is open (no hints in 200s)', ctl.level === -1, ctl.level);

  paused = false;
  run(ctl, 22);
  check('clock resumes once dialogue closes', ctl.level === 0, ctl.level);
}

{
  // Wrong answers escalate on their own.
  const ctl = createHints({
    lines: LINES, isPaused: () => false, onHint: () => {}, onAutoSolve: () => {},
  });

  ctl.wrong();
  check('one wrong answer does not trigger a hint', ctl.level === -1, ctl.level);
  ctl.wrong();
  check('two wrong answers do', ctl.level === 0, ctl.level);
}

{
  // Asking is the same path — but it was her choice.
  const ctl = createHints({
    lines: LINES, isPaused: () => false, onHint: () => {}, onAutoSolve: () => {},
  });

  ctl.ask();
  check('asking gives a hint immediately', ctl.level === 0, ctl.level);

  for (let i = 0; i < 10; i++) ctl.ask();
  check('asking repeatedly walks to the auto-solve and stops', ctl.done && ctl.level === LINES.length - 1,
    `${ctl.level}/${ctl.done}`);
}

{
  // Solving it yourself must silence the companion instantly.
  let hinted = false;
  const ctl = createHints({
    lines: LINES, isPaused: () => false,
    onHint: () => { hinted = true; },
    onAutoSolve: () => { hinted = true; },
  });

  ctl.stop();
  run(ctl, 300);
  ctl.wrong(); ctl.wrong(); ctl.ask();
  check('solving it stops all hints dead', !hinted);
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
  body: JSON.stringify({ suite: 'riddle', ua: navigator.userAgent, results }),
}).catch(() => {});
