'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Requisition = {
  id: string;
  req_number: string;
  job_title: string;
  status: string;
  job_requirements: string | null;
  created_at: string;
};

export default function AdminRequisitionsPage() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [createForm, setCreateForm] = useState({
    req_number: '',
    job_title: '',
    job_requirements: '',
  });

  function load() {
    setLoading(true);
    fetch('/api/admin/requisitions')
      .then((r) => r.json())
      .then((data) => {
        if (data.requisitions) setRequisitions(data.requisitions);
      })
      .catch(() => setRequisitions([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/requisitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          req_number: createForm.req_number.trim(),
          job_title: createForm.job_title.trim(),
          job_requirements: createForm.job_requirements.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create');
        return;
      }
      setShowCreate(false);
      setCreateForm({ req_number: '', job_title: '', job_requirements: '' });
      load();
    } catch {
      setError('Request failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function deactivate(id: string) {
    if (!confirm('Deactivate this requisition? It will be removed from registration dropdowns.')) return;
    setDeactivating(id);
    try {
      const res = await fetch(`/api/admin/requisitions/${id}/deactivate`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to deactivate');
        return;
      }
      load();
    } catch {
      setError('Request failed');
    } finally {
      setDeactivating(null);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Job requisitions</h1>
        <button type="button" onClick={() => setShowCreate(true)} className="btn btn-primary">
          Create requisition
        </button>
      </div>
      <p className="sub-text text-sm mb-4">Active requisitions appear in the candidate registration dropdown. Deactivated ones are hidden; existing interviews are unaffected.</p>

      {showCreate && (
        <div className="mb-6 p-4 rounded-lg border border-black/08" style={{ background: 'var(--card-bg)' }}>
          <h2 className="font-semibold mb-3">New requisition</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div>
              <label className="block text-sm font-medium mb-1">Job requisition number *</label>
              <input
                type="text"
                value={createForm.req_number}
                onChange={(e) => setCreateForm((f) => ({ ...f, req_number: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)]"
                placeholder="e.g. REQ-2026-001"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Job title *</label>
              <input
                type="text"
                value={createForm.job_title}
                onChange={(e) => setCreateForm((f) => ({ ...f, job_title: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Job requirements</label>
              <textarea
                value={createForm.job_requirements}
                onChange={(e) => setCreateForm((f) => ({ ...f, job_requirements: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)] min-h-[80px]"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="btn btn-primary">
                {submitting ? 'Creating…' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn sub-text">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {!showCreate && error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      {loading ? (
        <p className="sub-text">Loading…</p>
      ) : requisitions.length === 0 ? (
        <p className="sub-text">No active requisitions. Create one to use in candidate registration.</p>
      ) : (
        <ul className="space-y-2">
          {requisitions.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between p-3 rounded-lg border border-black/08"
              style={{ background: 'var(--card-bg)' }}
            >
              <div>
                <span className="font-medium">{r.job_title}</span>
                <span className="sub-text text-sm ml-2">({r.req_number})</span>
                <span className="sub-text text-xs ml-2">{r.status}</span>
                <p className="sub-text text-xs mt-1">Post date: {new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              {r.status === 'ACTIVE' && (
                <button
                  type="button"
                  onClick={() => deactivate(r.id)}
                  disabled={deactivating === r.id}
                  className="btn text-sm sub-text hover:text-red-600"
                >
                  {deactivating === r.id ? 'Deactivating…' : 'Deactivate'}
                </button>
              )}
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
