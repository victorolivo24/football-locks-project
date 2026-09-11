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
    expect(msgs[1].body).toContain('Victor had it');
  });

  it('routes a loss to the bust alert instead', () => {
    const msgs = buildAlerts(
      [game({ status: 'in_progress' })],
      [game({ status: 'final', winnerTeam: 'New England Patriots', homeScore: 10, awayScore: 13 })],
      picks, players, URL
    );
    expect(kinds(msgs)).toEqual(['1:gameFinal', '2:rivalBust', '3:rivalBust']);
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
    expect(rivals[0].body).toContain('Ryan and Mihir had it');
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
    expect(msgs.find(m => m.userId === 3 && m.kind === 'rivalHit')?.body).toContain('Victor had it');
    expect(msgs.find(m => m.userId === 3 && m.kind === 'rivalBust')?.body).toContain('Ryan lost that lock');
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

  describe('once a player is out', () => {
    const other = (over: Partial<GameState> = {}): GameState => ({
      id: 20,
      homeTeam: 'Detroit Lions',
      awayTeam: 'New Orleans Saints',
      status: 'scheduled',
      winnerTeam: null,
      homeScore: null,
      awayScore: null,
      ...over,
    });

    // Victor already lost game 10; game 20 is his second lock.
    const dead = game({ status: 'final', winnerTeam: 'New England Patriots' });
    const twoLocks: PickRow[] = [
      { userId: 1, gameId: 10, pickedTeam: 'Seattle Seahawks' },
      { userId: 1, gameId: 20, pickedTeam: 'Detroit Lions' },
    ];

    it('stops telling them their later locks kicked off', () => {
      const msgs = buildAlerts(
        [dead, other()],
        [dead, other({ status: 'in_progress' })],
        twoLocks, players, URL
      );
      expect(msgs).toEqual([]);
    });

    it('stops telling them their later locks landed', () => {
      const msgs = buildAlerts(
        [dead, other({ status: 'in_progress' })],
        [dead, other({ status: 'final', winnerTeam: 'Detroit Lions' })],
        twoLocks, players, URL
      );
      expect(msgs.filter(m => m.userId === 1)).toEqual([]);
    });

    it('stops telling everyone else about their later locks', () => {
      // Jihoo's second lock hitting is meaningless once his week is dead.
      const msgs = buildAlerts(
        [dead, other({ status: 'in_progress' })],
        [dead, other({ status: 'final', winnerTeam: 'Detroit Lions' })],
        twoLocks, players, URL
      );
      expect(msgs).toEqual([]);
    });

    it('still announces the bust that eliminated them', () => {
      const msgs = buildAlerts(
        [game({ status: 'in_progress' })],
        [game({ status: 'final', winnerTeam: 'New England Patriots' })],
        [{ userId: 1, gameId: 10, pickedTeam: 'Seattle Seahawks' }], players, URL
      );
      expect(kinds(msgs)).toEqual(['1:gameFinal', '2:rivalBust', '3:rivalBust']);
    });

    it('goes quiet within the same refresh that killed them', () => {
      // Both games settle in one pass: the bust is announced, the later lock
      // is not, even though neither was final beforehand.
      const msgs = buildAlerts(
        [game({ status: 'in_progress' }), other({ status: 'in_progress' })],
        [
          game({ status: 'final', winnerTeam: 'New England Patriots' }),
          other({ status: 'final', winnerTeam: 'Detroit Lions' }),
        ],
        twoLocks, players, URL
      );
      expect(kinds(msgs)).toEqual(['1:gameFinal', '2:rivalBust', '3:rivalBust']);
    });

    it('leaves players who are still alive alone', () => {
      const mixed: PickRow[] = [
        { userId: 1, gameId: 10, pickedTeam: 'Seattle Seahawks' },
        { userId: 2, gameId: 20, pickedTeam: 'Detroit Lions' },
      ];
      const msgs = buildAlerts(
        [dead, other({ status: 'in_progress' })],
        [dead, other({ status: 'final', winnerTeam: 'Detroit Lions' })],
        mixed, players, URL
      );
      // Ryan is untouched by Victor's elimination.
      expect(kinds(msgs)).toContain('2:gameFinal');
    });
  });
});
