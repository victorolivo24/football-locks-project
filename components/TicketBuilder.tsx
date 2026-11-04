'use client';

import { useEffect, useMemo, useState } from 'react';
import TeamLogo from '@/components/TeamLogo';
import { rankedBoard, ticketProbability, expectedPoints } from '@/lib/luck';
import { isSameTeam } from '@/lib/teams';
import { predictRanks, rankTickets, titleOddsAfterWeek, Leg, WeekPlayer } from '@/lib/rivals';

interface BuilderGame {
  id: number;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  homeMoneyline?: number | null;
  awayMoneyline?: number | null;
}

/** The slice of /api/odds a rival's guess and the season simulation need. */
interface FieldPlayer {
  userId: number;
  name: string;
  points: number;
  simulatedPace: number;
  winProb: number;
  correlation: number;
  rankShares: number[];
}

interface Props {
  games: BuilderGame[];
  season: number;
  week: number | null;
  /** The viewer, so their ticket is the one being ranked. */
  meId: number;
  /** The viewer's real picks, so the builder opens on their actual ticket. */
  myPicks: Array<{ gameId: number; pickedTeam: string }>;
  /** Everyone's real picks by name, once the viewer has submitted and can see them. */
  leaguePicks?: Record<string, Array<{ gameId: number; pickedTeam: string }>>;
}

/** gameId -> the team taken in that game. */
type Selection = Record<number, string>;

const toSelection = (picks: Array<{ gameId: number; pickedTeam: string }>): Selection => {
  const picked: Selection = {};
  for (const pick of picks) picked[Number(pick.gameId)] = pick.pickedTeam;
  return picked;
};

export default function TicketBuilder({ games, season, week, meId, myPicks, leaguePicks }: Props) {
  const board = useMemo(() => rankedBoard(games), [games]);

  const initial = useMemo(() => toSelection(myPicks), [myPicks]);
  const [selection, setSelection] = useState<Selection>(initial);

  // Follow the real ticket as it changes, e.g. picks being made on the page.
  useEffect(() => setSelection(initial), [initial]);

  // The field: standings, paces and tendencies. Fetched on open, not on page
  // load, so the simulator costs nothing until someone actually uses it.
  const [field, setField] = useState<{ players: FieldPlayer[]; remainingWeeks: number } | null>(null);
  useEffect(() => {
    if (!week) return;
    fetch(`/api/odds?season=${season}&week=${week}`, { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => data && setField({ players: data.odds, remainingWeeks: data.remainingWeeks }))
      .catch(() => undefined);
  }, [season, week]);

  const rivals = useMemo(() => (field?.players ?? []).filter(p => p.userId !== meId), [field, meId]);

  // What each rival is assumed to pick: their real ticket if it is visible,
  // otherwise a guess from how many games they usually take and which ranks.
  const guesses = useMemo(() => {
    const out: Record<number, { ticket: Selection; real: boolean }> = {};
    for (const rival of rivals) {
      const real = leaguePicks?.[rival.name];
      if (real && real.length > 0) {
        out[rival.userId] = { ticket: toSelection(real), real: true };
        continue;
      }
      const ticket: Selection = {};
      for (const rank of predictRanks(rival.rankShares, rival.simulatedPace)) {
        const entry = board[rank];
        if (entry) ticket[entry.game.id] = entry.homeProbability >= 0.5 ? entry.game.homeTeam : entry.game.awayTeam;
      }
      out[rival.userId] = { ticket, real: false };
    }
    return out;
  }, [rivals, leaguePicks, board]);

  const [rivalTickets, setRivalTickets] = useState<Record<number, Selection>>({});
  useEffect(() => {
    const next: Record<number, Selection> = {};
    for (const [userId, guess] of Object.entries(guesses)) next[Number(userId)] = guess.ticket;
    setRivalTickets(next);
  }, [guesses]);

  const [editing, setEditing] = useState<number>(meId);
  const editingMe = editing === meId;
  const current = editingMe ? selection : rivalTickets[editing] ?? {};

  const toggle = (gameId: number, team: string) => {
    const update = (ticket: Selection) => {
      const next = { ...ticket };
      if (next[gameId] === team) delete next[gameId];
      else next[gameId] = team;
      return next;
    };
    if (editingMe) setSelection(update);
    else setRivalTickets(all => ({ ...all, [editing]: update(all[editing] ?? {}) }));
  };

  // Only offer a way back once the ticket actually differs from the real one.
  const changed = JSON.stringify(selection) !== JSON.stringify(initial);

  const chosen = board.filter(entry => current[entry.game.id]);
  const probabilities = chosen.map(entry =>
    current[entry.game.id] === entry.game.homeTeam ? entry.homeProbability : entry.awayProbability
  );

  const survives = ticketProbability(probabilities) * 100;
  const expected = expectedPoints(probabilities);

  // The strongest ticket of the same length: the n safest favourites.
  const bestSameSize = board.slice(0, chosen.length).map(e => e.bestProbability);
  const bestExpected = expectedPoints(bestSameSize);
  const gap = expected - bestExpected;

  const gameById = useMemo(() => new Map(games.map(g => [Number(g.id), g])), [games]);
  const toLegs = (ticket: Selection): Leg[] =>
    Object.entries(ticket).flatMap(([gameId, team]) => {
      const game = gameById.get(Number(gameId));
      return game ? [{ gameId: Number(gameId), home: isSameTeam(team, game.homeTeam) }] : [];
    });

  // Rank my options against the field, by title chance once this week is played.
  const against = useMemo(() => {
    if (!field) return null;
    const me = field.players.find(p => p.userId === meId);
    if (!me) return null;

    const homeProb = new Map(board.map(e => [e.game.id, e.homeProbability]));
    const favourites: Leg[] = board.slice(0, 8).map(e => ({ gameId: e.game.id, home: e.homeProbability >= 0.5 }));
    const players: WeekPlayer[] = field.players.map(p => ({
      userId: p.userId,
      points: p.points,
      size: p.simulatedPace,
      winProb: p.winProb,
      correlation: p.correlation,
      ticket: p.userId === meId ? toLegs(selection) : toLegs(rivalTickets[p.userId] ?? {}),
    }));

    const mine = titleOddsAfterWeek(players, homeProb, field.remainingWeeks)[players.findIndex(p => p.userId === meId)];
    return { mine, ranked: rankTickets(meId, players, favourites, homeProb, field.remainingWeeks).slice(0, 6) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field, board, selection, rivalTickets, meId]);

  const load = (ticket: Leg[]) => {
    const next: Selection = {};
    for (const leg of ticket) {
      const game = gameById.get(leg.gameId);
      if (game) next[leg.gameId] = leg.home ? game.homeTeam : game.awayTeam;
    }
    setSelection(next);
    setEditing(meId);
  };

  if (board.length === 0) return null;

  const stat = (label: string, value: string, tone = '') => (
    <div className="rounded-lg bg-raised py-2.5 text-center">
      <div className={`num text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );

  const pct = (p: number) => `${(p * 100).toFixed(1)}%`;
  const logos = (ticket: Leg[]) => (
    <div className="flex -space-x-1">
      {ticket.map(leg => {
        const game = gameById.get(leg.gameId);
        return game && <TeamLogo key={leg.gameId} team={leg.home ? game.homeTeam : game.awayTeam} size="sm" className="scale-75" />;
      })}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">Week {week}. Tap teams to try a different ticket; your real picks don&apos;t change.</p>
        {editingMe && changed && (
          <button onClick={() => setSelection(initial)} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">
            Back to my picks
          </button>
        )}
      </div>

      {rivals.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {[{ userId: meId, name: 'Me' }, ...rivals].map(p => (
            <button
              key={p.userId}
              onClick={() => setEditing(p.userId)}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                editing === p.userId ? 'border-gold bg-gold-soft font-semibold' : 'border-line bg-raised text-muted'
              }`}
            >
              {p.name.split(' ')[0]}
              {p.userId !== meId && !guesses[p.userId]?.real && <span className="ml-1 opacity-60">?</span>}
            </button>
          ))}
        </div>
      )}

      {!editingMe && (
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <span>
            {guesses[editing]?.real
              ? 'Their real ticket. Change it to try a what-if.'
              : 'A guess from how many games they usually take, and which. Fix it if you know better.'}
          </span>
          <button
            onClick={() => setRivalTickets(all => ({ ...all, [editing]: Object.keys(all[editing] ?? {}).length ? {} : guesses[editing]?.ticket ?? {} }))}
            className="btn-ghost shrink-0 px-3 py-1.5 text-xs"
          >
            {Object.keys(current).length ? 'Clear' : 'Use guess'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {stat('Locks', String(chosen.length))}
        {stat('Hits all', chosen.length > 0 ? `${survives.toFixed(1)}%` : '—', 'text-gold')}
        {stat('Exp. points', chosen.length > 0 ? expected.toFixed(2) : '—')}
      </div>

      {editingMe && chosen.length > 0 && (
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
          const taken = current[game.id];
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

      <section className="space-y-2 border-t border-line pt-3">
        <div className="flex items-center justify-between">
          <h3 className="section-title">Against the field</h3>
          <span className="text-[11px] text-muted">title odds after this week</span>
        </div>
        {!field ? (
          <p className="text-xs text-muted">Sizing up the field…</p>
        ) : !against ? (
          <p className="text-xs text-muted">No standings yet this season.</p>
        ) : (
          <>
            <p className="text-xs text-muted">
              Your ticket, with everyone else on the tickets above:{' '}
              <span className="num font-semibold text-gold">{pct(against.mine)}</span>.
              Best plays from the safest eight games:
            </p>
            <div className="space-y-1">
              {against.ranked.map(row => (
                <button
                  key={row.ticket.map(l => l.gameId).join('-')}
                  onClick={() => load(row.ticket)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg bg-raised px-3 py-2 text-left hover:bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    <span className="num w-5 text-[10px] text-muted">{row.ticket.length}×</span>
                    {logos(row.ticket)}
                  </div>
                  <span className="num text-sm font-bold">{pct(row.odds)}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted">
              ? marks a guessed ticket. Tap a name above to set what you think they will pick.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
