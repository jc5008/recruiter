'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Segment = { id: string; speaker: string; content: string; timestamp_offset_ms: number | null; created_at: string };
type Meta = { id: string; candidate_first_name: string; candidate_last_name: string; position_title: string; status: string; started_at: string | null };

function segId(s: Segment): string {
  return String(s?.id ?? '').trim().toLowerCase();
}

const POLL_MS = 2000;
const ENDED_STATUSES = ['COMPLETED', 'EXPIRED', 'FAILED'];

export default function AdminLiveObservationPage() {
  const params = useParams();
  const id = params?.id as string;
  const [meta, setMeta] = useState<Meta | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ttsPaused, setTtsPaused] = useState(false);
  const [ttsMuted, setTtsMuted] = useState(false);
  const [ttsVolume, setTtsVolume] = useState(1);
  const lastCreatedRef = useRef<string | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const displayedSegmentIdsRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<Segment[]>([]);
  const speakingRef = useRef(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const sessionEndedRef = useRef(false);
  const transcriptIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const speakNext = useCallback(() => {
    if (speakingRef.current || queueRef.current.length === 0 || ttsPaused || ttsMuted) return;
    const seg = queueRef.current.shift();
    if (!seg || !seg.content.trim()) {
      speakingRef.current = false;
      setTimeout(speakNext, 100);
      return;
    }
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      speakingRef.current = false;
      setTimeout(speakNext, 100);
      return;
    }
    const synth = window.speechSynthesis;
    synthRef.current = synth;
    const u = new SpeechSynthesisUtterance(seg.content);
    u.volume = ttsMuted ? 0 : ttsVolume;
    u.rate = 1;
    u.onend = () => {
      speakingRef.current = false;
      setTimeout(speakNext, 50);
    };
    u.onerror = () => {
      speakingRef.current = false;
      setTimeout(speakNext, 50);
    };
    speakingRef.current = true;
    synth.speak(u);
  }, [ttsPaused, ttsMuted, ttsVolume]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/live/observe/${id}/meta`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setMeta(data);
          sessionEndedRef.current = ENDED_STATUSES.includes(data.status);
        }
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let pollCount = 0;
    function pollMeta() {
      fetch(`/api/admin/live/observe/${id}/meta`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.status && ENDED_STATUSES.includes(data.status)) {
            sessionEndedRef.current = true;
            if (transcriptIntervalRef.current) {
              clearInterval(transcriptIntervalRef.current);
              transcriptIntervalRef.current = null;
            }
          }
        })
        .catch(() => {});
    }
    function poll() {
      if (sessionEndedRef.current && lastCreatedRef.current !== null) return;
      pollCount += 1;
      if (pollCount > 1 && pollCount % 3 === 0) pollMeta();
      const after = lastCreatedRef.current;
      const afterId = lastIdRef.current;
      const params = after ? `?after=${encodeURIComponent(after)}${afterId ? `&after_id=${encodeURIComponent(afterId)}` : ''}` : '';
      const url = `/api/admin/live/observe/${id}/transcript${params}`;
      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          if (!data.segments || !Array.isArray(data.segments)) return;
          const displayedIds = displayedSegmentIdsRef.current;
          if (!after) {
            setSegments(data.segments);
            displayedIds.clear();
            data.segments.forEach((s: Segment) => displayedIds.add(segId(s)));
            const last = data.segments[data.segments.length - 1];
            if (last?.created_at) lastCreatedRef.current = last.created_at;
            if (last?.id) lastIdRef.current = last.id;
            if (sessionEndedRef.current && transcriptIntervalRef.current) {
              clearInterval(transcriptIntervalRef.current);
              transcriptIntervalRef.current = null;
            }
            return;
          }
          const toAdd = data.segments.filter((s: Segment) => !displayedIds.has(segId(s)));
          if (toAdd.length === 0) return;
          toAdd.forEach((s: Segment) => displayedIds.add(segId(s)));
          setSegments((prev) => {
            const prevIds = new Set(prev.map((p) => segId(p)));
            const extra = toAdd.filter((s) => !prevIds.has(segId(s)));
            if (extra.length === 0) return prev;
            return [...prev, ...extra];
          });
          const lastAdded = toAdd[toAdd.length - 1];
          if (lastAdded?.created_at) lastCreatedRef.current = lastAdded.created_at;
          if (lastAdded?.id) lastIdRef.current = lastAdded.id;
          toAdd.forEach((s: Segment) => queueRef.current.push(s));
          speakNext();
        })
        .catch(() => {});
    }
    poll();
    const t = setInterval(poll, POLL_MS);
    transcriptIntervalRef.current = t;
    return () => {
      clearInterval(t);
      transcriptIntervalRef.current = null;
    };
  }, [id, speakNext]);

  useEffect(() => {
    if (!ttsPaused && !ttsMuted) speakNext();
  }, [ttsPaused, ttsMuted, ttsVolume, speakNext]);

  if (loading) {
    return (
      <div>
        <p className="sub-text">Loading…</p>
        <Link href="/admin/live" className="text-sm sub-text hover:opacity-80 mt-2 inline-block">← Live sessions</Link>
      </div>
    );
  }
  if (error || !meta) {
    return (
      <div>
        <p className="text-red-600">{error || 'Interview not found'}</p>
        <Link href="/admin/live" className="text-sm sub-text hover:opacity-80 mt-2 inline-block">← Live sessions</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Live observation</h1>
          <p className="sub-text text-sm">
            {meta.candidate_first_name} {meta.candidate_last_name} — {meta.position_title}
          </p>
          <p className="sub-text text-xs">Status: {meta.status} · Started: {meta.started_at ? new Date(meta.started_at).toLocaleString() : '—'}</p>
        </div>
        <Link href="/admin/live" className="btn sub-text text-sm">← Sessions</Link>
      </div>

      <div className="rounded-lg border border-black/08 p-3 flex items-center gap-4 flex-wrap" style={{ background: 'var(--card-bg)' }}>
        <span className="text-sm font-medium">TTS playback</span>
        <button
          type="button"
          onClick={() => setTtsPaused((p) => !p)}
          className="btn btn-primary text-sm"
        >
          {ttsPaused ? 'Resume' : 'Pause'}
        </button>
        <label className="flex items-center gap-2 text-sm">
          <span>Volume</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={ttsVolume}
            onChange={(e) => setTtsVolume(parseFloat(e.target.value))}
            className="w-24"
          />
        </label>
        <button
          type="button"
          onClick={() => setTtsMuted((m) => !m)}
          className="btn text-sm sub-text"
        >
          {ttsMuted ? 'Unmute' : 'Mute'}
        </button>
      </div>

      <div className="rounded-lg border border-black/08 overflow-hidden flex flex-col" style={{ background: 'var(--card-bg)', minHeight: 280 }}>
        <div className="px-3 py-2 border-b border-black/08 text-sm font-semibold">Real-time transcript</div>
        <div className="p-3 overflow-y-auto max-h-[400px] min-h-[200px] space-y-2">
          {segments.length === 0 ? (
            <p className="sub-text text-sm">No transcript yet. New segments will appear here and play via TTS when at least one observer is viewing.</p>
          ) : (
            segments.map((seg) => (
              <div key={seg.id} className="text-sm">
                <span className="font-medium sub-text">{seg.speaker === 'AVATAR' ? 'Avatar' : 'Candidate'}:</span>{' '}
                <span style={{ color: 'var(--text-primary)' }}>{seg.content}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
