'use client';

import { useEffect, useMemo, useState } from 'react';
import TeamLogo from '@/components/TeamLogo';
import { rankedBoard, ticketProbability, expectedPoints } from '@/lib/luck';

interface BuilderGame {
  id: number;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  homeMoneyline?: number | null;
  awayMoneyline?: number | null;
}

interface Props {
  games: BuilderGame[];
  week: number | null;
  /** The viewer's real picks, so the builder opens on their actual ticket. */
  myPicks: Array<{ gameId: number; pickedTeam: string }>;
}

/** gameId -> the team taken in that game. */
type Selection = Record<number, string>;

export default function TicketBuilder({ games, week, myPicks }: Props) {
  const board = useMemo(() => rankedBoard(games), [games]);

  const initial = useMemo<Selection>(() => {
    const picked: Selection = {};
    for (const pick of myPicks) picked[Number(pick.gameId)] = pick.pickedTeam;
    return picked;
  }, [myPicks]);

  const [selection, setSelection] = useState<Selection>(initial);

  // Follow the real ticket as it changes, e.g. picks being made on the page.
  useEffect(() => setSelection(initial), [initial]);

  const toggle = (gameId: number, team: string) => {
    setSelection((current) => {
      const next = { ...current };
      if (next[gameId] === team) delete next[gameId];
      else next[gameId] = team;
      return next;
    });
  };

  // Only offer a way back once the ticket actually differs from the real one.
  const changed = JSON.stringify(selection) !== JSON.stringify(initial);

  const chosen = board.filter(entry => selection[entry.game.id]);
  const probabilities = chosen.map(entry =>
    selection[entry.game.id] === entry.game.homeTeam ? entry.homeProbability : entry.awayProbability
  );

  const survives = ticketProbability(probabilities) * 100;
  const expected = expectedPoints(probabilities);

  // The strongest ticket of the same length: the n safest favourites.
  const bestSameSize = board.slice(0, chosen.length).map(e => e.bestProbability);
  const bestExpected = expectedPoints(bestSameSize);
  const gap = expected - bestExpected;

  if (board.length === 0) return null;

  const stat = (label: string, value: string, tone = '') => (
    <div className="rounded-lg bg-raised py-2.5 text-center">
      <div className={`num text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">Week {week}. Tap teams to try a different ticket; your real picks don&apos;t change.</p>
        {changed && (
          <button onClick={() => setSelection(initial)} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">
            Back to my picks
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {stat('Locks', String(chosen.length))}
        {stat('Hits all', chosen.length > 0 ? `${survives.toFixed(1)}%` : '—', 'text-gold')}
        {stat('Exp. points', chosen.length > 0 ? expected.toFixed(2) : '—')}
      </div>

      {chosen.length > 0 && (
        <p className="rounded-lg bg-gold-soft px-3 py-2 text-xs">
          {Math.abs(gap) < 0.005 ? (
            <>This is the strongest {chosen.length}-lock ticket on the board.</>
          ) : (
            <>
              The safest {chosen.length} games are worth <strong>{bestExpected.toFixed(2)}</strong> expected
              points, so this ticket gives up <strong>{Math.abs(gap).toFixed(2)}</strong>. Worth it only if
              you need to finish somewhere the pack will not.
            </>
          )}
        </p>
      )}

      <div className="space-y-1.5">
        {board.map((entry, index) => {
          const game = entry.game;
          const taken = selection[game.id];
          const side = (team: string, probability: number) => (
            <button
              onClick={() => toggle(game.id, team)}
              className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                taken === team ? 'border-gold bg-gold-soft font-semibold' : 'border-line bg-raised text-muted hover:text-text'
              }`}
            >
              <TeamLogo team={team} size="sm" className="scale-75" />
              <span className="truncate">{team.split(' ').pop()}</span>
              <span className="num ml-auto">{(probability * 100).toFixed(0)}%</span>
            </button>
          );

          return (
            <div key={game.id} className="flex items-center gap-1.5">
              <span className="num w-5 shrink-0 text-[10px] text-muted">{index + 1}</span>
              {side(game.awayTeam, entry.awayProbability)}
              <span className="text-[10px] text-muted">@</span>
              {side(game.homeTeam, entry.homeProbability)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
