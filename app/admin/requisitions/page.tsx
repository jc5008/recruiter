'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Requisition = {
  id: string;
  req_number: string;
  job_title: string;
  status: string;
  job_requirements: string | null;
  qualifications: string | null;
  skills: string | null;
  liveavatar_context_id: string | null;
  job_analysis_instructions: string | null;
  created_at: string;
};

type LiveAvatarContext = { id: string; name: string };

const emptyEditForm = {
  req_number: '',
  job_title: '',
  status: 'ACTIVE',
  job_requirements: '',
  qualifications: '',
  skills: '',
  liveavatar_context_id: '',
  job_analysis_instructions: '',
};

export default function AdminRequisitionsPage() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [savingEdit, setSavingEdit] = useState(false);
  const [error, setError] = useState('');
  const [contexts, setContexts] = useState<LiveAvatarContext[]>([]);
  const [contextsLoading, setContextsLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    req_number: '',
    job_title: '',
    job_requirements: '',
    qualifications: '',
    skills: '',
    liveavatar_context_id: '',
    job_analysis_instructions: '',
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

  useEffect(() => {
    if (!showCreate && !editingId) return;
    setContextsLoading(true);
    fetch('/api/admin/liveavatar/contexts')
      .then((r) => r.json())
      .then((data) => {
        if (data.contexts && Array.isArray(data.contexts)) setContexts(data.contexts);
      })
      .catch(() => setContexts([]))
      .finally(() => setContextsLoading(false));
  }, [showCreate, editingId]);

  function openEdit(r: Requisition) {
    setEditingId(r.id);
    setEditForm({
      req_number: r.req_number ?? '',
      job_title: r.job_title ?? '',
      status: r.status ?? 'ACTIVE',
      job_requirements: r.job_requirements ?? '',
      qualifications: r.qualifications ?? '',
      skills: r.skills ?? '',
      liveavatar_context_id: r.liveavatar_context_id ?? '',
      job_analysis_instructions: r.job_analysis_instructions ?? '',
    });
    setError('');
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError('');
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/requisitions/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          req_number: editForm.req_number.trim(),
          job_title: editForm.job_title.trim(),
          status: editForm.status,
          job_requirements: editForm.job_requirements.trim() || undefined,
          qualifications: editForm.qualifications.trim() || undefined,
          skills: editForm.skills.trim() || undefined,
          liveavatar_context_id: editForm.liveavatar_context_id.trim() || undefined,
          job_analysis_instructions: editForm.job_analysis_instructions.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update');
        return;
      }
      setEditingId(null);
      setEditForm(emptyEditForm);
      load();
    } catch {
      setError('Request failed');
    } finally {
      setSavingEdit(false);
    }
  }

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
          qualifications: createForm.qualifications.trim() || undefined,
          skills: createForm.skills.trim() || undefined,
          liveavatar_context_id: createForm.liveavatar_context_id.trim() || undefined,
          job_analysis_instructions: createForm.job_analysis_instructions.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create');
        return;
      }
      setShowCreate(false);
      setCreateForm({
        req_number: '',
        job_title: '',
        job_requirements: '',
        qualifications: '',
        skills: '',
        liveavatar_context_id: '',
        job_analysis_instructions: '',
      });
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
      if (editingId === id) {
        setEditingId(null);
        setEditForm(emptyEditForm);
      }
      load();
    } catch {
      setError('Request failed');
    } finally {
      setDeactivating(null);
    }
  }

  const contextSelect = (
    value: string,
    onChange: (v: string) => void,
    disabled?: boolean
  ) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)]"
      disabled={disabled}
    >
      <option value="">None (use default)</option>
      {contexts.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Job requisitions</h1>
        <button type="button" onClick={() => setShowCreate(true)} className="btn btn-primary">
          Create requisition
        </button>
      </div>
      <p className="sub-text text-sm mb-4">Active requisitions appear in the candidate registration dropdown. Edit any field below; Job Analysis Instructions are appended to the aggregated prompt (after System Instructions, before Job Information) for AI evaluation.</p>

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
            <div>
              <label className="block text-sm font-medium mb-1">Qualifications</label>
              <textarea
                value={createForm.qualifications}
                onChange={(e) => setCreateForm((f) => ({ ...f, qualifications: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)] min-h-[60px]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Skills</label>
              <textarea
                value={createForm.skills}
                onChange={(e) => setCreateForm((f) => ({ ...f, skills: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)] min-h-[60px]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Job Analysis Instructions</label>
              <p className="sub-text text-xs mb-1">Job-specific prompt text appended to the aggregated prompt after System Instructions (no header), before Job Information. Used for AI evaluation.</p>
              <textarea
                value={createForm.job_analysis_instructions}
                onChange={(e) => setCreateForm((f) => ({ ...f, job_analysis_instructions: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)] min-h-[100px]"
                placeholder="e.g. Focus on safety awareness and attention to detail for this DC role."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">LiveAvatar context (avatar persona for this job)</label>
              {contextSelect(createForm.liveavatar_context_id, (v) => setCreateForm((f) => ({ ...f, liveavatar_context_id: v })), contextsLoading)}
              {contextsLoading && <p className="text-xs sub-text mt-1">Loading contexts…</p>}
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
              className="rounded-lg border border-black/08 overflow-hidden"
              style={{ background: 'var(--card-bg)' }}
            >
              {editingId === r.id ? (
                <div className="p-4">
                  <h3 className="font-semibold mb-3">Edit requisition</h3>
                  <form onSubmit={handleUpdate} className="space-y-3">
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div>
                      <label className="block text-sm font-medium mb-1">Job requisition number *</label>
                      <input
                        type="text"
                        value={editForm.req_number}
                        onChange={(e) => setEditForm((f) => ({ ...f, req_number: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Job title *</label>
                      <input
                        type="text"
                        value={editForm.job_title}
                        onChange={(e) => setEditForm((f) => ({ ...f, job_title: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Status</label>
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)]"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="CLOSED">CLOSED</option>
                        <option value="ON_HOLD">ON_HOLD</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Job requirements</label>
                      <textarea
                        value={editForm.job_requirements}
                        onChange={(e) => setEditForm((f) => ({ ...f, job_requirements: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)] min-h-[80px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Qualifications</label>
                      <textarea
                        value={editForm.qualifications}
                        onChange={(e) => setEditForm((f) => ({ ...f, qualifications: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)] min-h-[60px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Skills</label>
                      <textarea
                        value={editForm.skills}
                        onChange={(e) => setEditForm((f) => ({ ...f, skills: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)] min-h-[60px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Job Analysis Instructions</label>
                      <p className="sub-text text-xs mb-1">Appended to aggregated prompt after System Instructions (no header), before Job Information.</p>
                      <textarea
                        value={editForm.job_analysis_instructions}
                        onChange={(e) => setEditForm((f) => ({ ...f, job_analysis_instructions: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)] min-h-[100px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">LiveAvatar context</label>
                      {contextSelect(editForm.liveavatar_context_id, (v) => setEditForm((f) => ({ ...f, liveavatar_context_id: v })), contextsLoading)}
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" disabled={savingEdit} className="btn btn-primary">
                        {savingEdit ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" onClick={() => { setEditingId(null); setEditForm(emptyEditForm); setError(''); }} className="btn sub-text">Cancel</button>
                    </div>
                  </form>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-3">
                    <div>
                      <span className="font-medium">{r.job_title}</span>
                      <span className="sub-text text-sm ml-2">({r.req_number})</span>
                      <span className="sub-text text-xs ml-2">{r.status}</span>
                      <p className="sub-text text-xs mt-1">Post date: {new Date(r.created_at).toLocaleDateString()}</p>
                      {r.job_analysis_instructions && (
                        <p className="sub-text text-xs mt-1 truncate max-w-md" title={r.job_analysis_instructions}>
                          Job Analysis: {r.job_analysis_instructions.length > 60 ? `${r.job_analysis_instructions.slice(0, 60)}…` : r.job_analysis_instructions}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="btn text-sm"
                      >
                        Edit
                      </button>
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
                    </div>
                  </div>
                </>
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
