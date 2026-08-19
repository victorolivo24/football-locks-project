import type { Config } from 'drizzle-kit';
import { existsSync, readFileSync } from 'fs';

if (existsSync('.env.local')) {
  var lines = readFileSync('.env.local', 'utf8').split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^"|"$/g, '');
  }
}

var connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL or POSTGRES_URL is required');
}

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString,
  },
} satisfies Config;
