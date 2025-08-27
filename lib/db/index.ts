import { drizzle } from 'drizzle-orm/vercel-postgres';
import { sql } from '@vercel/postgres';
import * as schema from './schema';

export const db = drizzle(sql, { schema });

// Seed data for the 6 users
export const SEED_USERS = [
  { name: 'Victor' },
  { name: 'Mihir' },
  { name: 'Dakota' },
  { name: 'Chris' },
  { name: 'Ryan' },
  { name: 'Jihoo' },
] as const;

export type UserName = typeof SEED_USERS[number]['name'];
