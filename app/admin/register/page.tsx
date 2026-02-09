'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Requisition = { id: string; req_number: string; job_title: string };

export default function AdminRegisterPage() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loadingReqs, setLoadingReqs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    access_code: string;
    candidate_first_name: string;
    candidate_last_name: string;
    job_title: string;
    deadline_at: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    candidate_first_name: '',
    candidate_last_name: '',
    candidate_email: '',
    requisition_id: '',
    deadline_at: '',
    resume_text: '',
    registrant_name: '',
  });

  useEffect(() => {
    fetch('/api/admin/requisitions/list')
      .then((r) => r.json())
      .then((data) => {
        if (data.requisitions) setRequisitions(data.requisitions);
      })
      .catch(() => setRequisitions([]))
      .finally(() => setLoadingReqs(false));
  }, []);

  useEffect(() => {
    if (!form.deadline_at) {
      const d = new Date();
      d.setDate(d.getDate() + 5);
      setForm((f) => ({ ...f, deadline_at: d.toISOString().slice(0, 16) }));
    }
  }, [form.deadline_at]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    setResult(null);
    try {
      const deadline = form.deadline_at ? new Date(form.deadline_at).toISOString() : undefined;
      const res = await fetch('/api/admin/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_first_name: form.candidate_first_name.trim(),
          candidate_last_name: form.candidate_last_name.trim(),
          candidate_email: form.candidate_email.trim(),
          requisition_id: form.requisition_id || undefined,
          deadline_at: deadline,
          resume_text: form.resume_text.trim() || undefined,
          registrant_name: form.registrant_name.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to register');
        return;
      }
      const req = requisitions.find((r) => r.id === form.requisition_id);
      setResult({
        access_code: data.access_code,
        candidate_first_name: data.candidate_first_name,
        candidate_last_name: data.candidate_last_name,
        job_title: req ? req.job_title : '',
        deadline_at: data.deadline_at,
      });
      setForm({
        candidate_first_name: '',
        candidate_last_name: '',
        candidate_email: '',
        requisition_id: '',
        deadline_at: '',
        resume_text: '',
        registrant_name: form.registrant_name,
      });
    } catch {
      setError('Request failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCode() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.access_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed');
    }
  }

  if (result) {
    return (
      <div className="max-w-lg">
        <h1 className="text-xl font-semibold mb-2">Candidate registered</h1>
        <div className="p-4 rounded-lg border border-black/08 space-y-2" style={{ background: 'var(--card-bg)' }}>
          <p><strong>{result.candidate_first_name} {result.candidate_last_name}</strong></p>
          <p className="sub-text text-sm">Job: {result.job_title}</p>
          <p className="sub-text text-sm">Deadline: {new Date(result.deadline_at).toLocaleString()}</p>
          <div className="flex items-center gap-2 pt-2">
            <span className="font-mono font-semibold text-lg">{result.access_code}</span>
            <button type="button" onClick={copyCode} className="btn btn-primary text-sm">
              {copied ? 'Copied' : 'Copy to clipboard'}
            </button>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setResult(null)} className="btn btn-primary">
            Register another
          </button>
          <Link href="/admin" className="btn sub-text">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-2">Register new candidate</h1>
      <p className="sub-text text-sm mb-4">Create an interview and get an access code. Confirmation can be emailed to hr.automations@wvsupply.com when email is configured.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div>
          <label className="block text-sm font-medium mb-1">Candidate first name *</label>
          <input
            type="text"
            value={form.candidate_first_name}
            onChange={(e) => setForm((f) => ({ ...f, candidate_first_name: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)]"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Candidate last name *</label>
          <input
            type="text"
            value={form.candidate_last_name}
            onChange={(e) => setForm((f) => ({ ...f, candidate_last_name: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)]"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Job title / Requisition *</label>
          <select
            value={form.requisition_id}
            onChange={(e) => setForm((f) => ({ ...f, requisition_id: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)]"
            required
            disabled={loadingReqs}
          >
            <option value="">Select a job</option>
            {requisitions.map((r) => (
              <option key={r.id} value={r.id}>{r.job_title} ({r.req_number})</option>
            ))}
          </select>
          {loadingReqs && <p className="sub-text text-xs mt-1">Loading…</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Candidate email *</label>
          <input
            type="email"
            value={form.candidate_email}
            onChange={(e) => setForm((f) => ({ ...f, candidate_email: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)]"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Interview access deadline</label>
          <input
            type="datetime-local"
            value={form.deadline_at}
            onChange={(e) => setForm((f) => ({ ...f, deadline_at: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)]"
          />
          <p className="sub-text text-xs mt-1">Default: 5 days from today</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Resume (plain text)</label>
          <textarea
            value={form.resume_text}
            onChange={(e) => setForm((f) => ({ ...f, resume_text: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)] min-h-[100px]"
            placeholder="Paste resume text for AI evaluation"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Registrant name</label>
          <input
            type="text"
            value={form.registrant_name}
            onChange={(e) => setForm((f) => ({ ...f, registrant_name: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)]"
            placeholder="Pre-filled from logged-in user when configured"
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? 'Submitting…' : 'Register candidate'}
          </button>
          <Link href="/admin" className="btn sub-text">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
