/**
 * How alike two players' tickets are.
 *
 * Worth knowing beyond the novelty: if you hold the leader's exact ticket you
 * cannot gain ground on them, so overlap is what decides whether a week can
 * actually move the standings.
 */

/** A pick identified by the game and the side taken. */
export function pickKey(pick: { gameId: number | null; pickedTeam: string }): string {
  return `${Number(pick.gameId)}:${pick.pickedTeam.trim().toLowerCase()}`;
}

/**
 * Share of the two players' combined picks that are identical, 0 to 1.
 *
 * Jaccard rather than raw overlap count, so a pair who each lock 3 of the
 * same games scores higher than one who happened to share 3 out of ten.
 */
export function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;

  const shared = sharedCount(a, b);
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

export function sharedCount(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  a.forEach((key) => {
    if (b.has(key)) shared++;
  });
  return shared;
}
