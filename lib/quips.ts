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
  c => `And then there were fewer — ${c.who} out`,
  c => `Pack it up, ${c.who}`,
  c => `Better luck next week, ${c.who}`,
  c => `That's the ballgame for ${c.who}`,
  c => `${c.who} can stop watching now`,
  c => `RIP ${c.who}'s week`,
  c => `${c.who} ${c.plural ? 'are' : 'is'} officially spectating`,
  c => `Somebody tell ${c.who} it's over`,
  c => `${c.who}: eliminated, with feeling`,
  c => `The ${c.team} said no to ${c.who}`,
  c => `${c.who} backed the ${c.team}. Bold. Wrong`,
  c => `Down goes ${c.who}`,
  c => `${c.who} ${c.plural ? 'were' : 'was'} this close. ${c.plural ? 'They' : 'Not'} close enough`,
];

/**
 * Non-sequiturs. The body carries the facts, so the title is free to be
 * nonsense — and a lock screen that says "not every chicken lays eggs" is
 * funnier than one that says "Ryan out".
 */
const ABSURD: string[] = [
  "You can't smother yourself in honey and expect the bear to respect your personal space",
  'The Home Depot showers are for display only, not for use',
  'Who taught you how to shovel!?',
  'Not every chicken lays eggs',
  'A ladder is just a staircase that gave up',
  'You do not bring a canoe to a thunderstorm',
  'Some doors are just walls with ambition',
  'Never trust a man who irons his socks',
  'The vending machine does not negotiate',
  'You cannot sharpen a spoon and call it a plan',
  'This is why they print instructions on shampoo',
  'The escalator was fine until you looked at it',
  'Nobody has ever won an argument with a goose',
  'Two umbrellas do not make a roof',
  'The microwave clock has never once been correct',
  'You brought a fork to a soup',
  'Wet cement remembers everything',
  'The bees were never on your side',
  'Salt is not a personality',
  'Nobody asked the ostrich',
  'A map is not the territory and neither is your ticket',
  'You cannot fold a fitted sheet either',
  'Every barn is a house for something',
  'The lawn does not care that you tried',
  'A borrowed ladder always leans the wrong way',
  'You cannot outrun a smell',
  'The second pancake knows what it did',
  'Every rope is just a snake that got organized',
  'The tide does not check the schedule',
  'A hammer has never once apologized',
  'You do not name a cow you plan to eat',
  'Who gave you a library card?',
  'Who let you near a thermostat?',
  'Were you raised by a vending machine?',
  'What do you mean you had a feeling?',
  "Somebody check this man's tire pressure",
  'That was the employee bathroom',
  'Those plants are plastic and you watered them',
  'A goat will eat the receipt',
  'Geese remember faces. Yours especially',
  'Not every moth wants the light',
  'Raccoons have never had a plan and they are doing fine',
  'The squirrel buried it and forgot. Same as you',
  "A possum's best move is lying down. Take notes",
  'Owls are not wise, they are just quiet',
  'Deer have no concept of insurance',
  'Somewhere a clock is wrong and nobody will fix it',
  'Nothing is load-bearing if you believe hard enough',
  'The odds were posted. You chose vibes',
  'Confidence is not a strategy, but it is a personality',
  'This is the sort of thing that happens on a Tuesday',
  'Somewhere, a dad is shaking his head',
  'A hot dog is a sandwich and you are out',
  'Milk goes bad. So does a ticket',
  "Nobody's second bowl of cereal is as good as the first",
  'You put the ketchup in the fridge, did you not',
  'The soup was never going to be that hot',
];

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
  const pools = bustPools(context);
  const total = pools.reduce((sum, pool) => sum + pool.weight, 0);

  let choice = hash(context.seed) % total;
  for (const pool of pools) {
    if (choice < pool.weight) {
      // A second hash so the line within a pool is not tied to the pool draw.
      return pool.lines[hash(context.seed + '#') % pool.lines.length];
    }
    choice -= pool.weight;
  }

  return pools[pools.length - 1].lines[0];
}

const HITS: Array<(c: QuipContext) => string> = [
  c => `${c.who} survives`,
  c => `Still alive: ${c.who}`,
  c => `${c.who} cashed that one`,
  c => `The ${c.team} came through for ${c.who}`,
  c => `${c.who} ${c.plural ? 'are' : 'is'} still breathing`,
  c => `Annoyingly, ${c.who} ${c.plural ? 'were' : 'was'} right`,
  c => `${c.who} lives to lock another day`,
  c => `Good call, ${c.who}. For now`,
  c => `The ${c.team} held. ${c.who} ${c.plural ? 'live' : 'lives'} on`,
  c => `Unfortunately for everyone, ${c.who} ${c.plural ? 'were' : 'was'} correct`,
  c => `${c.who} ${c.plural ? 'are' : 'is'} not dead yet`,
  c => `One down for ${c.who}. Plenty left to go wrong`,
  c => `${c.who} got away with one`,
  c => `Chalk one up for ${c.who}`,
];

/** A line for a rival who is still standing. */
export function hitQuip(context: QuipContext): string {
  return pick(HITS.map(fn => fn(context)), context.seed);
}

const OWN_LOSSES: Array<(c: QuipContext) => string> = [
  c => `Your ${c.team} let you down`,
  c => `That's your week`,
  c => `The ${c.team} did not hold up their end`,
  c => 'Week over. Sorry',
  c => `You had the ${c.team}. You no longer have a week`,
  c => `The ${c.team} owed you one. They did not pay`,
  c => 'That is your slate, gone',
  c => `Should have left the ${c.team} alone`,
  c => 'Nothing left to sweat this week',
];

const OWN_HITS: Array<(c: QuipContext) => string> = [
  c => `${c.team} delivered`,
  c => 'Lock hit. Still alive',
  c => `That's one. The ${c.team} held`,
  c => 'One down, still breathing',
  c => `The ${c.team} did their job`,
  c => 'Ticket still alive',
  c => `Nice hold from the ${c.team}`,
];

/** Lines for the player's own result. */
export function ownQuip(context: QuipContext, hit: boolean): string {
  return pick((hit ? OWN_HITS : OWN_LOSSES).map(fn => fn(context)), context.seed);
}
