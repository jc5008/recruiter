'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Interview = {
  id: string;
  candidate_name: string;
  candidate_email: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string | null;
};

export default function AdminDeveloperPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [selectedInterviewId, setSelectedInterviewId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [compiling, setCompiling] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [role, setRole] = useState<string | null>(null);

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
    fetch('/api/admin/developer/interviews')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setInterviews(data.interviews ?? []);
      })
      .catch((err) => {
        setError('Failed to load interviews');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [role]);

  async function handleCompile() {
    if (!selectedInterviewId) {
      setError('Please select a candidate');
      return;
    }

    setError('');
    setSuccess('');
    setCompiling(true);

    try {
      const res = await fetch('/api/admin/developer/compile-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId: selectedInterviewId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to compile report');
        return;
      }

      setSuccess(
        `Report compiled successfully for ${data.candidate_name}. ${data.transcript_segments} transcript segments, ${data.prompt_length} characters.`
      );
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError('Request failed');
      console.error(err);
    } finally {
      setCompiling(false);
    }
  }

  async function handleRunEvaluation() {
    if (!selectedInterviewId) {
      setError('Please select a candidate');
      return;
    }

    setError('');
    setSuccess('');
    setEvaluating(true);

    try {
      const res = await fetch('/api/admin/developer/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId: selectedInterviewId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to run evaluation');
        return;
      }

      setSuccess(
        `Evaluation completed for ${data.interview_id}. Model: ${data.model}. Tokens: ${data.token_usage_input} in / ${data.token_usage_output} out. Report length: ${data.report_length} chars.`
      );
      setTimeout(() => setSuccess(''), 8000);
    } catch (err) {
      setError('Request failed');
      console.error(err);
    } finally {
      setEvaluating(false);
    }
  }

  async function handleDeliver() {
    if (!selectedInterviewId) {
      setError('Please select a candidate');
      return;
    }

    setError('');
    setSuccess('');
    setDelivering(true);

    try {
      const res = await fetch('/api/admin/developer/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId: selectedInterviewId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to deliver report');
        return;
      }

      setSuccess(
        `Report sent for ${data.interview_id}.${data.message_id ? ` Message ID: ${data.message_id}` : ''}`
      );
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError('Request failed');
      console.error(err);
    } finally {
      setDelivering(false);
    }
  }

  if (role !== 'SUPER_ADMIN' && role !== null) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold mb-2">Developer tools</h1>
        <p className="sub-text">Access denied. Super Admin only.</p>
        <p className="mt-4">
          <Link href="/admin" className="text-sm sub-text hover:opacity-80">
            ← Back to dashboard
          </Link>
        </p>
      </div>
    );
  }

  const selectedInterview = interviews.find((i) => i.id === selectedInterviewId);

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-2">Developer tools</h1>
      <p className="sub-text text-sm mb-4">
        Compile aggregated reports (6.1), run AI evaluation (6.2), and deliver report by email (6.3). Compile triggers the same process as when a candidate clicks "Leave Interview". Run evaluation calls OpenAI to generate the screening report (requires aggregated prompt first). Deliver sends the report to the email configured in Admin → Settings via Resend.
      </p>

      {loading ? (
        <p className="sub-text">Loading interviews...</p>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select candidate interview</label>
            <select
              value={selectedInterviewId}
              onChange={(e) => setSelectedInterviewId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)]"
              disabled={compiling || evaluating || delivering}
            >
              <option value="">-- Select a candidate --</option>
              {interviews.map((interview) => (
                <option key={interview.id} value={interview.id}>
                  {interview.candidate_name} ({interview.candidate_email}) - {interview.status}
                  {interview.ended_at ? ` - Completed ${new Date(interview.ended_at).toLocaleDateString()}` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedInterview && (
            <div className="p-4 rounded-lg border border-black/08" style={{ background: 'var(--card-bg)' }}>
              <p className="text-sm">
                <strong>Status:</strong> {selectedInterview.status}
              </p>
              {selectedInterview.started_at && (
                <p className="text-sm mt-1">
                  <strong>Started:</strong> {new Date(selectedInterview.started_at).toLocaleString()}
                </p>
              )}
              {selectedInterview.ended_at && (
                <p className="text-sm mt-1">
                  <strong>Ended:</strong> {new Date(selectedInterview.ended_at).toLocaleString()}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleCompile}
              disabled={!selectedInterviewId || compiling || evaluating || delivering}
              className="btn btn-primary"
            >
              {compiling ? 'Compiling...' : 'Compile Aggregated Report'}
            </button>
            <button
              onClick={handleRunEvaluation}
              disabled={!selectedInterviewId || compiling || evaluating || delivering}
              className="btn btn-primary"
              title="Send aggregated prompt to OpenAI and save the screening report"
            >
              {evaluating ? 'Running evaluation...' : 'Trigger evaluation to OpenAI'}
            </button>
            <button
              onClick={handleDeliver}
              disabled={!selectedInterviewId || compiling || evaluating || delivering}
              className="btn btn-primary"
              title="Send screening report to configured email via Resend (Phase 6.3)"
            >
              {delivering ? 'Sending...' : 'Deliver report (email)'}
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
        </div>
      )}

      <p className="mt-6">
        <Link href="/admin" className="text-sm sub-text hover:opacity-80">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
