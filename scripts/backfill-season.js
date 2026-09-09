/**
 * Backfill a completed season's games, results and closing odds from ESPN.
 *
 *   node scripts/backfill-season.js 2025
 *
 * Picks are NOT backfilled — they only exist in whatever record the league
 * kept. Import those separately via /api/admin/manual-picks once the games
 * are in place, then the scores and every market-based stat follow.
 *
 * Games are stored under ESPN's own event ids here. That is safe for a season
 * the app never seeded itself; do not point this at a season whose schedule
 * was imported from the CSV, or you will get duplicate rows.
 */
const fs = require('fs');
const postgres = require('postgres');

function loadEnv(path) {
  if (!fs.existsSync(path)) return {};
  return fs.readFileSync(path, 'utf8').split(/\r?\n/).reduce((env, line) => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].replace(/^"|"$/g, '');
    return env;
  }, {});
}

const localEnv = loadEnv('.env.local');
const connectionString =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || localEnv.DATABASE_URL || localEnv.POSTGRES_URL;

const season = Number(process.argv[2]);

if (!connectionString) {
  console.error('DATABASE_URL or POSTGRES_URL is required.');
  process.exit(1);
}
if (!Number.isFinite(season)) {
  console.error('Usage: node scripts/backfill-season.js <season>');
  process.exit(1);
}

const SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const CORE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWeek(week) {
  // ESPN spells the season year `dates`; a `year` param silently returns the
  // current season instead.
  const res = await fetch(`${SCOREBOARD}?dates=${season}&seasontype=2&week=${week}`);
  if (!res.ok) throw new Error(`scoreboard week ${week}: ${res.status}`);
  const data = await res.json();

  return (data.events || []).map((event) => {
    const competitors = event.competitions[0].competitors;
    return {
      id: Number(event.id),
      startTime: new Date(event.date),
      homeTeam: competitors.find((c) => c.homeAway === 'home').team.displayName,
      awayTeam: competitors.find((c) => c.homeAway === 'away').team.displayName,
      winnerTeam: competitors.find((c) => c.winner === true)?.team.displayName ?? null,
      status: event.status.type.state === 'post' ? 'final'
        : event.status.type.state === 'in' ? 'in_progress' : 'scheduled',
    };
  });
}

// Completed seasons drop odds from the scoreboard, so they come one game at a
// time from the core API instead.
async function fetchOdds(eventId) {
  const res = await fetch(`${CORE}/events/${eventId}/competitions/${eventId}/odds`);
  if (!res.ok) return null;
  const data = await res.json();
  const line = (data.items || [])[0];
  if (!line) return null;

  const american = (value) => (typeof value === 'number' && value !== 0 ? Math.round(value) : null);
  return {
    awayMoneyline: american(line.awayTeamOdds?.moneyLine),
    homeMoneyline: american(line.homeTeamOdds?.moneyLine),
    spread: typeof line.details === 'string' ? line.details : null,
    total: typeof line.overUnder === 'number' ? line.overUnder : null,
  };
}

async function main() {
  const sql = postgres(connectionString, { max: 1 });

  try {
    const existing = await sql`select count(*)::int c from games where season = ${season}`;
    if (existing[0].c > 0) {
      console.log(`Season ${season} already has ${existing[0].c} games; updating them in place.`);
    }

    let totalGames = 0;
    let totalPriced = 0;

    for (let week = 1; week <= 18; week++) {
      const games = await fetchWeek(week);

      for (const game of games) {
        await sql`
          insert into games (id, season, week, starttime, hometeam, awayteam, winnerteam, status)
          values (${game.id}, ${season}, ${week}, ${game.startTime}, ${game.homeTeam}, ${game.awayTeam}, ${game.winnerTeam}, ${game.status})
          on conflict (id) do update set
            starttime = excluded.starttime,
            hometeam = excluded.hometeam,
            awayteam = excluded.awayteam,
            winnerteam = coalesce(excluded.winnerteam, games.winnerteam),
            status = excluded.status`;

        const odds = await fetchOdds(game.id);
        if (odds && (odds.awayMoneyline !== null || odds.homeMoneyline !== null)) {
          await sql`
            insert into gameodds (gameid, season, week, awaymoneyline, homemoneyline, spread, total)
            values (${game.id}, ${season}, ${week}, ${odds.awayMoneyline}, ${odds.homeMoneyline}, ${odds.spread}, ${odds.total})
            on conflict (gameid) do update set
              awaymoneyline = excluded.awaymoneyline,
              homemoneyline = excluded.homemoneyline,
              spread = excluded.spread,
              total = excluded.total`;
          totalPriced++;
        }

        await sleep(60); // be gentle with ESPN
      }

      totalGames += games.length;
      console.log(`  week ${String(week).padStart(2)}: ${games.length} games`);
    }

    console.log(`\nSeason ${season}: ${totalGames} games stored, ${totalPriced} priced.`);
    console.log('Picks are not included — import those via /api/admin/manual-picks.');
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
