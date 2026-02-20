'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setValid(false);
      return;
    }
    fetch(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => setValid(data.valid === true))
      .catch(() => setValid(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }
      setMessage(data.message || 'Password updated. You can sign in with your new password.');
      setTimeout(() => router.push('/admin/login'), 2000);
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (valid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-color)', color: 'var(--text-primary)' }}>
        <div className="w-full max-w-sm rounded-xl border border-black/08 shadow-lg overflow-hidden" style={{ background: 'var(--card-bg)' }}>
          <div className="p-6 text-center">Checking link…</div>
        </div>
      </div>
    );
  }

  if (!valid || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-color)', color: 'var(--text-primary)' }}>
        <div className="w-full max-w-sm rounded-xl border border-black/08 shadow-lg overflow-hidden" style={{ background: 'var(--card-bg)' }}>
          <div className="px-6 py-5 border-b border-black/08">
            <h1 className="text-lg font-semibold">Invalid or expired link</h1>
            <p className="text-sm sub-text mt-1">Virtual Interview | WV Supply</p>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm">This password reset link is invalid or has expired. Request a new one from the sign-in page.</p>
            <Link href="/admin/forgot-password" className="btn btn-primary w-full block text-center">
              Request new reset link
            </Link>
            <p className="text-sm text-center">
              <Link href="/admin/login" className="text-[var(--accent-red)] hover:underline">
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-color)', color: 'var(--text-primary)' }}>
      <div className="w-full max-w-sm rounded-xl border border-black/08 shadow-lg overflow-hidden" style={{ background: 'var(--card-bg)' }}>
        <div className="px-6 py-5 border-b border-black/08">
          <h1 className="text-lg font-semibold">Set new password</h1>
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
            <label htmlFor="password" className="block text-sm font-medium mb-1">New password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)] text-[var(--text-primary)]"
              required
              minLength={8}
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">Confirm new password</label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)] text-[var(--text-primary)]"
              required
              minLength={8}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? 'Saving…' : 'Save new password'}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-color)' }}>
        <div className="text-sm">Loading…</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
