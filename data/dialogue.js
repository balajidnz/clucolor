// @ts-check


/**
 * The DEFAULT names. Whoever sends a link can override them in the maker, and
 * the names ride along in the URL — so a link can arrive already knowing what to
 * call the two of them.
 *
 * Lowercase on purpose: CSS uppercases the speaker tag, and "ask girl" reads
 * better than "ask GIRL".
 */
export const NAMES = { boy: 'boy', girl: 'girl' };

/** Fallback ending, shown when the URL carries no custom message. */
export const DEFAULT_MESSAGE =
  'Spring is always around the corner - even a grey world';

export const DIALOGUE = {
  // --- waking ------------------------------------------------------------
  intro: [
    { who: 'player', text: '...' },
    { who: 'companion', text: 'Oh! You\'re awake.' },
    { who: 'player', text: 'Where is this?' },
    { who: 'companion', text: 'I don\'t know. I woke up here too.' },
    { who: 'companion', text: 'I don\'t remember anything before it.' },
    { who: 'player', text: 'Neither do I.' },
    { who: 'companion', text: 'Then we don\'t know each other?' },
    { who: 'player', text: 'No.' },
    { who: 'companion', text: '...but I\'d rather not do this alone.' },
    { who: 'companion', text: 'Walk with me?' },
    { who: 'system', text: 'Hold → to walk.' },
  ],

  // Fired once, when the red bench first enters view — long before you reach it.
  /**
   * NOTE: by the time this fires, the house is solved and colorLevel is 0.66 —
   * the world is MOSTLY back. So "the only thing here that isn't grey" is simply
   * false, and the player can SEE that it's false.
   *
   * The bench is still the most vivid thing on screen (it is the one object
   * exempt from the grade), so the beat is RECOGNITION, not contrast. It isn't
   * the last colour left. It's the first thing either of them knows.
   */
  benchSighted: [
    { who: 'companion', text: 'Wait. Do you see that?' },
    { who: 'player', text: 'A bench.' },
    { who: 'companion', text: 'Something about it ebing red. Feels so familiar.' },
    { who: 'player', text: '...I know it.' },
    { who: 'companion', text: 'So do I.' },
  ],

  // --- act 1: the lion idol ----------------------------------------------
  lion: {
    approach: [
      { who: 'companion', text: 'It\'s a lion. Stone. Someone carved it.' },
      { who: 'player', text: 'Then someone was here before us. Weird lion though.' },
      { who: 'lion', text: 'STOP.' },
      { who: 'lion', text: 'You may not pass what you cannot answer.' },
    ],

    riddle: {
      prompt:
        'I am invisible, priceless, and uniquely yours.\n' +
        'I cannot be bought, but I can be cherished.\n' +
        'I shape who you are, yet I belong to the past.\n\n' +
        'What am I?',

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
        { who: 'lion', text: 'Well do you really chrish that? And does that shape you?' },
        { who: 'lion', text: 'No I\'d think more before I answer' },
        { who: 'lion', text: 'Try again. I have waited longer than you have lived.' },
      ],

      // NOTE: colorLevel goes to 0.33 here. The sky is still 33% saturated — i.e.
      // still grey. What HAS changed is growth wave 0: the first leaves on every
      // tree, the first shoots in the dirt. Point at that. Pointing at the sky
      // asks the player to see something that is not there.
      solved: [
        { who: 'lion', text: 'Yes.' },
        { who: 'lion', text: 'You may pass. But you carry it again now. It is heavy.' },
        { who: 'player', text: '...something changed.' },
        { who: 'companion', text: 'The trees.' },
        { who: 'companion', text: 'There are leaves on the trees. There weren\'t before.' },
        { who: 'player', text: 'Something is growing.' },
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
      /**
       * The CLOCK only reaches level 3. Level 4 — where she takes over and does
       * it — happens ONLY if the player asks for it (`autoSolveOnTimer: false`).
       *
       * A sliding puzzle is not know-it-or-you-don't; she is actively making
       * progress on it. Solving it for her on a timer, mid-move, is not a rescue —
       * it takes the thing out of her hands. So the clock escalates as far as
       * "I'll keep telling you which piece", which means she can NEVER be stuck
       * (just follow the highlight) while the moves stay hers.
       *
       * That is why level 3 must not promise to take over, and level 4 must.
       */
      hints: [
        { who: 'companion', text: 'It wants to be put back. I think we have to fix it.' },
        { who: 'companion', text: 'Slide the pieces. There\'s a gap, let\'s try to use it.' },
        { who: 'companion', text: 'That one. Move that one first. Trust me.' },
        { who: 'companion', text: 'Keep going! I\'ll tell you which one, every time. I can see it now.' },
        // Ask-only. She takes it out of your hands, because you asked her to.
        { who: 'companion', text: 'Here, let me try. I think I\'ve done this before.' },
      ],

      solved: [
        { who: 'player', text: 'It\'s us.' },
        { who: 'companion', text: 'That\'s us. That\'s you and me.' },
        { who: 'companion', text: 'We knew each other. Before.' },
        { who: 'player', text: 'We knew each other.' },
        { who: 'companion', text: 'I\'m starting to remember. Not it but you. I\'m remembering you.' },
      ],
    },
  },

  // --- act 3: the bench ---------------------------------------------------
  bench: {
    approach: [
      { who: 'companion', text: 'The red thing. We found it.' },
      { who: 'player', text: 'It\'s a bench.' },
      { who: 'companion', text: 'Sit with me.... Oh never mind we\'re cartoons after all' },
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
        { who: 'companion', text: 'Wait! I remember this. I remember the shape of it.', shows: 'morse-chart' },
        { who: 'companion', text: 'Two dots. That\'s one letter, all by itself. Start there.' },
        { who: 'companion', text: 'The middle word... that\'s L, O, V, E. I\'d know it anywhere.' },
        { who: 'companion', text: 'I love you.\nThat\'s what it says. That\'s what it\'s always said.' },
      ],

      solved: [
        { who: 'player', text: 'Someone sat here and carved this.' },
        { who: 'companion', text: 'We sat here and carved this.' },
        { who: 'companion', text: 'This was ours. This bench was ours.' },
        // colorLevel -> 1.0 here. Flowers. Grass. The trees come back.
        { who: 'player', text: 'Everything\'s coming back.' },
        { who: 'companion', text: 'Even if not everything. Just the part that mattered.' },
        { who: 'companion', text: 'I love you. You were the one that mattered. I love you.' },
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
