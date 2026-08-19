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
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || localEnv.DATABASE_URL || localEnv.POSTGRES_URL;

if (!connectionString) {
  console.error('DATABASE_URL or POSTGRES_URL is required.');
  process.exit(1);
}

async function main() {
  const sql = postgres(connectionString, { max: 1 });

  try {
    await sql`create table if not exists users (
      id serial primary key,
      name text not null unique,
      passwordhash text
    )`;

    await sql`alter table users add column if not exists passwordhash text`;

    await sql`create table if not exists games (
      id bigint primary key,
      season integer not null,
      week integer not null,
      starttime timestamp with time zone not null,
      hometeam text not null,
      awayteam text not null,
      winnerteam text,
      status text not null default 'scheduled'
    )`;

    await sql`create table if not exists picks (
      userid integer references users(id),
      gameid bigint references games(id),
      pickedteam text not null,
      week integer not null,
      season integer not null,
      createdat timestamp with time zone not null default now(),
      primary key (userid, gameid)
    )`;

    await sql`create table if not exists weeklyscores (
      userid integer references users(id),
      season integer not null,
      week integer not null,
      points integer not null,
      computedat timestamp with time zone not null default now(),
      primary key (userid, season, week)
    )`;

    await sql`insert into users (id, name) values
      (1, 'Victor'),
      (2, 'Mihir'),
      (3, 'Dakota'),
      (4, 'Chris'),
      (5, 'Ryan'),
      (6, 'Jihoo')
      on conflict (name) do nothing`;

    await sql`select setval('users_id_seq', greatest((select max(id) from users), 1), true)`;

    const tables = await sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`;
    console.log(`Initialized tables: ${tables.map((row) => row.table_name).join(', ')}`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
