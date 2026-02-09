'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Session = {
  id: string;
  candidate_first_name: string;
  candidate_last_name: string;
  position_title: string;
  session_status: string;
  started_at: string | null;
  observer_count: number;
};

export default function AdminLiveSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch('/api/admin/live/sessions')
      .then((r) => r.json())
      .then((data) => {
        if (data.sessions) setSessions(data.sessions);
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold mb-2">View live sessions</h1>
      <p className="sub-text text-sm mb-4">Active interviews you can observe with real-time transcript and TTS playback.</p>

      {loading ? (
        <p className="sub-text">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="sub-text">No active sessions. Start an interview from the candidate flow to see it here.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between p-3 rounded-lg border border-black/08"
              style={{ background: 'var(--card-bg)' }}
            >
              <div>
                <span className="font-medium">{s.candidate_first_name} {s.candidate_last_name}</span>
                <span className="sub-text text-sm ml-2">— {s.position_title}</span>
                <p className="sub-text text-xs mt-1">
                  Status: {s.session_status} · Started: {s.started_at ? new Date(s.started_at).toLocaleString() : '—'} · Observers: {s.observer_count}
                </p>
              </div>
              <Link href={`/admin/live/${s.id}`} className="btn btn-primary text-sm">
                Observe
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4">
        <Link href="/admin" className="text-sm sub-text hover:opacity-80">← Back to dashboard</Link>
      </p>
    </div>
  );
}
