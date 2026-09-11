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
 * A line for someone whose week just ended.
 *
 * Weighted toward the situational jokes when a situation exists: a three point
 * loss on a Thursday is funnier than a generic farewell, so those pools are
 * offered first and the generic set is the fallback.
 */
export function bustQuip(context: QuipContext): string {
  const candidates: string[] = [];

  const teamJoke = TEAM_JOKES[context.team];
  if (teamJoke) candidates.push(teamJoke(context));

  if (context.earlyWeek) candidates.push(...EARLY_WEEK_BUSTS.map(fn => fn(context)));
  if (context.margin !== null && context.margin >= 17) {
    candidates.push(...BLOWOUT_BUSTS.map(fn => fn(context)));
  }
  if (context.margin !== null && context.margin <= 3) {
    candidates.push(...NAILBITER_BUSTS.map(fn => fn(context)));
  }

  candidates.push(...GENERIC_BUSTS.map(fn => fn(context)));

  return pick(candidates, context.seed);
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
