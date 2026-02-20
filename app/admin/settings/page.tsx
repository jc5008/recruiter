'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminSettingsPage() {
  const [value, setValue] = useState('');
  const [reportEmail, setReportEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savedEmail, setSavedEmail] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data) => setRole(data?.user?.role ?? null))
      .catch(() => setRole(null));
  }, []);

  useEffect(() => {
    if (role !== 'SUPER_ADMIN') {
      setLoading(false);
      return;
    }
    Promise.all([
      fetch('/api/admin/settings/instruction-preface').then((r) => r.json()),
      fetch('/api/admin/settings/report-delivery-email').then((r) => r.json()),
    ])
      .then(([prefaceData, emailData]) => {
        if (prefaceData.error && prefaceData.error.includes('Forbidden')) return;
        setValue(prefaceData.value ?? '');
        if (emailData.error && emailData.error.includes('Forbidden')) return;
        setReportEmail(emailData.value ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [role]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/settings/instruction-preface', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save');
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Request failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveReportEmail(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSavingEmail(true);
    setSavedEmail(false);
    try {
      const res = await fetch('/api/admin/settings/report-delivery-email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: reportEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save');
        return;
      }
      setSavedEmail(true);
      setTimeout(() => setSavedEmail(false), 3000);
    } catch {
      setError('Request failed');
    } finally {
      setSavingEmail(false);
    }
  }

  if (role !== 'SUPER_ADMIN' && role !== null) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold mb-2">System settings</h1>
        <p className="sub-text">Access denied. Super Admin only.</p>
        <p className="mt-4">
          <Link href="/admin" className="text-sm sub-text hover:opacity-80">← Back to dashboard</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-2">System settings</h1>
      <p className="sub-text text-sm mb-4">Super Admin only. These values are used for AI analysis (e.g. Phase 6).</p>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Standard Instruction Preface</label>
          <p className="sub-text text-xs mb-2">Editable text used as the system instruction for AI interview analysis. Saved to <code className="bg-[var(--bg-color)] px-1 rounded">system_settings</code>. Applied to all future analyses (no retroactive).</p>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)] min-h-[200px] font-mono text-sm"
            placeholder="e.g. You are evaluating a candidate interview. Consider clarity, relevance, and professionalism."
            disabled={loading}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={saving || loading} className="btn btn-primary">
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && <span className="text-sm text-green-600">Saved.</span>}
        </div>
      </form>

      <form onSubmit={handleSaveReportEmail} className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Report delivery email (Phase 6.3)</label>
          <p className="sub-text text-xs mb-2">Email address that receives the post-interview screening report. Saved to <code className="bg-[var(--bg-color)] px-1 rounded">system_settings</code> (<code>report_delivery_email</code>). Used when sending the report via Resend.</p>
          <input
            type="email"
            value={reportEmail}
            onChange={(e) => setReportEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)] font-mono text-sm"
            placeholder="e.g. hr.automations@wvsupply.com"
            disabled={loading}
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={savingEmail || loading} className="btn btn-primary">
            {savingEmail ? 'Saving…' : 'Save'}
          </button>
          {savedEmail && <span className="text-sm text-green-600">Saved.</span>}
        </div>
      </form>

      <p className="mt-6">
        <Link href="/admin" className="text-sm sub-text hover:opacity-80">← Back to dashboard</Link>
      </p>
    </div>
  );
}
