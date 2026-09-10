import { pgTable, serial, text, integer, bigint, timestamp, real } from 'drizzle-orm/pg-core';

// Users table - fixed set of 6 friends
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  passwordHash: text('passwordhash'),
});

// NFL Games table
export const games = pgTable('games', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  season: integer('season').notNull(),
  week: integer('week').notNull(),
  startTime: timestamp('starttime', { withTimezone: true }).notNull(), // 👈 maps to starttime
  homeTeam: text('hometeam').notNull(),                                 // 👈 hometeam
  awayTeam: text('awayteam').notNull(),                                 // 👈 awayteam
  winnerTeam: text('winnerteam'),                                       // 👈 winnerteam
  status: text('status').notNull().default('scheduled'),
  homeScore: integer('homescore'),
  awayScore: integer('awayscore'),
});
// Picks table - one row per user per game
export const picks = pgTable('picks', {
  userId: integer('userid').references(() => users.id),
  gameId: bigint('gameid', { mode: 'number' }).references(() => games.id),
  pickedTeam: text('pickedteam').notNull(),
  week: integer('week').notNull(),
  season: integer('season').notNull(),
  createdAt: timestamp('createdat', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: { primaryKey: [table.userId, table.gameId] },
}));

// Weekly scores table - computed results (actual table name: weeklyscores)
export const weeklyScores = pgTable('weeklyscores', {
  userId: integer('userid').references(() => users.id),
  season: integer('season').notNull(),
  week: integer('week').notNull(),
  points: integer('points').notNull(),
  computedAt: timestamp('computedat', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: { primaryKey: [table.userId, table.season, table.week] },
}));

// Closing odds for a game, snapshotted once per week before picks lock.
// One row per game: the Thursday pull is treated as the line for the whole week.
export const gameOdds = pgTable('gameodds', {
  gameId: bigint('gameid', { mode: 'number' }).primaryKey().references(() => games.id),
  season: integer('season').notNull(),
  week: integer('week').notNull(),
  awayMoneyline: integer('awaymoneyline'),
  homeMoneyline: integer('homemoneyline'),
  spread: text('spread'),
  total: real('total'),
});

// Types for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type Pick = typeof picks.$inferSelect;
export type NewPick = typeof picks.$inferInsert;
export type WeeklyScore = typeof weeklyScores.$inferSelect;
export type NewWeeklyScore = typeof weeklyScores.$inferInsert;
export type GameOdds = typeof gameOdds.$inferSelect;
export type NewGameOdds = typeof gameOdds.$inferInsert;
