'use client';
import { useState } from 'react';

export default function AdminPage() {
    const [json, setJson] = useState('');
    const [season, setSeason] = useState<number>(2025);
    const [week, setWeek] = useState<number>(1);
    const [gameId, setGameId] = useState<number | ''>('');
    const [winner, setWinner] = useState('');

    async function createWeek() {
        try {
            const parsed = JSON.parse(json); // expects array of {id,startTime,homeTeam,awayTeam}
            const body = {
                season,
                week,
                games: Array.isArray(parsed) ? parsed.map((g: any) => ({
                    id: Number(g.id),
                    season, week,
                    startTime: g.startTime,
                    homeTeam: g.homeTeam,
                    awayTeam: g.awayTeam,
                })) : [],
            };
            const res = await fetch('/api/admin/create-week', {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-admin-pass': process.env.NEXT_PUBLIC_ADMIN_PASS ?? '' },
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
            headers: { 'content-type': 'application/json', 'x-admin-pass': process.env.NEXT_PUBLIC_ADMIN_PASS ?? '' },
            body: JSON.stringify({ gameId: Number(gameId), winnerTeam: winner, season, week }),
        });
        alert(await res.text());
    }

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6">
            <h1 className="text-2xl font-semibold">Admin</h1>

            <div className="space-y-2">
                <h2 className="text-lg font-medium">Create Week (paste JSON array)</h2>
                <div className="flex gap-2">
                    <input className="border p-2 w-24" type="number" value={season} onChange={e => setSeason(Number(e.target.value))} placeholder="Season" />
                    <input className="border p-2 w-16" type="number" value={week} onChange={e => setWeek(Number(e.target.value))} placeholder="Week" />
                </div>
                <textarea className="border p-2 w-full h-48" value={json} onChange={e => setJson(e.target.value)} placeholder={`[
  {"id":202501001,"startTime":"2025-09-04T20:15:00-04:00","homeTeam":"Chiefs","awayTeam":"Ravens"}
]`} />
                <button onClick={createWeek} className="border px-4 py-2 rounded">Create/Upsert</button>
            </div>

            <div className="space-y-2">
                <h2 className="text-lg font-medium">Set Result</h2>
                <div className="flex gap-2">
                    <input className="border p-2 w-32" type="number" value={Number(gameId) || ''} onChange={e => setGameId(Number(e.target.value) || '')} placeholder="gameId" />
                    <input className="border p-2 w-40" value={winner} onChange={e => setWinner(e.target.value)} placeholder="winnerTeam (e.g., Chiefs)" />
                    <button onClick={setResult} className="border px-4 py-2 rounded">Finalize & Score</button>
                </div>
            </div>
        </div>
    );
}
