import { pgTable, serial, text, integer, bigint, timestamp, boolean } from 'drizzle-orm/pg-core';

// Users table - fixed set of 6 friends
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
});

// NFL Games table
export const games = pgTable('games', {
  id: bigint('id', { mode: 'number' }).primaryKey(), // ESPN event id
  season: integer('season').notNull(),
  week: integer('week').notNull(),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  homeTeam: text('home_team').notNull(),
  awayTeam: text('away_team').notNull(),
  winnerTeam: text('winner_team'), // null until resolved
  status: text('status').notNull().default('scheduled'), // scheduled|in_progress|final
});

// Picks table - one row per user per game
export const picks = pgTable('picks', {
  userId: integer('user_id').references(() => users.id),
  gameId: bigint('game_id', { mode: 'number' }).references(() => games.id),
  pickedTeam: text('picked_team').notNull(),
  week: integer('week').notNull(),
  season: integer('season').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: { primaryKey: [table.userId, table.gameId] },
}));

// Weekly scores table - computed results
export const weeklyScores = pgTable('weekly_scores', {
  userId: integer('user_id').references(() => users.id),
  season: integer('season').notNull(),
  week: integer('week').notNull(),
  points: integer('points').notNull(),
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: { primaryKey: [table.userId, table.season, table.week] },
}));

// Types for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type Pick = typeof picks.$inferSelect;
export type NewPick = typeof picks.$inferInsert;
export type WeeklyScore = typeof weeklyScores.$inferSelect;
export type NewWeeklyScore = typeof weeklyScores.$inferInsert;
