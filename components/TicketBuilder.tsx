'use client';

import { useMemo, useState } from 'react';
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
  const [open, setOpen] = useState(false);

  const toggle = (gameId: number, team: string) => {
    setSelection((current) => {
      const next = { ...current };
      if (next[gameId] === team) delete next[gameId];
      else next[gameId] = team;
      return next;
    });
  };

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

  // Strictly a look-back. Before the slate starts this would be a cheat sheet
  // for picks that have not locked yet, so it stays hidden until kickoff.
  const kickedOff = board.some(entry => new Date(entry.game.startTime).getTime() <= Date.now());
  if (board.length === 0 || !kickedOff) return null;

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🎛️</span>
            <h2 className="text-xl font-bold text-white">Build a Ticket</h2>
          </div>
          <p className="text-xs text-green-200/80 mt-1">
            Your Week {week} ticket. Swap games to see what a different slate would have been worth.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setSelection(initial)}
            className="text-xs font-semibold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={() => setOpen(!open)}
            className="text-xs font-bold text-yellow-300 bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/30 px-3 py-1.5 rounded-lg transition-colors"
          >
            {open ? 'Hide board' : 'Pick games'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-black/20 rounded-xl border border-white/5 p-3 text-center">
          <div className="text-[10px] uppercase font-semibold text-white/60">Locks</div>
          <div className="text-2xl font-black text-white">{chosen.length}</div>
        </div>
        <div className="bg-black/20 rounded-xl border border-white/5 p-3 text-center">
          <div className="text-[10px] uppercase font-semibold text-white/60">Survives</div>
          <div className="text-2xl font-black text-green-300">
            {chosen.length > 0 ? `${survives.toFixed(1)}%` : '—'}
          </div>
        </div>
        <div className="bg-black/20 rounded-xl border border-white/5 p-3 text-center">
          <div className="text-[10px] uppercase font-semibold text-white/60">Expected</div>
          <div className="text-2xl font-black text-yellow-300">
            {chosen.length > 0 ? expected.toFixed(2) : '—'}
          </div>
        </div>
      </div>

      {chosen.length > 0 && (
        <div className="p-3 bg-black/20 rounded-xl border border-white/5 text-xs text-green-200/90 flex items-start space-x-2">
          <span>💡</span>
          <span>
            {Math.abs(gap) < 0.005 ? (
              <>This is the strongest {chosen.length}-lock ticket on the board.</>
            ) : (
              <>
                The safest {chosen.length} games are worth <strong>{bestExpected.toFixed(2)}</strong> expected
                points, so this ticket gives up <strong>{Math.abs(gap).toFixed(2)}</strong>. Worth it only if
                you need to finish somewhere the pack will not.
              </>
            )}
          </span>
        </div>
      )}

      {open && (
        <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
          {board.map((entry, index) => {
            const game = entry.game;
            const taken = selection[game.id];
            const side = (team: string, probability: number) => {
              const active = taken === team;
              return (
                <button
                  onClick={() => toggle(game.id, team)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs transition-colors min-w-0 ${
                    active
                      ? 'bg-yellow-400/20 border-yellow-400/60 text-white font-bold'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <TeamLogo team={team} size="sm" className="scale-75" />
                  <span className="truncate">{team.split(' ').pop()}</span>
                  <span className="text-[10px] text-green-200/70">{(probability * 100).toFixed(0)}%</span>
                </button>
              );
            };

            return (
              <div
                key={game.id}
                className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-2 py-1.5 border border-white/5"
              >
                <span className="text-[10px] text-white/30 w-5 shrink-0">#{index + 1}</span>
                {side(game.awayTeam, entry.awayProbability)}
                <span className="text-[10px] text-white/30">@</span>
                {side(game.homeTeam, entry.homeProbability)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
