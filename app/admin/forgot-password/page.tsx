'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      let data: { error?: string; message?: string };
      try {
        data = await res.json();
      } catch {
        setError(res.ok ? 'Invalid response from server' : `Server error (${res.status}). Check the terminal where dev server is running.`);
        return;
      }
      if (!res.ok) {
        setError(data.error || `Request failed (${res.status}). Check the terminal for details.`);
        return;
      }
      setMessage(data.message || 'If that email is registered, we sent a password reset link. Check your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-color)', color: 'var(--text-primary)' }}>
      <div className="w-full max-w-sm rounded-xl border border-black/08 shadow-lg overflow-hidden" style={{ background: 'var(--card-bg)' }}>
        <div className="px-6 py-5 border-b border-black/08">
          <h1 className="text-lg font-semibold">Forgot password</h1>
          <p className="text-sm sub-text mt-1">Virtual Interview | WV Supply</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="text-sm text-red-600" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="text-sm text-green-700" role="status">
              {message}
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)] text-[var(--text-primary)]"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? 'Sending…' : 'Email me a password reset link'}
          </button>
          <p className="text-sm text-center">
            <Link href="/admin/login" className="text-[var(--accent-red)] hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
