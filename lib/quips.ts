/**
 * Notification one-liners.
 *
 * The alert body carries the facts; this is the bit people actually read on a
 * lock screen. Lines are picked deterministically from a seed, so the same
 * event always reads the same way — a result that gets picked up twice must
 * not arrive worded two different ways — while different events spread across
 * the pool instead of repeating.
 */

export interface QuipContext {
  /** Who it happened to, already formatted ("David", "Ryan and Chris"). */
  who: string;
  plural: boolean;
  /** Team they locked, as a nickname. */
  team: string;
  /** Winning margin, when a score is known. */
  margin: number | null;
  /** Thursday or Friday: out before the week really began. */
  earlyWeek: boolean;
  /** How many locks they put up this week, when it is one person. */
  lockCount: number | null;
  /** How many players are still alive after this result. */
  survivors: number | null;
  /** How many of their locks have landed so far this week. */
  locksHit: number | null;
  /** Stable per event, so the same result always picks the same line. */
  seed: string;
}

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick(lines: string[], seed: string): string {
  return lines[hash(seed) % lines.length];
}

/**
 * Pick from several pools, each taking a share of the draw proportional to its
 * weight. Without this a pool of one line competes with a pool of eighty and
 * effectively never comes up.
 */
function weighted(pools: Array<{ weight: number; lines: string[] }>, seed: string): string {
  const usable = pools.filter(pool => pool.lines.length > 0);
  if (usable.length === 0) return '';

  const total = usable.reduce((sum, pool) => sum + pool.weight, 0);
  let choice = hash(seed) % total;

  for (const pool of usable) {
    if (choice < pool.weight) {
      // A second hash so the line within a pool is independent of the pool draw.
      return pool.lines[hash(seed + '#') % pool.lines.length];
    }
    choice -= pool.weight;
  }
  return usable[0].lines[0];
}

/** Team-specific ribbing, keyed on the team that let them down. */
const TEAM_JOKES: Record<string, (c: QuipContext) => string> = {
  Bills: c => `The Bills came due for ${c.who}`,
  Ravens: c => `Quoth the Ravens: nevermore, ${c.who}`,
  Chargers: c => `${c.who} ran out of juice`,
  Jets: c => `${c.who} got grounded`,
  Lions: c => `${c.who} got fed to the Lions`,
  Bears: c => `${c.who} got mauled`,
  Eagles: c => `Clipped wings for ${c.who}`,
  Packers: c => `${c.who} packed it in`,
  Giants: c => `${c.who} got cut down to size`,
  Cowboys: c => `Yeehaw, ${c.who}. That's a no`,
  Saints: c => `${c.who} needed a miracle. None available`,
  Seahawks: c => `${c.who} got sunk`,
  Dolphins: c => `${c.who} got out of their depth`,
  Titans: c => `${c.who} found the iceberg`,
  Raiders: c => `${c.who}'s ticket got raided`,
  Steelers: c => `${c.who} got steamrolled`,
  Panthers: c => `${c.who} got clawed`,
  Bengals: c => `${c.who} got declawed`,
  Colts: c => `${c.who} got bucked`,
  Texans: c => `${c.who} got roped`,
  Jaguars: c => `${c.who} got pounced on`,
  Vikings: c => `${c.who}'s week got pillaged`,
  Commanders: c => `${c.who} got demoted`,
  Buccaneers: c => `${c.who} got plundered`,
  Falcons: c => `${c.who} got swooped`,
  Cardinals: c => `${c.who} flew the coop`,
  '49ers': c => `${c.who} didn't pan out`,
  Rams: c => `${c.who} got rammed`,
  Patriots: c => `The revolution is over, ${c.who}`,
  Browns: c => `${c.who} got browned out`,
  Broncos: c => `${c.who} got bucked off`,
  Chiefs: c => `${c.who} got dethroned`,
};

const GENERIC_BUSTS: Array<(c: QuipContext) => string> = [
  c => `See ya later, ${c.who}`,
  c => `${c.who} ${c.plural ? 'have' : 'has'} left the building`,
  c => `RIP ${c.who}'s week`,
  c => `${c.who} ${c.plural ? 'are' : 'is'} officially spectating`,
  c => `Somebody tell ${c.who} it's over`,
  c => `${c.who}: eliminated, with feeling`,
  c => `The ${c.team} said no to ${c.who}`,
  c => `${c.who} backed the ${c.team}. Bold. Wrong`,
  c => `${c.who} ${c.plural ? 'were' : 'was'} this close. ${c.plural ? 'They' : 'Not'} close enough`,
  c => `${c.who} can stop watching now`,
  c => `${c.who} ${c.plural ? 'have' : 'has'} been released from caring`,
  c => `Somebody is going to have to tell ${c.who}`,
  c => `${c.who} ${c.plural ? 'are' : 'is'} free to enjoy the rest of the games now`,
  c => `The ${c.team} have ruined ${c.who}'s afternoon`,
];

/**
 * Non-sequiturs that fit any moment — a kickoff, a reminder, a lock that hit.
 *
 * The bar is higher than "not about losing": anything that mocks the reader's
 * competence reads as a loss even when it never mentions one, so lines like
 * "this is why they print instructions on shampoo" belong with the busts.
 * These only observe something absurd.
 */
const ABSURD_ANY: string[] = [
  'The Home Depot showers are for display only, not for use',
  'Some doors are just walls with ambition',
  'Never trust a man who irons his socks',
  'The vending machine does NOT negotiate',
  'Nobody has ever won an argument with a goose',
  'The microwave clock has never once been correct',
  'Wet cement remembers everything',
  'Every barn is a house for something',
  'The second pancake knows what it did',
  'Every rope is just a snake that got organized',
  'The tide does not check the schedule',
  'A hammer has never once apologized',
  'That was the employee bathroom',
  'A goat will eat the receipt',
  'Geese remember faces. Yours especially',
  'Not every moth wants the light',
  'Raccoons have never had a plan and they are doing fine',
  'Owls are not wise, they are just quiet',
  'Deer have no concept of insurance',
  'Everyone is improvising. Some louder than others',
  'We are all just waiting for the microwave',
  'Too many slims jims to chew on',
  'Bees do not attend meetings',
  'A traffic cone is a hat for the road',
  'Somewhere a vending machine is fully stocked',
  'Every parking lot used to be something else',
  'Pigeons have never once been in a hurry',
  'The stapler always outlives the desk',
  'A bucket is just a hat for water',
  'The freezer light is a matter of faith',
  'Every tree is a very slow fountain',
  'The moon has no opinion on any of this',
  'A cow has never asked a single question',
  'Toast is just bread that went through something',
  'The ocean has never once been in a rush',
  'Every elevator has heard worse conversations',
  'Nobody knows how a thermos knows',
  'Somewhere an escalator is running for nobody',
  'A paper bag is a suitcase with no ambition',
  'The ceiling fan has seen things',
];

/**
 * Non-sequiturs that only make sense attached to a loss — either because they
 * say so, or because they are needling somebody.
 */
const ABSURD_LOSS: string[] = [
  'You do not name a cow you plan to eat',
  "Every dog has its day. You're a cat",
  'Barked down the wrong tree',
  'You put your left foot in when it was supposed to be the right one',
  'The bees were never on your side',
  'You cannot fold a fitted sheet either',
  'The lawn does not care that you tried',
  'What do you mean you had a feeling?',
  'Nothing is load-bearing if you believe hard enough',
  'The odds were posted. You chose vibes',
  'Confidence is not a strategy, but it is a personality',
  'Somewhere, a dad is shaking his head',
  'A hot dog is a sandwich and you are out',
  'Milk goes bad. So does a ticket',
  'The soup was never going to be that hot',
  'The line moved. You did not',
  'Vegas has a building. You had a feeling',
  'Somebody in Nevada is having a lovely evening',
  'Your ticket is now a receipt for nothing',
  'A parlay is just a rumor with extra steps',
  'You were one team away from being insufferable',
  'The scoreboard does not accept feedback',
  'Your ticket had one job and did not show up',
  'You cannot hedge a feeling',
  'A stump is a tree that quit',
  'You cannot sand a hole shut',
  'No fence has ever kept out weather',
  'Every bucket leaks eventually',
  'You cannot stack water',
  'A closed umbrella is just a stick with hope',
  'Rust was always going to win',
  'The plan was fine. The universe had notes',
  'You were always going to find out this way',
  'Somewhere a man is doing this correctly',
  'Certainty is the cheapest thing you can buy',
  'The graph goes down sometimes. That is a graph',
  'Nobody is coming to fix it',
  "You can't smother yourself in honey and expect the bear to respect your personal space",
  'Who taught you how to shovel!?',
  'Not every chicken lays eggs',
  'A ladder is just a staircase that gave up',
  'You do not bring a canoe to a thunderstorm',
  'You cannot sharpen a spoon and call it a plan',
  'This is why they print instructions on shampoo',
  'The escalator was fine until you sat on it',
  'Two umbrellas do not make a roof',
  'You brought a fork to a soup',
  'Salt is not a personality',
  'Nobody asked the ostrich',
  'A map is not the territory and neither is your ticket',
  'A borrowed ladder always leans the wrong way',
  'You cannot outrun a smell',
  'Who gave you a library card?',
  'Who let you near a thermostat?',
  'Were you raised by a vending machine?',
  "Somebody check this man's tire pressure",
  'Those plants are plastic and you watered them',
  'The squirrel buried it and forgot. Same as you',
  "A possum's best move is lying down. Take notes",
  'Somewhere a clock is wrong and nobody will fix it',
  'This is the sort of thing that happens on a Tuesday',
  "Nobody's second bowl of cereal is as good as the first",
  'You put the ketchup in the fridge, did you not',
  'The nail sticking up was the honest one',
  'You pulled a push door. Classic.',
  'Strike 1! Too bad it\'s not baseball.',
  'You made your bed, now lie in it',
  'Not all geese wear bowties',
  'You wore a white suit to a funeral'
];

/** Everything available to a bust. */
const ABSURD: string[] = [...ABSURD_ANY, ...ABSURD_LOSS];

/** Lines that actually describe what happened, for a single player. */
const NARRATIVE: Array<(c: QuipContext) => string | null> = [
  c => (c.lockCount === 1 ? `${c.who} had exactly one lock, and lost exactly one lock` : null),
  c => (c.lockCount === 1 ? `${c.who} played it safe with one pick and still went out` : null),
  c => (c.lockCount !== null && c.lockCount >= 5
    ? `${c.who} stacked ${c.lockCount} locks and never got past this one`
    : null),
  c => (c.lockCount !== null && c.lockCount >= 2
    ? `${c.who} needed ${c.lockCount} games to go right. Got fewer`
    : null),
  c => (c.lockCount !== null ? `${c.who} is out with ${c.lockCount} on the ticket` : null),
  c => (c.survivors === 1 ? `${c.who} is gone. One player left standing` : null),
  c => (c.survivors !== null && c.survivors > 1
    ? `${c.who} out. ${c.survivors} still alive`
    : null),
  c => (c.survivors === 0 ? `${c.who} out, and that is everybody. Nobody survived` : null),
];

const EARLY_WEEK_BUSTS: Array<(c: QuipContext) => string> = [
  c => `Out before the week even started, ${c.who}`,
  c => `${c.who} ${c.plural ? 'are' : 'is'} done and it's still Thursday`,
  c => `${c.who} speedran elimination`,
  c => `Three days of football left and ${c.who} ${c.plural ? 'have' : 'has'} nothing to watch`,
  c => `First game of the week. First casualty: ${c.who}`,
  c => `${c.who} didn't make it to the weekend`,
];

const BLOWOUT_BUSTS: Array<(c: QuipContext) => string> = [
  c => `${c.who} didn't need the fourth quarter`,
  c => `It wasn't close, ${c.who}`,
  c => `${c.who} was cooked by halftime`,
  c => `The ${c.team} didn't even make it interesting for ${c.who}`,
];

const NAILBITER_BUSTS: Array<(c: QuipContext) => string> = [
  c => `${c.margin} point${c.margin === 1 ? '' : 's'}, ${c.who}. That'll sting`,
  c => `So close, ${c.who}. Still out`,
  c => `${c.who} lost by ${c.margin}. Somewhere, a missed kick`,
  c => `One score, ${c.who}. One whole score`,
];

/**
 * The pools a bust line can come from, with the weight each carries.
 *
 * Weighted rather than pooled flat: there is one joke for the team that let
 * someone down and two dozen non-sequiturs, so a flat pick would bury the
 * specific line under the generic ones. Every applicable pool gets a roughly
 * even share instead, which keeps the situational jokes landing as often as
 * the filler.
 */
export function bustPools(context: QuipContext): Array<{ weight: number; lines: string[] }> {
  const pools: Array<{ weight: number; lines: string[] }> = [];

  if (context.plural) {
    pools.push({ weight: 5, lines: GROUP_BUSTS.map(fn => fn(context)) });
  } else {
    // A line written for that person beats any generic one.
    const personal = PLAYER_BUSTS[playerKey(context.who)];
    if (personal) pools.push({ weight: 4, lines: personal });
  }

  const teamJoke = TEAM_JOKES[context.team];
  if (teamJoke) pools.push({ weight: 3, lines: [teamJoke(context)] });

  if (context.earlyWeek) {
    pools.push({ weight: 3, lines: EARLY_WEEK_BUSTS.map(fn => fn(context)) });
  }
  if (context.margin !== null && context.margin >= 17) {
    pools.push({ weight: 2, lines: BLOWOUT_BUSTS.map(fn => fn(context)) });
  }
  if (context.margin !== null && context.margin <= 3) {
    pools.push({ weight: 2, lines: NAILBITER_BUSTS.map(fn => fn(context)) });
  }

  if (!context.plural) {
    // Lock counts and survivor counts describe one person, not a group.
    const narrative = NARRATIVE.map(fn => fn(context)).filter((l): l is string => l !== null);
    if (narrative.length > 0) pools.push({ weight: 3, lines: narrative });
  }

  pools.push({ weight: 3, lines: GENERIC_BUSTS.map(fn => fn(context)) });
  pools.push({ weight: 3, lines: ABSURD });

  return pools;
}

/** A line for someone whose week just ended. */
export function bustQuip(context: QuipContext): string {
  return weighted(bustPools(context), context.seed);
}

const HITS: Array<(c: QuipContext) => string> = [
  c => `Annoyingly, ${c.who} ${c.plural ? 'were' : 'was'} right`,
  c => `Unfortunately for everyone, ${c.who} ${c.plural ? 'were' : 'was'} correct`,
  c => `${c.who} got away with one`,
  c => `Good call, ${c.who}. For now`,
  c => `${c.who} picked the favorite and the favorite won. Incredible scenes`,
  c => `${c.who} ${c.plural ? 'are' : 'is'} telling everyone about this`,
  c => `${c.who} ${c.plural ? 'have' : 'has'} never been more insufferable`,
  c => `Chalk held. ${c.who} ${c.plural ? 'are' : 'is'} taking full credit`,
  c => `${c.who} will bring this up unprompted`,
  c => `${c.who} ${c.plural ? 'are' : 'is'} already drafting the group chat message`,
  c => `Nothing happened, and ${c.who} ${c.plural ? 'are' : 'is'} thrilled`,
  c => `${c.who} did the bare minimum and it worked`,
  c => `${c.who} ${c.plural ? 'are' : 'is'} describing this as a read`,
  c => `${c.who} called it, apparently`,
  c => `${c.who} ${c.plural ? 'are' : 'is'} acting like that was hard`,
  c => `Somewhere ${c.who} ${c.plural ? 'are' : 'is'} nodding slowly`,
  c => `${c.who} ${c.plural ? 'are' : 'is'} pretending they were never worried`,
  c => `The favorite won. ${c.who} ${c.plural ? 'are' : 'is'} ${c.plural ? 'geniuses' : 'a genius'} now`,
  c => `${c.who} ${c.plural ? 'are' : 'is'} updating their personal brand`,
  c => `${c.who} ${c.plural ? 'are' : 'is'} explaining the logic to someone who did not ask`,
  c => `${c.who} ${c.plural ? 'have' : 'has'} decided this was skill`,
  c => `${c.who} ${c.plural ? 'are' : 'is'} telling the story like it was close`,
];

const PROGRESS: Array<(c: QuipContext) => string | null> = [
  c => (c.locksHit !== null && c.lockCount !== null && c.lockCount - c.locksHit === 1
    ? `${c.who} needs one more`
    : null),
  c => (c.locksHit !== null && c.lockCount !== null && c.lockCount > c.locksHit
    ? `${c.locksHit} down, ${c.lockCount - c.locksHit} to go for ${c.who}`
    : null),
  c => (c.locksHit !== null && c.lockCount !== null
    ? `That's ${c.locksHit} of ${c.lockCount} for ${c.who}`
    : null),
  c => (c.locksHit !== null && c.lockCount !== null && c.lockCount - c.locksHit === 1
    ? `${c.who} is one game from cashing`
    : null),
  c => (c.locksHit !== null && c.lockCount === c.locksHit
    ? `${c.who} is done. Full ticket, cashed`
    : null),
  c => (c.locksHit !== null && c.lockCount !== null && c.lockCount - c.locksHit >= 3
    ? `${c.who} has ${c.lockCount - c.locksHit} left and plenty of time to ruin it`
    : null),
];

/**
 * Jokes tied to a specific player.
 *
 * Keyed on the name as stored, and only used when a line is about one person.
 * An unknown name simply has no entry and falls through to the general pools.
 */
const PLAYER_BUSTS: Record<string, string[]> = {
  Dakota: [
    'How many weeks until Dakota gives up?',
    'Dakota is one bad week from retiring',
    'Give Dakota two more weeks, tops',
    'Dakota is reconsidering the whole enterprise',
    'Somebody check whether Dakota is still in this league',
    "Dakota's commitment is now a countdown",
  ],
  David: [
    'Welcome to the league, David',
    'David is finding out what this game actually is',
    'Rookie mistake, David',
    'David, this is the part everyone warned you about',
    'First season lessons, David',
    'David has officially been initiated',
  ],
};

const PLAYER_HITS: Record<string, string[]> = {
  Jihoo: [
    'Unc still got it',
    'Reigning champ for a reason',
    'Unc does not miss',
    'Respect your elders',
    'Unc has been doing this since before the rest of you could read a spread',
    'The old man is not done yet',
  ],
  Chris: [
    'Chris is looking in the mirror hyping himself up right now',
    'Chris is telling himself he is the man',
    'Chris has entered his own highlight reel',
    'Somebody take the mirror away from Chris',
  ],
  Dakota: [
    'Luckily Dakota remembered to submit this week',
    'Dakota submitted picks and hit one. Big day',
    'Dakota showed up. Note the date',
    'Proof that Dakota is still playing',
    'Dakota remembered the app exists and it paid off',
  ],
  David: [
    "Beginner's luck for David",
    'David does not know enough to be scared yet',
    'Welcome to the league, David. Enjoy it while it lasts',
    'The rookie is doing fine, annoyingly',
    'David has no idea how unlikely this is',
  ],
};

/**
 * Names are stored in full ("Dakota Racine"), and the jokes are keyed on the
 * first name so a surname does not quietly disable someone's material.
 */
function playerKey(who: string): string {
  return who.trim().split(/\s+/)[0];
}

/**
 * Non-sequiturs for a lock that landed.
 *
 * Kept separate from the bust pool because the two are not interchangeable.
 * This league backs favorites, so a bust means the favorite lost — "the line
 * knew" and "math was right there" describe a hit, and would be plain wrong
 * attached to a loss.
 */
const ABSURD_HITS: string[] = [
  'The favorite was favored for a reason',
  'The line knew. The line always knows',
  'Math was right there the whole time',
  'The safe pick was safe. Thrilling',
  'Water found its way downhill again',
  'The heavy thing fell down. Astonishing',
  'Nothing surprising happened to anybody',
  'You went to Home Depot looking for a tool, and you founnd it',
  'You show up to a party and everyone\'s wearing party hats',
  'It\'s like taking candy from a baby',
  'King\'s don\'t sleep on twin beds'
];

/**
 * The pools a hit line can come from.
 *
 * Player-specific jokes get the heaviest weight when one exists, because a
 * line written for that person is always better than a generic one — and only
 * when the line is about a single player, since "Unc still got it" makes no
 * sense aimed at a pair.
 */
export function hitPools(context: QuipContext): Array<{ weight: number; lines: string[] }> {
  const pools: Array<{ weight: number; lines: string[] }> = [];

  if (context.plural) {
    pools.push({ weight: 5, lines: GROUP_HITS.map(fn => fn(context)) });
  } else {
    const personal = PLAYER_HITS[playerKey(context.who)];
    if (personal) pools.push({ weight: 4, lines: personal });

    const progress = PROGRESS.map(fn => fn(context)).filter((l): l is string => l !== null);
    if (progress.length > 0) pools.push({ weight: 4, lines: progress });
  }

  pools.push({ weight: 3, lines: HITS.map(fn => fn(context)) });
  pools.push({ weight: 2, lines: ABSURD_HITS });

  return pools;
}

/** A line for a rival who is still standing. */
export function hitQuip(context: QuipContext): string {
  return weighted(hitPools(context), context.seed);
}

const OWN_LOSSES: Array<(c: QuipContext) => string> = [
  c => `Your ${c.team} let you down`,
  c => `The ${c.team} did not hold up their end`,
  c => `You had the ${c.team}. You no longer have a week`,
  c => `The ${c.team} owed you one. They did not pay`,
  c => `Should have left the ${c.team} alone`,
  c => `Your week died with the ${c.team}`,
  c => `You trusted the ${c.team}. That was the error`,
  c => `The ${c.team} took your week with them`,
  c => `Somewhere a ${c.team} fan is delighted. You are not`,
  c => 'Nothing left to sweat. Enjoy the football',
];

const OWN_HITS: Array<(c: QuipContext) => string> = [
  c => `${c.team} delivered`,
  c => 'That one lived. Do not get comfortable',
  c => `The ${c.team} did not betray you. This time`,
  c => 'One down. Plenty of time for it to fall apart',
  c => `The ${c.team} held up their end. Suspicious`,
  c => 'You were right, which proves nothing',
  c => `Credit to the ${c.team}, grudgingly`,
];

const GROUP_HITS: Array<(c: QuipContext) => string> = [
  c => `${c.who} all cashed that one`,
  c => `Everyone holding the ${c.team} is fine`,
  c => `${c.who} are all still alive. Annoying`,
  c => `A good day for ${c.who}`,
  c => `${c.who} made the same pick and it worked`,
  c => `${c.who} are becoming indistinguishable`,
  c => `The chalk held for ${c.who}`,
  c => `${c.who} celebrating together. Grim`,
  c => `Same ticket, same result, ${c.who}`,
];

const GROUP_BUSTS: Array<(c: QuipContext) => string> = [
  c => `${c.who} go down together`,
  c => `Same pick, same fate: ${c.who}`,
  c => `${c.who} are out. Collectively`,
  c => `The ${c.team} took ${c.who} with them`,
  c => `A group effort from ${c.who}`,
  c => `${c.who} all had the ${c.team}. ${c.who} are all done`,
  c => `Turns out copying each other has a downside, ${c.who}`,
  c => `One game, multiple casualties: ${c.who}`,
];

/** Lines for a game a player locked getting under way. */
const STARTS: Array<(c: QuipContext) => string> = [
  c => 'No going back now',
  c => 'This is the part where you sweat',
  c => `You picked the ${c.team}. Now watch them`,
  c => `Everything is fine until the ${c.team} touch the ball`,
  c => `${c.team} kickoff. Try to stay calm`,
  c => 'Too late to change your mind',
  c => `The ${c.team} are now your problem`,
  c => 'Whatever happens next is your own fault',
  c => 'Kickoff. Nothing you do from here matters',
  c => 'You have made your choices. Live with them',
  c => `The ${c.team} have been handed your week. Good luck`,
  c => 'Sit down. It is out of your hands',
];

export function startPools(context: QuipContext): Array<{ weight: number; lines: string[] }> {
  return [
    { weight: 3, lines: STARTS.map(fn => fn(context)) },
    { weight: 2, lines: ABSURD_ANY },
  ];
}

export function startQuip(context: QuipContext): string {
  return weighted(startPools(context), context.seed);
}

/** Lines nudging someone who has not submitted. */
const REMINDERS: string[] = [
  'Everyone else is deciding. You are not',
  'Kickoff is coming whether you pick or not',
  'An empty ticket scores exactly nothing',
  'Still time to have an opinion',
  'Consider yourself reminded',
  'Your ticket is blank and time is not',
  'Do you want points or not',
  'The slate does not wait for you',
  'Still undecided, apparently',
  'This is the easy part and you have not done it',
];

export function reminderPools(): Array<{ weight: number; lines: string[] }> {
  return [
    { weight: 3, lines: REMINDERS },
    { weight: 2, lines: ABSURD_ANY },
  ];
}

export function reminderQuip(seed: string): string {
  return weighted(reminderPools(), seed);
}

/** Lines for the player's own result. */
export function ownPools(context: QuipContext, hit: boolean): Array<{ weight: number; lines: string[] }> {
  return [
    { weight: 3, lines: (hit ? OWN_HITS : OWN_LOSSES).map(fn => fn(context)) },
    // A loss can reach the loss-flavored lines too; a hit cannot.
    { weight: 2, lines: hit ? ABSURD_ANY : ABSURD },
  ];
}

export function ownQuip(context: QuipContext, hit: boolean): string {
  return weighted(ownPools(context, hit), context.seed);
}

/**
 * Short sign-offs appended after the facts in an alert body.
 *
 * The title carries the joke and the body carries the score, so these stay
 * deliberately tiny — enough to keep the tone consistent without pushing the
 * actual information off a lock screen.
 */
const CLOSERS: string[] = [
  'The board remembers.',
  'Noted for posterity.',
  'Make of that what you will.',
  'This has been football.',
  'Such is the slate.',
  'File it away.',
  'As foretold.',
  'No notes.',
  'Grim.',
  'Wonderful.',
  'Perfect. No issues.',
  'Nothing to be done.',
];

export function closer(seed: string): string {
  return pick(CLOSERS, seed);
}

/**
 * The confirmation alert someone gets when switching notifications on.
 *
 * Random rather than seeded: pressing the test button twice should look like
 * something happened, not like nothing changed.
 */
const TEST_ALERTS: Array<{ title: string; body: string }> = [
  { title: 'Notifications are on', body: 'This is what one looks like. They get worse from here.' },
  { title: 'You are now reachable', body: 'Every bust, every near miss. You asked for this.' },
  { title: 'The bell is installed', body: "You will now hear about other people's mistakes. And your own." },
  { title: 'It works', body: 'Sorry in advance for every Sunday from here on.' },
  { title: 'Congratulations', body: 'You have successfully signed up for bad news, delivered promptly.' },
  { title: 'Testing, testing', body: 'If you are reading this, the pipeline is intact and you are doomed.' },
];

export function testAlert(): { title: string; body: string } {
  return TEST_ALERTS[Math.floor(Math.random() * TEST_ALERTS.length)];
}
