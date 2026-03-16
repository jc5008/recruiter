'use client';

import { useState, useEffect, useCallback } from 'react';

type Candidate = {
  id: string;
  candidate_first_name: string;
  candidate_last_name: string;
  candidate_email: string;
  resume_text: string | null;
  requisition_id: string | null;
  access_code: string;
  deadline_at: string;
  status: string;
  created_at: string;
  job_title: string | null;
};

type SortKey = 'first_name' | 'last_name' | 'created_at' | 'title';

export default function AdminCandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<SortKey>('created_at');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [jobTitleFilter, setJobTitleFilter] = useState<string>('');
  const [selected, setSelected] = useState<Candidate | null>(null);

  const loadCandidates = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ sort, order: order });
    if (jobTitleFilter) params.set('job_title', jobTitleFilter);
    fetch(`/api/admin/candidates?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else if (data.candidates) setCandidates(data.candidates);
      })
      .catch(() => setError('Failed to load candidates'))
      .finally(() => setLoading(false));
  }, [sort, order, jobTitleFilter]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  useEffect(() => {
    fetch('/api/admin/candidates/job-titles')
      .then((r) => r.json())
      .then((data) => {
        if (data.job_titles) setJobTitles(data.job_titles);
      })
      .catch(() => setJobTitles([]));
  }, []);

  function handleSort(key: SortKey) {
    if (sort === key) setOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
    else {
      setSort(key);
      setOrder(key === 'created_at' ? 'desc' : 'asc');
    }
  }

  function formatDate(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { dateStyle: 'medium' }) + ' ' + d.toLocaleTimeString(undefined, { timeStyle: 'short' });
    } catch {
      return iso;
    }
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-semibold mb-2">Registered candidates</h1>
      <p className="sub-text text-sm mb-4">View and sort by name, job title, or registration date. Click a row to see full details and interview code.</p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">Filter by job title</label>
        <select
          value={jobTitleFilter}
          onChange={(e) => setJobTitleFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-black/12 bg-[var(--card-bg)] text-[var(--text-primary)] min-w-[200px]"
        >
          <option value="">All job titles</option>
          {jobTitles.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600" role="alert">{error}</div>
      )}

      {loading ? (
        <p className="sub-text text-sm">Loading…</p>
      ) : (
        <div className="rounded-xl border border-black/08 overflow-hidden" style={{ background: 'var(--card-bg)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/08">
                  <th className="text-left p-3 font-medium cursor-pointer hover:opacity-80" onClick={() => handleSort('first_name')}>
                    First name {sort === 'first_name' && (order === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="text-left p-3 font-medium cursor-pointer hover:opacity-80" onClick={() => handleSort('last_name')}>
                    Last name {sort === 'last_name' && (order === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="text-left p-3 font-medium cursor-pointer hover:opacity-80" onClick={() => handleSort('title')}>
                    Job title {sort === 'title' && (order === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="text-left p-3 font-medium cursor-pointer hover:opacity-80" onClick={() => handleSort('created_at')}>
                    Registration date {sort === 'created_at' && (order === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {candidates.length === 0 ? (
                  <tr><td colSpan={4} className="p-4 sub-text text-center">No candidates found.</td></tr>
                ) : (
                  candidates.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className="border-b border-black/06 cursor-pointer hover:bg-black/06 transition"
                    >
                      <td className="p-3">{c.candidate_first_name}</td>
                      <td className="p-3">{c.candidate_last_name}</td>
                      <td className="p-3">{c.job_title ?? '—'}</td>
                      <td className="p-3">{formatDate(c.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Candidate details"
        >
          <div
            className="w-full max-w-lg rounded-xl border border-black/08 shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--card-bg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-black/08 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Registration details</h2>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-sm sub-text hover:opacity-80"
              >
                Close
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div><span className="font-medium sub-text">First name</span><br />{selected.candidate_first_name}</div>
              <div><span className="font-medium sub-text">Last name</span><br />{selected.candidate_last_name}</div>
              <div><span className="font-medium sub-text">Email</span><br />{selected.candidate_email}</div>
              <div><span className="font-medium sub-text">Job title</span><br />{selected.job_title ?? '—'}</div>
              <div><span className="font-medium sub-text">Interview code</span><br /><code className="px-2 py-1 rounded bg-black/08 font-mono">{selected.access_code}</code></div>
              <div><span className="font-medium sub-text">Deadline</span><br />{formatDate(selected.deadline_at)}</div>
              <div><span className="font-medium sub-text">Status</span><br />{selected.status}</div>
              <div><span className="font-medium sub-text">Registered at</span><br />{formatDate(selected.created_at)}</div>
              {selected.resume_text && (
                <div>
                  <span className="font-medium sub-text">Resume (excerpt)</span>
                  <div className="mt-1 p-3 rounded-lg bg-black/06 max-h-40 overflow-y-auto whitespace-pre-wrap">{selected.resume_text.slice(0, 2000)}{selected.resume_text.length > 2000 ? '…' : ''}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
