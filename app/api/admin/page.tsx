'use client';
import { useState } from 'react';

export default function AdminPage() {
  const [json, setJson] = useState('');
  const [season, setSeason] = useState<number>(2025);
  const [week, setWeek] = useState<number>(1);
  const [gameId, setGameId] = useState<number | ''>('');
  const [winner, setWinner] = useState('');
  const [passcode, setPasscode] = useState('');

  async function createWeek() {
    try {
      const parsed = JSON.parse(json); // expects array of {id,startTime,homeTeam,awayTeam}
      const body = {
        season,
        week,
        games: Array.isArray(parsed)
          ? parsed.map((g: any) => ({
              id: Number(g.id),
              season,
              week,
              startTime: g.startTime,
              homeTeam: g.homeTeam,
              awayTeam: g.awayTeam,
            }))
          : [],
      };
      const res = await fetch('/api/admin/create-week', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-pass': passcode,
        },
        body: JSON.stringify(body),
      });
      alert(await res.text());
    } catch (e: any) {
      alert('Invalid JSON: ' + e?.message);
    }
  }

  async function setResult() {
    if (!gameId || !winner) return alert('Need gameId & winnerTeam');
    const res = await fetch('/api/admin/set-result', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-pass': passcode,
      },
      body: JSON.stringify({ gameId: Number(gameId), winnerTeam: winner, season, week }),
    });
    alert(await res.text());
  }

  async function seedWeek1() {
    if (!season) return alert('Enter a season');
    const res = await fetch('/api/admin/seed-week1-picks', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-pass': passcode,
      },
      body: JSON.stringify({ season }),
    });
    const text = await res.text();
    alert(text);
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-white">Admin</h1>

      <div className="glass-card p-5 space-y-3">
        <h2 className="text-xl font-semibold text-white">Auth</h2>
        <input
          className="glass-section px-3 py-2 w-64 text-white placeholder-white/60"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Admin passcode"
        />
        <div className="text-green-200 text-sm">Tip: paste your passcode here once per session.</div>
      </div>

      <div className="glass-card p-5 space-y-3">
        <h2 className="text-xl font-semibold text-white">Create Week (paste JSON array)</h2>
        <div className="flex gap-2">
          <input
            className="glass-section px-3 py-2 w-24 text-white placeholder-white/60"
            type="number"
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            placeholder="Season"
          />
          <input
            className="glass-section px-3 py-2 w-16 text-white placeholder-white/60"
            type="number"
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
            placeholder="Week"
          />
        </div>
        <textarea
          className="glass-section p-3 w-full h-48 text-white placeholder-white/60"
          value={json}
          onChange={(e) => setJson(e.target.value)}
          placeholder={`[\n  {\"id\":202501001,\"startTime\":\"2025-09-04T20:15:00-04:00\",\"homeTeam\":\"Chiefs\",\"awayTeam\":\"Ravens\"}\n]`}
        />
        <button onClick={createWeek} className="btn-yellow px-4 py-2 hover:scale-105">
          Create / Upsert
        </button>
      </div>

      <div className="glass-card p-5 space-y-3">
        <h2 className="text-xl font-semibold text-white">Set Result</h2>
        <div className="flex gap-2 flex-wrap">
          <input
            className="glass-section px-3 py-2 w-32 text-white placeholder-white/60"
            type="number"
            value={Number(gameId) || ''}
            onChange={(e) => setGameId(Number(e.target.value) || '')}
            placeholder="gameId"
          />
          <input
            className="glass-section px-3 py-2 w-48 text-white placeholder-white/60"
            value={winner}
            onChange={(e) => setWinner(e.target.value)}
            placeholder="winnerTeam (e.g., Chiefs)"
          />
          <button onClick={setResult} className="btn-blue px-4 py-2 hover:scale-105">
            Finalize & Score
          </button>
        </div>
      </div>

      <div className="glass-card p-5 space-y-3">
        <h2 className="text-xl font-semibold text-white">Seed Week 1 Picks</h2>
        <div className="flex items-center gap-3">
          <input
            className="glass-section px-3 py-2 w-28 text-white placeholder-white/60"
            type="number"
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            placeholder="Season"
          />
          <button onClick={seedWeek1} className="btn-yellow px-4 py-2 hover:scale-105">Seed Now</button>
        </div>
        <div className="text-green-200/90 text-sm">Users: Victor, Jihoo, Ryan, Mihir</div>
      </div>
    </div>
  );
}
