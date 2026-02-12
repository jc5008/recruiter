'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type User = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [addResult, setAddResult] = useState<{ tempPassword: string; user: User } | null>(null);
  const [copied, setCopied] = useState(false);

  const [addForm, setAddForm] = useState({ first_name: '', last_name: '', email: '', role: 'ADMIN' });
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', role: '', status: '' });

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data) => setRole(data?.user?.role ?? null))
      .catch(() => setRole(null));
  }, []);

  function loadUsers() {
    setLoading(true);
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((data) => {
        if (data.error && data.error.includes('Forbidden')) {
          setUsers([]);
          return;
        }
        if (data.users) setUsers(data.users);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (role === 'SUPER_ADMIN') loadUsers();
    else setLoading(false);
  }, [role]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    setAddResult(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: addForm.first_name.trim(),
          last_name: addForm.last_name.trim(),
          email: addForm.email.trim(),
          role: addForm.role,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create user');
        return;
      }
      setAddResult({ tempPassword: data.tempPassword, user: data.user });
      setAddForm({ first_name: '', last_name: '', email: '', role: 'ADMIN' });
      loadUsers();
    } catch {
      setError('Request failed');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(u: User) {
    setEditingId(u.id);
    setEditForm({ first_name: u.first_name, last_name: u.last_name, role: u.role, status: u.status });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: editForm.first_name.trim(),
          last_name: editForm.last_name.trim(),
          role: editForm.role,
          status: editForm.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update');
        return;
      }
      setEditingId(null);
      loadUsers();
    } catch {
      setError('Request failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function deactivate(id: string) {
    if (!confirm('Deactivate this user? They will no longer be able to sign in.')) return;
    setDeactivating(id);
    try {
      const res = await fetch(`/api/admin/users/${id}/deactivate`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to deactivate');
        return;
      }
      setEditingId(null);
      loadUsers();
    } catch {
      setError('Request failed');
    } finally {
      setDeactivating(null);
    }
  }

  async function copyTempPassword() {
    if (!addResult) return;
    try {
      await navigator.clipboard.writeText(addResult.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed');
    }
  }

  if (role !== 'SUPER_ADMIN' && role !== null) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold mb-2">User management</h1>
        <p className="sub-text">Access denied. Super Admin only.</p>
        <p className="mt-4">
          <Link href="/admin" className="text-sm sub-text hover:opacity-80">← Back to dashboard</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">User management</h1>
        <button type="button" onClick={() => { setShowAdd(true); setAddResult(null); }} className="btn btn-primary">
          Add user
        </button>
      </div>
      <p className="sub-text text-sm mb-4">Super Admin only. List, add, edit, and deactivate admin users. Changes are audited.</p>

      {showAdd && (
        <div className="mb-6 p-4 rounded-lg border border-black/08" style={{ background: 'var(--card-bg)' }}>
          <h2 className="font-semibold mb-3">New user</h2>
          {addResult ? (
            <div className="space-y-2">
              <p className="text-sm">User created: <strong>{addResult.user.first_name} {addResult.user.last_name}</strong> ({addResult.user.email})</p>
              <p className="text-sm sub-text">Temporary password (share securely with the user):</p>
              <div className="flex items-center gap-2">
                <code className="px-2 py-1 rounded bg-[var(--bg-color)] text-sm font-mono">{addResult.tempPassword}</code>
                <button type="button" onClick={copyTempPassword} className="btn btn-primary text-sm">
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-xs sub-text">User should change this after first login.</p>
              <div className="flex gap-2 mt-3">
                <button type="button" onClick={() => { setAddResult(null); setShowAdd(false); }} className="btn btn-primary">Done</button>
                <button type="button" onClick={() => { setAddResult(null); setAddForm({ first_name: '', last_name: '', email: '', role: 'ADMIN' }); }} className="btn sub-text">Add another</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAdd} className="space-y-3">
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">First name *</label>
                  <input type="text" value={addForm.first_name} onChange={(e) => setAddForm((f) => ({ ...f, first_name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)]" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Last name *</label>
                  <input type="text" value={addForm.last_name} onChange={(e) => setAddForm((f) => ({ ...f, last_name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)]" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input type="email" value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)]" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select value={addForm.role} onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)]">
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="ADMIN">Admin</option>
                  <option value="OBSERVER">Observer</option>
                  <option value="AUDITOR">Auditor</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={submitting} className="btn btn-primary">{submitting ? 'Creating…' : 'Create user'}</button>
                <button type="button" onClick={() => { setShowAdd(false); setError(''); }} className="btn sub-text">Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}

      {!showAdd && error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      {loading ? (
        <p className="sub-text">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.id} className="p-3 rounded-lg border border-black/08" style={{ background: 'var(--card-bg)' }}>
              {editingId === u.id ? (
                <form onSubmit={handleEdit} className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={editForm.first_name} onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))} className="px-2 py-1 rounded border border-black/12 bg-[var(--bg-color)] text-sm" placeholder="First name" />
                    <input type="text" value={editForm.last_name} onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))} className="px-2 py-1 rounded border border-black/12 bg-[var(--bg-color)] text-sm" placeholder="Last name" />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))} className="px-2 py-1 rounded border border-black/12 bg-[var(--bg-color)] text-sm">
                      <option value="SUPER_ADMIN">Super Admin</option>
                      <option value="ADMIN">Admin</option>
                      <option value="OBSERVER">Observer</option>
                      <option value="AUDITOR">Auditor</option>
                    </select>
                    <select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))} className="px-2 py-1 rounded border border-black/12 bg-[var(--bg-color)] text-sm">
                      <option value="ACTIVE">Active</option>
                      <option value="SUSPENDED">Suspended</option>
                      <option value="DEACTIVATED">Deactivated</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={submitting} className="btn btn-primary text-sm">Save</button>
                    <button type="button" onClick={() => setEditingId(null)} className="btn sub-text text-sm">Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="font-medium">{u.first_name} {u.last_name}</span>
                    <span className="sub-text text-sm ml-2">{u.email}</span>
                    <span className="sub-text text-xs ml-2">{u.role}</span>
                    <span className="sub-text text-xs ml-2">{u.status}</span>
                    <p className="sub-text text-xs mt-1">Last login: {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : '—'}</p>
                  </div>
                  <div className="flex gap-2">
                    {u.status !== 'DEACTIVATED' && (
                      <>
                        <button type="button" onClick={() => startEdit(u)} className="btn text-sm sub-text">Edit</button>
                        <button type="button" onClick={() => deactivate(u.id)} disabled={deactivating === u.id} className="btn text-sm sub-text hover:text-red-600">
                          {deactivating === u.id ? 'Deactivating…' : 'Deactivate'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
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
