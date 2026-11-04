'use client';

import TeamLogo from '@/components/TeamLogo';
import type { BoardGame } from '@/lib/luck';

interface BoardTeams {
  id: number;
  homeTeam: string;
  awayTeam: string;
}

/** gameId -> the team taken in that game. */
export type Selection = Record<number, string>;

/** The week's priced games, safest first, with one tappable side each. */
export default function PickBoard({
  board,
  selection,
  onToggle,
}: {
  board: BoardGame<BoardTeams>[];
  selection: Selection;
  onToggle: (gameId: number, team: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      {board.map((entry, index) => {
        const game = entry.game;
        const taken = selection[game.id];
        const side = (team: string, probability: number) => (
          <button
            onClick={() => onToggle(game.id, team)}
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
  );
}
