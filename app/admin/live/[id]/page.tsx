'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Segment = { id: string; speaker: string; content: string; timestamp_offset_ms: number | null; created_at: string };
type Meta = { id: string; candidate_first_name: string; candidate_last_name: string; position_title: string; status: string; started_at: string | null };

/** TTS queue item: one or more segments merged (same speaker, gaps ≤ 5s). */
type TTSChunk = { text: string; speaker: string; lastCreatedAt: number };

function segId(s: Segment): string {
  return String(s?.id ?? '').trim().toLowerCase();
}

const POLL_MS = 2000;
const TTS_MERGE_GAP_MS = 5000;

/** Convert segments to TTS chunks: same speaker concatenated until speaker change or gap > 5s. */
function segmentsToTTSChunks(segments: Segment[]): TTSChunk[] {
  const chunks: TTSChunk[] = [];
  for (const seg of segments) {
    const content = (seg.content ?? '').trim();
    if (!content) continue;
    const t = seg.created_at ? new Date(seg.created_at).getTime() : 0;
    const last = chunks[chunks.length - 1];
    const gapOk = last && t > 0 && last.lastCreatedAt > 0 && t - last.lastCreatedAt <= TTS_MERGE_GAP_MS;
    if (last && last.speaker === seg.speaker && gapOk) {
      last.text += (last.text ? ' ' : '') + content;
      last.lastCreatedAt = t;
    } else {
      chunks.push({ text: content, speaker: seg.speaker, lastCreatedAt: t });
    }
  }
  return chunks;
}

/** Append new segments to the TTS queue, merging with last chunk when same speaker and within 5s. */
function appendSegmentsToQueue(queue: TTSChunk[], segments: Segment[]): void {
  for (const seg of segments) {
    const content = (seg.content ?? '').trim();
    if (!content) continue;
    const t = seg.created_at ? new Date(seg.created_at).getTime() : 0;
    const last = queue[queue.length - 1];
    const gapOk = last && t > 0 && last.lastCreatedAt > 0 && t - last.lastCreatedAt <= TTS_MERGE_GAP_MS;
    if (last && last.speaker === seg.speaker && gapOk) {
      last.text += (last.text ? ' ' : '') + content;
      last.lastCreatedAt = t;
    } else {
      queue.push({ text: content, speaker: seg.speaker, lastCreatedAt: t });
    }
  }
}
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
  const [ttsLoading, setTtsLoading] = useState(false);
  const lastCreatedRef = useRef<string | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const displayedSegmentIdsRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<TTSChunk[]>([]);
  const playingRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const sessionEndedRef = useRef(false);
  const transcriptIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playNext = useCallback(() => {
    if (playingRef.current || queueRef.current.length === 0 || ttsPaused || ttsMuted) return;
    const chunk = queueRef.current.shift();
    if (!chunk || !chunk.text.trim()) {
      playingRef.current = false;
      setTimeout(playNext, 50);
      return;
    }
    playingRef.current = true;
    setTtsLoading(true);
    fetch('/api/admin/live/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: chunk.text, speaker: chunk.speaker }),
    })
      .then((r) => {
        if (!r.ok) throw new Error('TTS failed');
        return r.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudioRef.current = audio;
        audio.volume = ttsMuted ? 0 : ttsVolume;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          currentAudioRef.current = null;
          playingRef.current = false;
          setTtsLoading(false);
          setTimeout(playNext, 50);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          currentAudioRef.current = null;
          playingRef.current = false;
          setTtsLoading(false);
          setTimeout(playNext, 50);
        };
        audio.play().catch(() => {
          playingRef.current = false;
          setTtsLoading(false);
          setTimeout(playNext, 50);
        });
      })
      .catch((err) => {
        console.error('TTS fetch error:', err);
        playingRef.current = false;
        setTtsLoading(false);
        setTimeout(playNext, 100);
      });
  }, [ttsPaused, ttsMuted, ttsVolume]);

  useEffect(() => {
    const audio = currentAudioRef.current;
    if (audio) {
      audio.volume = ttsMuted ? 0 : ttsVolume;
    }
  }, [ttsVolume, ttsMuted]);

  const resumeRealtime = useCallback(() => {
    queueRef.current = [];
    const audio = currentAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    currentAudioRef.current = null;
    playingRef.current = false;
    setTtsLoading(false);
  }, []);

  const playFromSegmentIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= segments.length) return;
      const fromSegments = segments.slice(index);
      queueRef.current = segmentsToTTSChunks(fromSegments);
      const audio = currentAudioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      currentAudioRef.current = null;
      playingRef.current = false;
      if (!ttsPaused && !ttsMuted) playNext();
    },
    [segments, ttsPaused, ttsMuted, playNext]
  );

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
      const url = `/api/admin/live/observe/${id}/transcript${params}${params ? '&' : '?'}_t=${Date.now()}`;
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
            queueRef.current = segmentsToTTSChunks(data.segments);
            if (sessionEndedRef.current && transcriptIntervalRef.current) {
              clearInterval(transcriptIntervalRef.current);
              transcriptIntervalRef.current = null;
            }
            playNext();
            return;
          }
          const toAdd = data.segments.filter((s: Segment) => !displayedIds.has(segId(s)));
          if (toAdd.length === 0) return;
          toAdd.forEach((s: Segment) => displayedIds.add(segId(s)));
          setSegments((prev) => {
            const prevIds = new Set(prev.map((p) => segId(p)));
            const extra = toAdd.filter((s: Segment) => !prevIds.has(segId(s)));
            if (extra.length === 0) return prev;
            return [...prev, ...extra];
          });
          const lastAdded = toAdd[toAdd.length - 1];
          if (lastAdded?.created_at) lastCreatedRef.current = lastAdded.created_at;
          if (lastAdded?.id) lastIdRef.current = lastAdded.id;
          appendSegmentsToQueue(queueRef.current, toAdd);
          playNext();
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
  }, [id, playNext]);

  useEffect(() => {
    if (!ttsPaused && !ttsMuted) playNext();
  }, [ttsPaused, ttsMuted, ttsVolume, playNext]);

  const handlePauseResume = useCallback(() => {
    const audio = currentAudioRef.current;
    if (ttsPaused) {
      if (audio) audio.play();
    } else {
      if (audio) audio.pause();
    }
    setTtsPaused((p) => !p);
  }, [ttsPaused]);

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

      <div className="rounded-lg border border-black/08 p-3 flex items-center gap-3 flex-wrap" style={{ background: 'var(--card-bg)' }}>
        <span className="text-sm font-medium">TTS playback</span>
        <button
          type="button"
          onClick={handlePauseResume}
          className="btn btn-primary text-sm"
        >
          {ttsPaused ? 'Play' : 'Pause'}
        </button>
        <button
          type="button"
          onClick={resumeRealtime}
          className="btn text-sm sub-text"
          title="Clear queue and resume playing only new transcript as it arrives"
        >
          Resume real-time
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
        {ttsLoading && <span className="text-xs sub-text">Generating…</span>}
      </div>

      <div className="rounded-lg border border-black/08 overflow-hidden flex flex-col" style={{ background: 'var(--card-bg)', minHeight: 280 }}>
        <div className="px-3 py-2 border-b border-black/08 text-sm font-semibold">Real-time transcript</div>
        <p className="px-3 py-1 text-xs sub-text border-b border-black/06">Click a line to start playback from that line.</p>
        <div className="p-3 overflow-y-auto max-h-[400px] min-h-[200px] space-y-2">
          {segments.length === 0 ? (
            <p className="sub-text text-sm">No transcript yet. New segments will appear here and play via TTS when at least one observer is viewing.</p>
          ) : (
            segments.map((seg, index) => (
              <button
                type="button"
                key={seg.id}
                onClick={() => playFromSegmentIndex(index)}
                className="w-full text-left text-sm rounded px-2 py-1.5 hover:bg-black/06 transition"
                style={{ color: 'var(--text-primary)' }}
              >
                <span className="font-medium sub-text">{seg.speaker === 'AVATAR' ? 'Interviewer' : 'Candidate'}:</span>{' '}
                {seg.content}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
