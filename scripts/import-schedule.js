const fs = require('fs');
const postgres = require('postgres');
const { DateTime } = require('luxon');

function loadEnv(path) {
  if (!fs.existsSync(path)) return {};

  return fs.readFileSync(path, 'utf8').split(/\r?\n/).reduce((env, line) => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].replace(/^"|"$/g, '');
    return env;
  }, {});
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseArgs(argv) {
  const args = {
    file: 'nfl_2026_schedule.csv',
    season: 2026,
  };

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--file') args.file = argv[++i];
    if (argv[i] === '--season') args.season = Number(argv[++i]);
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const localEnv = loadEnv('.env.local');
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || localEnv.DATABASE_URL || localEnv.POSTGRES_URL;

  if (!connectionString) {
    console.error('DATABASE_URL or POSTGRES_URL is required.');
    process.exit(1);
  }

  if (!fs.existsSync(args.file)) {
    console.error(`Schedule CSV not found: ${args.file}`);
    process.exit(1);
  }

  const lines = fs.readFileSync(args.file, 'utf8').trim().split(/\r?\n/);
  const rows = lines.slice(1);
  const sql = postgres(connectionString, { max: 1 });

  try {
    let upserted = 0;

    for (let index = 0; index < rows.length; index++) {
      const [weekRaw, , dateRaw, timeRaw, awayTeam, homeTeam] = parseCsvLine(rows[index]);
      const week = Number(weekRaw);
      const month = DateTime.fromFormat(dateRaw, 'MMMM d').month;
      const year = month === 1 || month === 2 ? args.season + 1 : args.season;
      const start = DateTime.fromFormat(`${dateRaw} ${year} ${timeRaw}`, 'MMMM d yyyy h:mm a', {
        zone: 'America/New_York',
      });

      if (!week || !start.isValid || !awayTeam || !homeTeam) {
        throw new Error(`Invalid schedule row ${index + 2}: ${rows[index]}`);
      }

      const id = args.season * 100000 + week * 1000 + index + 1;

      await sql`insert into games (id, season, week, starttime, hometeam, awayteam, winnerteam, status)
        values (${id}, ${args.season}, ${week}, ${start.toJSDate()}, ${homeTeam}, ${awayTeam}, null, 'scheduled')
        on conflict (id) do update set
          season = excluded.season,
          week = excluded.week,
          starttime = excluded.starttime,
          hometeam = excluded.hometeam,
          awayteam = excluded.awayteam,
          status = excluded.status`;

      upserted++;
    }

    const counts = await sql`
      select week, count(*)::int as games
      from games
      where season = ${args.season}
      group by week
      order by week
    `;

    console.log(`Upserted ${upserted} games for ${args.season}.`);
    console.table(counts);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
