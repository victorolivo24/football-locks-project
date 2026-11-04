/**
 * Picking against the field.
 *
 * Expected points treats a ticket in a vacuum. It is not: the player a point
 * behind needs a bigger week than the leader does, and anyone sharing the
 * leader's games can never gain on them. This models one week exactly, with
 * everyone's assumed ticket on the same coin flips, then hands each possible
 * standings table to the season simulator for the weeks that remain.
 */
import { makeRng, simulateSeason, SeasonPlayer } from './simulate';

/** One lock: a game and which side was taken. */
export interface Leg {
  gameId: number;
  home: boolean;
}

/** A player's standing, their assumed ticket this week, and their future-week shape. */
export interface WeekPlayer extends SeasonPlayer {
  ticket: Leg[];
}

/** The home side's fair win probability for every priced game this week. */
export type HomeProbabilities = Map<number, number>;

/**
 * Share of a player's past weeks in which they took each board rank, safest
 * first. [1, 0.67, 0.33] reads: always the safest game, usually the second,
 * sometimes the third.
 */
export function rankShares(ranksByWeek: number[][], maxRank = 8): number[] {
  const shares = new Array(maxRank).fill(0);
  if (ranksByWeek.length === 0) return shares;
  for (const ranks of ranksByWeek) {
    for (const rank of ranks) if (rank < maxRank) shares[rank] += 1 / ranksByWeek.length;
  }
  return shares;
}

/**
 * The ranks a player most often takes, as many as their ticket size. Ties go
 * to the safer game, so someone with no history is predicted on the chalk.
 */
export function predictRanks(shares: number[], size: number): number[] {
  return shares
    .map((share, rank) => ({ share, rank }))
    .sort((a, b) => b.share - a.share || a.rank - b.rank)
    .slice(0, Math.max(0, size))
    .map(entry => entry.rank)
    .sort((a, b) => a - b);
}

/**
 * Every way this week can go for the tickets in play, with its probability
 * and who survives. Enumerated over the union of locked games, so two players
 * on the same game rise and fall on the same result, and players on opposite
 * sides can never both hit.
 */
export function weekOutcomes(
  players: WeekPlayer[],
  homeProb: HomeProbabilities
): Array<{ probability: number; hits: boolean[] }> {
  const gameIds = Array.from(new Set(players.flatMap(p => p.ticket.map(l => l.gameId))));
  // ponytail: 2^n enumeration; sample instead if the league ever locks 20+ distinct games.
  const bit = new Map(gameIds.map((id, i) => [id, 1 << i]));

  // Each ticket is "these bits must match": the games it covers, and which of
  // them must come up home.
  const masks = players.map(p => {
    let required = 0;
    let wanted = 0;
    for (const leg of p.ticket) {
      required |= bit.get(leg.gameId)!;
      if (leg.home) wanted |= bit.get(leg.gameId)!;
    }
    return { required, wanted, empty: p.ticket.length === 0 };
  });

  const outcomes: Array<{ probability: number; hits: boolean[] }> = [];
  for (let mask = 0; mask < 1 << gameIds.length; mask++) {
    let probability = 1;
    gameIds.forEach((id, i) => {
      const home = homeProb.get(id) ?? 0.5;
      probability *= mask & (1 << i) ? home : 1 - home;
    });
    outcomes.push({
      probability,
      hits: masks.map(m => !m.empty && (mask & m.required) === m.wanted),
    });
  }
  return outcomes;
}

const RUNS = 2000;
const SEED = 20261103;

/**
 * Each player's title chance once this week has been played, 0 to 1.
 *
 * Every possible outcome of the week yields a standings table; the season
 * simulator plays the remaining weeks out from each, weighted by how likely
 * that outcome was. Tables are memoised, as most outcomes produce the same few.
 */
export function titleOddsAfterWeek(
  players: WeekPlayer[],
  homeProb: HomeProbabilities,
  remainingWeeks: number,
  cache: Map<string, number[]> = new Map()
): number[] {
  const odds = players.map(() => 0);

  for (const outcome of weekOutcomes(players, homeProb)) {
    if (outcome.probability === 0) continue;
    const points = players.map((p, i) => p.points + (outcome.hits[i] ? p.ticket.length : 0));
    const key = points.join(',');

    let shares = cache.get(key);
    if (!shares) {
      const after = players.map((p, i) => ({ ...p, points: points[i] }));
      const wins = simulateSeason(after, remainingWeeks, RUNS, makeRng(SEED));
      shares = players.map(p => (wins.get(p.userId) ?? 0) / RUNS);
      cache.set(key, shares);
    }

    shares.forEach((share, i) => { odds[i] += share * outcome.probability; });
  }

  return odds;
}

export interface RankedTicket {
  ticket: Leg[];
  /** Title chance after this week, 0 to 1. */
  odds: number;
}

/** Subsets of the safest favourites, up to maxSize locks, as candidate tickets. */
export function candidateTickets(favourites: Leg[], maxSize = 6): Leg[][] {
  const tickets: Leg[][] = [];
  for (let mask = 1; mask < 1 << favourites.length; mask++) {
    const ticket = favourites.filter((_, i) => mask & (1 << i));
    if (ticket.length <= maxSize) tickets.push(ticket);
  }
  return tickets;
}

/**
 * Rank the viewer's candidate tickets by title chance, given everyone else's
 * assumed ticket. Best first.
 */
export function rankTickets(
  me: number,
  players: WeekPlayer[],
  favourites: Leg[],
  homeProb: HomeProbabilities,
  remainingWeeks: number
): RankedTicket[] {
  const index = players.findIndex(p => p.userId === me);
  if (index < 0) return [];

  const cache = new Map<string, number[]>();
  return candidateTickets(favourites)
    .map(ticket => {
      const field = players.map((p, i) => (i === index ? { ...p, ticket } : p));
      return { ticket, odds: titleOddsAfterWeek(field, homeProb, remainingWeeks, cache)[index] };
    })
    .sort((a, b) => b.odds - a.odds || a.ticket.length - b.ticket.length);
}
