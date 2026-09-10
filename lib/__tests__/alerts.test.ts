import { describe, it, expect } from 'vitest';
import { buildAlerts, GameState, PickRow, Player } from '../alerts';

const players: Player[] = [
  { id: 1, name: 'Victor' },
  { id: 2, name: 'Ryan' },
  { id: 3, name: 'Mihir' },
];

const game = (over: Partial<GameState> = {}): GameState => ({
  id: 10,
  homeTeam: 'Seattle Seahawks',
  awayTeam: 'New England Patriots',
  status: 'scheduled',
  winnerTeam: null,
  homeScore: null,
  awayScore: null,
  ...over,
});

const picks: PickRow[] = [{ userId: 1, gameId: 10, pickedTeam: 'Seattle Seahawks' }];
const URL = '/picks/2026/1';

const kinds = (msgs: ReturnType<typeof buildAlerts>) => msgs.map(m => `${m.userId}:${m.kind}`);

describe('buildAlerts', () => {
  it('tells only the backers when their game kicks off', () => {
    const msgs = buildAlerts([game()], [game({ status: 'in_progress' })], picks, players, URL);
    expect(kinds(msgs)).toEqual(['1:gameStart']);
  });

  it('says nothing when nothing changed', () => {
    expect(buildAlerts([game()], [game()], picks, players, URL)).toEqual([]);
  });

  it('does not re-announce a game that was already final', () => {
    // The refresh runs repeatedly; a result must announce itself once.
    const finished = game({ status: 'final', winnerTeam: 'Seattle Seahawks' });
    expect(buildAlerts([finished], [finished], picks, players, URL)).toEqual([]);
  });

  it('tells the backer they hit and the rest that it hit', () => {
    const msgs = buildAlerts(
      [game({ status: 'in_progress' })],
      [game({ status: 'final', winnerTeam: 'Seattle Seahawks', homeScore: 13, awayScore: 10 })],
      picks, players, URL
    );
    expect(kinds(msgs)).toEqual(['1:gameFinal', '2:rivalHit', '3:rivalHit']);
    expect(msgs[1].title).toBe('Victor cashed');
  });

  it('routes a loss to the bust alert instead', () => {
    const msgs = buildAlerts(
      [game({ status: 'in_progress' })],
      [game({ status: 'final', winnerTeam: 'New England Patriots', homeScore: 10, awayScore: 13 })],
      picks, players, URL
    );
    expect(kinds(msgs)).toEqual(['1:gameFinal', '2:rivalBust', '3:rivalBust']);
    expect(msgs[0].title).toBe('Lock lost');
    expect(msgs[2].body).toContain('Victor lost that lock');
  });

  it('never tells someone about their own pick as a rival result', () => {
    const msgs = buildAlerts(
      [game({ status: 'in_progress' })],
      [game({ status: 'final', winnerTeam: 'Seattle Seahawks' })],
      picks, players, URL
    );
    expect(msgs.filter(m => m.userId === 1 && m.kind.startsWith('rival'))).toHaveLength(0);
  });

  it('carries the score when there is one', () => {
    const msgs = buildAlerts(
      [game({ status: 'in_progress' })],
      [game({ status: 'final', winnerTeam: 'Seattle Seahawks', homeScore: 13, awayScore: 10 })],
      picks, players, URL
    );
    expect(msgs[0].body).toContain('Patriots 10–Seahawks 13');
  });

  it('leaves a game with no result alone', () => {
    const msgs = buildAlerts(
      [game({ status: 'in_progress' })],
      [game({ status: 'final', winnerTeam: null })],
      picks, players, URL
    );
    expect(msgs).toEqual([]);
  });

  it('ignores a game the refresh has never seen before', () => {
    expect(buildAlerts([], [game({ status: 'in_progress' })], picks, players, URL)).toEqual([]);
  });

  it('sends one rival alert per person per game, however many locked it', () => {
    // This league picks alike; one message per rival pick would mean a game
    // three people locked fires six notifications for a single result.
    const shared: PickRow[] = [
      { userId: 1, gameId: 10, pickedTeam: 'Seattle Seahawks' },
      { userId: 2, gameId: 10, pickedTeam: 'Seattle Seahawks' },
      { userId: 3, gameId: 10, pickedTeam: 'Seattle Seahawks' },
    ];
    const msgs = buildAlerts(
      [game({ status: 'in_progress' })],
      [game({ status: 'final', winnerTeam: 'Seattle Seahawks' })],
      shared, players, URL
    );
    const rivals = msgs.filter(m => m.kind === 'rivalHit');
    expect(rivals).toHaveLength(3);
    expect(rivals[0].title).toBe('Ryan and Mihir cashed');
  });

  it('names a mixed result on both sides separately', () => {
    const split: PickRow[] = [
      { userId: 1, gameId: 10, pickedTeam: 'Seattle Seahawks' },
      { userId: 2, gameId: 10, pickedTeam: 'New England Patriots' },
    ];
    const msgs = buildAlerts(
      [game({ status: 'in_progress' })],
      [game({ status: 'final', winnerTeam: 'Seattle Seahawks' })],
      split, players, URL
    );
    expect(msgs.find(m => m.userId === 3 && m.kind === 'rivalHit')?.title).toBe('Victor cashed');
    expect(msgs.find(m => m.userId === 3 && m.kind === 'rivalBust')?.title).toBe('Ryan out');
  });

  it('tags each alert so repeats collapse into one notification', () => {
    const msgs = buildAlerts([game()], [game({ status: 'in_progress' })], picks, players, URL);
    expect(msgs[0].tag).toBe('start:10');
  });

  it('points every alert at the live gameday screen', () => {
    const msgs = buildAlerts(
      [game({ status: 'in_progress' })],
      [game({ status: 'final', winnerTeam: 'Seattle Seahawks' })],
      picks, players, URL
    );
    expect(msgs.every(m => m.url === URL)).toBe(true);
  });
});
