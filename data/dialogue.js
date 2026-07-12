// @ts-check

/**
 * THE SCRIPT.
 *
 * ------------------------------------------------------------------------
 *  BALAJI — THIS IS A DRAFT. REWRITE IT.
 *
 *  The structure is what I'm confident about: where the beats land, how the
 *  hints escalate, where the colour lifts. The WORDS should be yours. I don't
 *  know how the two of you talk to each other, and that is the entire
 *  difference between a nice little game and a gift.
 *
 *  Read it out loud with a stopwatch. If the dialogue alone runs past ~4
 *  minutes, the game is too long and you need to know that today, not on the
 *  20th.
 * ------------------------------------------------------------------------
 *
 * Structure notes:
 *  - The player picks BOY or GIRL. They control that one; the other is the
 *    companion, who speaks and gives hints. Every companion line is written to
 *    work in EITHER mouth — no line assumes a gender.
 *  - `hints` is the escalation ladder, in order. The last entry always
 *    corresponds to the companion solving it. There is never a "skip" button;
 *    the failsafe is narrative.
 */

/** Set these. Used wherever a name is spoken. */
export const NAMES = { boy: 'BOY', girl: 'GIRL' };

/** Fallback ending, shown when the URL carries no custom message. */
export const DEFAULT_MESSAGE =
  'Spring is always around the corner - even a grey world';

export const DIALOGUE = {
  // --- waking ------------------------------------------------------------
  intro: [
    { who: 'player', text: '...' },
    { who: 'companion', text: 'You\'re awake.' },
    { who: 'player', text: 'Where is this?' },
    { who: 'companion', text: 'I don\'t know. I woke up here too.' },
    { who: 'companion', text: 'I don\'t remember anything before it.' },
    { who: 'player', text: 'Neither do I.' },
    { who: 'companion', text: 'Then we don\'t know each other.' },
    { who: 'player', text: 'No.' },
    { who: 'companion', text: '...but I\'d rather not do this alone.' },
    { who: 'companion', text: 'Walk with me?' },
    { who: 'system', text: 'Hold → to walk.' },
  ],

  // Fired once, when the red bench first enters view — long before you reach it.
  benchSighted: [
    { who: 'companion', text: 'Wait. Do you see that?' },
    { who: 'player', text: 'It\'s red.' },
    { who: 'companion', text: 'Everything here is grey. Everything.' },
    { who: 'companion', text: 'That\'s the only thing in this whole world that isn\'t.' },
  ],

  // --- act 1: the lion idol ----------------------------------------------
  lion: {
    approach: [
      { who: 'companion', text: 'It\'s a lion. Stone. Someone carved it.' },
      { who: 'player', text: 'Then someone was here before us.' },
      { who: 'lion', text: 'STOP.' },
      { who: 'lion', text: 'You may not pass what you cannot answer.' },
    ],

    riddle: {
      prompt: 'I am the weight you carry when you carry nothing.\nYou set me down, and the whole world went grey.\n\nWhat did you lose?',

      // A single, common, thematically loaded noun. Never a phrase.
      answers: ['memory', 'memories', 'my memory', 'our memories'],

      // Escalating. The last one is the companion answering for you.
      hints: [
        { who: 'companion', text: 'It\'s watching us. It\'s waiting.' },
        { who: 'companion', text: 'Think about what we don\'t have. What did we both wake up without?' },
        { who: 'companion', text: 'We don\'t know our names. We don\'t know each other. What\'s the word for that?' },
        { who: 'companion', text: 'It starts with M. I\'m sure of it. I don\'t know how I\'m sure.' },
        { who: 'companion', text: 'Memory. It\'s memory. We lost our memory.' },
      ],

      wrong: [
        { who: 'lion', text: 'No.' },
        { who: 'lion', text: 'That is not what you set down.' },
        { who: 'lion', text: 'Try again. I have waited longer than you have lived.' },
      ],

      solved: [
        { who: 'lion', text: 'Yes.' },
        { who: 'lion', text: 'You may pass. But you carry it again now. It is heavy.' },
        { who: 'player', text: '...something changed.' },
        { who: 'companion', text: 'The sky. Look at the sky.' },
      ],
    },
  },

  // --- act 2: the house of frames ----------------------------------------
  house: {
    // Outside, on the step.
    approach: [
      { who: 'companion', text: 'A house. Out here?!' },
      { who: 'player', text: 'The door\'s open.' },
      { who: 'companion', text: 'Someone left it open for us.' },
      { who: 'player', text: '...or never got to close it.' },
      { who: 'companion', text: 'Come on.' },
    ],

    // Played over black, mid-cutscene, as they step through the door.
    entering: [
      { who: 'system', text: 'They step inside.' },
    ],

    // Inside. These lines were always written from IN the house — they used to
    // play on the doorstep, which made no sense.
    inside: [
      { who: 'companion', text: 'Photographs. The walls are covered in them.' },
      { who: 'companion', text: 'They\'re all of... I can\'t make them out. They\'re all blurred.' },
      { who: 'player', text: 'Except this one.' },
      { who: 'companion', text: 'It\'s in pieces. Someone broke it apart.' },
    ],

    // Back out on the road.
    leaving: [
      { who: 'companion', text: 'We can\'t stay here.' },
      { who: 'player', text: 'No. But we know something now.' },
    ],

    puzzle: {
      hints: [
        { who: 'companion', text: 'It wants to be put back. I think we have to fix it.' },
        { who: 'companion', text: 'Slide the pieces. There\'s a gap — use it.' },
        { who: 'companion', text: 'That one. Move that one first. Trust me.' },
        { who: 'companion', text: 'Here — let me. I think I\'ve done this before.' },
        { who: 'companion', text: 'There. Together. We did it together.' },
      ],

      solved: [
        { who: 'player', text: 'It\'s us.' },
        { who: 'companion', text: 'That\'s us. That\'s you and me.' },
        { who: 'companion', text: 'We knew each other. Before.' },
        { who: 'player', text: 'We knew each other.' },
        { who: 'companion', text: 'I\'m starting to remember. Not it — you. I\'m remembering you.' },
      ],
    },
  },

  // --- act 3: the bench ---------------------------------------------------
  bench: {
    approach: [
      { who: 'companion', text: 'The red thing. We found it.' },
      { who: 'player', text: 'It\'s a bench.' },
      { who: 'companion', text: 'Sit with me.' },
      { who: 'player', text: '...there\'s something carved into it.' },
      { who: 'companion', text: 'Dots. Lines. Someone scratched them in, over and over.' },
      { who: 'companion', text: 'Whoever it was, they wanted it to survive.' },
    ],

    puzzle: {
      morse: '.. / .-.. --- ...- . / -.-- --- ..-',

      // The player must never have to leave the game to look this up.
      // Hint level 1 SHOWS the chart. This is not optional.
      hints: [
        { who: 'companion', text: 'These marks aren\'t random. They\'re a pattern. They repeat.' },
        { who: 'companion', text: 'Wait — I remember this. I remember the shape of it.', shows: 'morse-chart' },
        { who: 'companion', text: 'Two dots. That\'s one letter, all by itself. Start there.' },
        { who: 'companion', text: 'The middle word — that\'s L, O, V, E. I\'d know it anywhere.' },
        { who: 'companion', text: 'I love you.\nThat\'s what it says. That\'s what it\'s always said.' },
      ],

      solved: [
        { who: 'player', text: 'Someone sat here and carved this.' },
        { who: 'companion', text: 'We sat here and carved this.' },
        { who: 'companion', text: 'This was ours. This bench was ours.' },
        // colorLevel -> 1.0 here. Flowers. Grass. The trees come back.
        { who: 'player', text: 'Everything\'s coming back.' },
        { who: 'companion', text: 'Not everything. Just the part that mattered.' },
        { who: 'companion', text: 'I love you. I remember. I love you.' },
        { who: 'player', text: 'I love you too.' },
      ],
    },
  },
};

/** Shown when the player asks for a hint but the puzzle is already solved. */
export const IDLE_COMPANION = [
  'I\'m right here.',
  'Take your time.',
  'We\'ve got as long as we need.',
];
