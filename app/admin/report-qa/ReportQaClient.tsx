'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Speaker = 'USER' | 'AVATAR';
type TranscriptRow = { id: string; speaker: Speaker; content: string; timestamp_seconds: string };
type RunSummary = {
  id: string;
  scenario_name: string | null;
  status: string;
  failed_stage: string | null;
  error_message: string | null;
  created_at: string;
  created_by_name: string;
  candidate_name: string;
  model: string | null;
  token_usage_input: number | null;
  token_usage_output: number | null;
  email_delivery_status: string | null;
  delivery_message_id: string | null;
  can_retry: boolean;
};
type RunDetail = RunSummary & {
  interview_id: string;
  input: unknown;
  aggregated_prompt_text: string | null;
  ai_evaluation_json: { report_markdown?: string } | null;
};

function localDateTime(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function newTranscriptRow(speaker: Speaker = 'AVATAR'): TranscriptRow {
  return { id: crypto.randomUUID(), speaker, content: '', timestamp_seconds: '' };
}

function initialForm() {
  const ended = new Date();
  const started = new Date(ended.getTime() - 15 * 60_000);
  return {
    scenario_name: '',
    system_instruction_preface: '',
    candidate_first_name: 'QA',
    candidate_last_name: 'Candidate',
    candidate_email: 'qa-candidate@wvsupply.local',
    resume_text: '',
    job_title: 'QA Test Position',
    job_requirements: '',
    qualifications: '',
    skills: '',
    job_analysis_instructions: '',
    started_at: localDateTime(started),
    ended_at: localDateTime(ended),
    duration_seconds: '900',
    transcript: [newTranscriptRow('AVATAR'), newTranscriptRow('USER')],
  };
}

export default function ReportQaClient() {
  const [form, setForm] = useState(initialForm);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [deliveryEmail, setDeliveryEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const instructionDefaultLoaded = useRef(false);
  const instructionWasEdited = useRef(false);

  const loadRuns = useCallback(async () => {
    const response = await fetch('/api/admin/report-qa/runs?limit=25', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load QA runs');
    setRuns(data.runs || []);
    setDeliveryEmail(data.configuration?.report_delivery_email || '');
    if (!instructionDefaultLoaded.current) {
      if (!instructionWasEdited.current) {
        setForm((current) => ({
          ...current,
          system_instruction_preface: data.configuration?.instruction_preface || '',
        }));
      }
      instructionDefaultLoaded.current = true;
    }
  }, []);

  useEffect(() => {
    loadRuns().catch((cause) => setError(cause instanceof Error ? cause.message : 'Failed to load QA runs'))
      .finally(() => setLoading(false));
  }, [loadRuns]);

  useEffect(() => {
    if (!activeRunId || !submitting) return;
    const timer = window.setInterval(() => {
      fetch(`/api/admin/report-qa/runs/${activeRunId}`, { cache: 'no-store' })
        .then(async (response) => response.ok ? response.json() : null)
        .then((data) => {
          if (data?.run?.status) setActiveStage(data.run.status);
        })
        .catch(() => undefined);
    }, 1_200);
    return () => window.clearInterval(timer);
  }, [activeRunId, submitting]);

  const durationMismatch = useMemo(() => {
    if (!form.started_at || !form.ended_at || !form.duration_seconds) return false;
    const calculated = Math.round((new Date(form.ended_at).getTime() - new Date(form.started_at).getTime()) / 1_000);
    return calculated >= 0 && calculated !== Number(form.duration_seconds);
  }, [form.started_at, form.ended_at, form.duration_seconds]);

  function updateField(field: string, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateTimestamp(field: 'started_at' | 'ended_at', value: string) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (next.started_at && next.ended_at) {
        const seconds = Math.round((new Date(next.ended_at).getTime() - new Date(next.started_at).getTime()) / 1_000);
        if (seconds >= 0) next.duration_seconds = String(seconds);
      }
      return next;
    });
  }

  function updateTranscript(id: string, patch: Partial<TranscriptRow>) {
    setForm((current) => ({
      ...current,
      transcript: current.transcript.map((row) => row.id === id ? { ...row, ...patch } : row),
    }));
  }

  function moveTranscript(index: number, direction: -1 | 1) {
    setForm((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.transcript.length) return current;
      const transcript = [...current.transcript];
      [transcript[index], transcript[target]] = [transcript[target], transcript[index]];
      return { ...current, transcript };
    });
  }

  async function viewRun(id: string) {
    setError('');
    const response = await fetch(`/api/admin/report-qa/runs/${id}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Failed to load QA run');
      return;
    }
    setDetail(data.run);
  }

  async function submitScenario(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setDetail(null);
    setSubmitting(true);
    setActiveStage('PERSISTED');
    const runId = crypto.randomUUID();
    setActiveRunId(runId);
    try {
      const response = await fetch('/api/admin/report-qa/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run_id: runId,
          scenario_name: form.scenario_name,
          input: {
            system_instruction_preface: form.system_instruction_preface,
            candidate: {
              first_name: form.candidate_first_name,
              last_name: form.candidate_last_name,
              email: form.candidate_email,
              resume_text: form.resume_text,
            },
            job: {
              title: form.job_title,
              requirements: form.job_requirements,
              qualifications: form.qualifications,
              skills: form.skills,
              job_analysis_instructions: form.job_analysis_instructions,
            },
            interview: {
              started_at: form.started_at ? new Date(form.started_at).toISOString() : null,
              ended_at: form.ended_at ? new Date(form.ended_at).toISOString() : null,
              duration_seconds: form.duration_seconds === '' ? null : Number(form.duration_seconds),
            },
            transcript: form.transcript
              .filter((row) => row.content.trim())
              .map((row) => ({
                speaker: row.speaker,
                content: row.content,
                timestamp_offset_ms: row.timestamp_seconds === '' ? null : Math.round(Number(row.timestamp_seconds) * 1_000),
              })),
          },
        }),
      });
      const data = await response.json();
      setActiveStage(data.processing?.stage || (response.ok ? 'COMPLETED' : 'FAILED'));
      if (!response.ok) throw new Error(data.processing?.error || data.error || 'QA report run failed');
      const evaluation = data.processing?.evaluation;
      setSuccess(
        `QA report completed and emailed. Run ${runId}. Model ${evaluation?.model || 'unknown'}; ` +
        `${evaluation?.token_usage_input ?? 0} input / ${evaluation?.token_usage_output ?? 0} output tokens; ` +
        `Resend message ${data.processing?.delivery?.message_id || 'not returned'}.`
      );
      await viewRun(runId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'QA report run failed');
    } finally {
      setSubmitting(false);
      await loadRuns().catch(() => undefined);
    }
  }

  async function retryRun(id: string) {
    setError('');
    setSuccess('');
    setSubmitting(true);
    setActiveRunId(id);
    setActiveStage('PERSISTED');
    try {
      const response = await fetch(`/api/admin/report-qa/runs/${id}/retry`, { method: 'POST' });
      const data = await response.json();
      setActiveStage(data.processing?.stage || (response.ok ? 'COMPLETED' : 'FAILED'));
      if (!response.ok) throw new Error(data.processing?.error || data.error || 'Retry failed');
      setSuccess(`QA run ${id} completed on retry and the report email was sent.`);
      await viewRun(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Retry failed');
    } finally {
      setSubmitting(false);
      await loadRuns().catch(() => undefined);
    }
  }

  const fieldClass = 'w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)]';
  const sectionClass = 'p-4 rounded-lg border border-black/08 space-y-4';

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold mb-2">Post-Interview Report QA</h1>
        <p className="sub-text text-sm">Supply the report agent&apos;s raw ingredients directly. This skips registration and LiveAvatar, then runs the real evaluation, PDF, and email pipeline.</p>
      </div>

      <div className="p-4 rounded-lg border border-amber-300 bg-amber-50 text-amber-950 text-sm">
        <strong>Real delivery:</strong> a successful submission emails the generated PDF to {deliveryEmail || 'the address configured in Admin → Settings'}.
      </div>

      {error && <p role="alert" className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</p>}
      {success && <p role="status" className="p-3 rounded-lg bg-green-50 text-green-700 text-sm">{success}</p>}
      {activeRunId && (
        <div className="p-3 rounded-lg border border-black/08 text-sm" style={{ background: 'var(--card-bg)' }}>
          <strong>Active run:</strong> <code>{activeRunId}</code> — <span>{activeStage || 'Starting'}</span>
        </div>
      )}

      <form onSubmit={submitScenario} className="space-y-5">
        <section className={sectionClass} style={{ background: 'var(--card-bg)' }}>
          <h2 className="font-semibold">Scenario metadata</h2>
          <label className="block text-sm">Scenario name (not sent to the agent)
            <input value={form.scenario_name} onChange={(e) => updateField('scenario_name', e.target.value)} maxLength={200} className={`${fieldClass} mt-1`} />
          </label>
        </section>

        <section className={sectionClass} style={{ background: 'var(--card-bg)' }}>
          <h2 className="font-semibold">System instructions</h2>
          <label className="block text-sm">Instruction preface
            <textarea
              value={form.system_instruction_preface}
              onChange={(e) => {
                instructionWasEdited.current = true;
                updateField('system_instruction_preface', e.target.value);
              }}
              className={`${fieldClass} mt-1 min-h-40 font-mono text-xs`}
            />
          </label>
        </section>

        <section className={sectionClass} style={{ background: 'var(--card-bg)' }}>
          <h2 className="font-semibold">Job information</h2>
          <label className="block text-sm">Job title *
            <input required value={form.job_title} onChange={(e) => updateField('job_title', e.target.value)} maxLength={150} className={`${fieldClass} mt-1`} />
          </label>
          {[
            ['job_requirements', 'Job requirements'],
            ['qualifications', 'Qualifications'],
            ['skills', 'Skills'],
            ['job_analysis_instructions', 'Job analysis instructions'],
          ].map(([field, label]) => (
            <label key={field} className="block text-sm">{label}
              <textarea value={form[field as keyof typeof form] as string} onChange={(e) => updateField(field, e.target.value)} className={`${fieldClass} mt-1 min-h-24`} />
            </label>
          ))}
        </section>

        <section className={sectionClass} style={{ background: 'var(--card-bg)' }}>
          <h2 className="font-semibold">Candidate information</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block text-sm">First name *
              <input required value={form.candidate_first_name} onChange={(e) => updateField('candidate_first_name', e.target.value)} maxLength={100} className={`${fieldClass} mt-1`} />
            </label>
            <label className="block text-sm">Last name *
              <input required value={form.candidate_last_name} onChange={(e) => updateField('candidate_last_name', e.target.value)} maxLength={100} className={`${fieldClass} mt-1`} />
            </label>
          </div>
          <label className="block text-sm">Email *
            <input required type="email" value={form.candidate_email} onChange={(e) => updateField('candidate_email', e.target.value)} maxLength={255} className={`${fieldClass} mt-1`} />
          </label>
          <label className="block text-sm">Resume text
            <textarea value={form.resume_text} onChange={(e) => updateField('resume_text', e.target.value)} className={`${fieldClass} mt-1 min-h-40`} />
          </label>
        </section>

        <section className={sectionClass} style={{ background: 'var(--card-bg)' }}>
          <h2 className="font-semibold">Interview metadata</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <label className="block text-sm">Started
              <input type="datetime-local" value={form.started_at} onChange={(e) => updateTimestamp('started_at', e.target.value)} className={`${fieldClass} mt-1`} />
            </label>
            <label className="block text-sm">Ended
              <input type="datetime-local" value={form.ended_at} onChange={(e) => updateTimestamp('ended_at', e.target.value)} className={`${fieldClass} mt-1`} />
            </label>
            <label className="block text-sm">Duration seconds
              <input type="number" min="0" max="86400" step="1" value={form.duration_seconds} onChange={(e) => updateField('duration_seconds', e.target.value)} className={`${fieldClass} mt-1`} />
            </label>
          </div>
          {durationMismatch && <p className="text-xs text-amber-700">The entered duration intentionally differs from the timestamps and will be preserved.</p>}
        </section>

        <section className={sectionClass} style={{ background: 'var(--card-bg)' }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Transcript</h2>
              <p className="sub-text text-xs">Blank rows are ignored, allowing an intentionally empty transcript.</p>
            </div>
            <button type="button" onClick={() => setForm((current) => ({ ...current, transcript: [...current.transcript, newTranscriptRow('USER')] }))} className="btn">Add segment</button>
          </div>
          {form.transcript.map((row, index) => (
            <div key={row.id} className="grid md:grid-cols-[150px_1fr_120px_auto] gap-2 items-start p-3 rounded-lg border border-black/08">
              <select aria-label={`Speaker for segment ${index + 1}`} value={row.speaker} onChange={(e) => updateTranscript(row.id, { speaker: e.target.value as Speaker })} className={fieldClass}>
                <option value="AVATAR">Interviewer</option>
                <option value="USER">Candidate</option>
              </select>
              <textarea aria-label={`Text for segment ${index + 1}`} value={row.content} onChange={(e) => updateTranscript(row.id, { content: e.target.value })} placeholder="Transcript text" className={`${fieldClass} min-h-20`} />
              <input aria-label={`Timestamp seconds for segment ${index + 1}`} type="number" min="0" step="0.001" value={row.timestamp_seconds} onChange={(e) => updateTranscript(row.id, { timestamp_seconds: e.target.value })} placeholder="Seconds" className={fieldClass} />
              <div className="flex md:flex-col gap-1">
                <button type="button" onClick={() => moveTranscript(index, -1)} disabled={index === 0} className="btn text-xs" aria-label={`Move segment ${index + 1} up`}>↑</button>
                <button type="button" onClick={() => moveTranscript(index, 1)} disabled={index === form.transcript.length - 1} className="btn text-xs" aria-label={`Move segment ${index + 1} down`}>↓</button>
                <button type="button" onClick={() => setForm((current) => ({ ...current, transcript: current.transcript.filter((item) => item.id !== row.id) }))} className="btn text-xs" aria-label={`Remove segment ${index + 1}`}>×</button>
              </div>
            </div>
          ))}
        </section>

        <button type="submit" disabled={submitting || loading} className="btn btn-primary">
          {loading
            ? 'Loading settings…'
            : submitting
              ? `Running: ${activeStage || 'starting'}…`
              : 'Run QA report and send email'}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent QA runs</h2>
        {loading ? <p className="sub-text">Loading…</p> : runs.length === 0 ? <p className="sub-text">No QA runs yet.</p> : (
          <div className="overflow-x-auto rounded-lg border border-black/08">
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--card-bg)' }}><tr>
                <th className="text-left p-3">Scenario</th><th className="text-left p-3">Candidate</th><th className="text-left p-3">Status</th><th className="text-left p-3">Created</th><th className="text-left p-3">Actions</th>
              </tr></thead>
              <tbody>{runs.map((run) => (
                <tr key={run.id} className="border-t border-black/08">
                  <td className="p-3">{run.scenario_name || 'Untitled'}<span className="block sub-text text-xs">{run.created_by_name}</span></td>
                  <td className="p-3">{run.candidate_name}</td>
                  <td className="p-3"><span className="font-medium">{run.status}</span>{run.failed_stage && <span className="block text-red-600 text-xs">{run.failed_stage}</span>}</td>
                  <td className="p-3 whitespace-nowrap">{new Date(run.created_at).toLocaleString()}</td>
                  <td className="p-3 whitespace-nowrap"><button type="button" onClick={() => viewRun(run.id)} className="btn text-xs mr-2">View</button>{run.can_retry && <button type="button" disabled={submitting} onClick={() => retryRun(run.id)} className="btn btn-primary text-xs">Retry</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {detail && (
        <section className={sectionClass} style={{ background: 'var(--card-bg)' }}>
          <div className="flex items-center justify-between"><h2 className="font-semibold">Run details: {detail.id}</h2><button type="button" onClick={() => setDetail(null)} className="btn text-xs">Close</button></div>
          <p className="text-sm"><strong>Status:</strong> {detail.status} · <strong>Delivery:</strong> {detail.email_delivery_status || 'Not attempted'} · <strong>Model:</strong> {detail.model || 'Not evaluated'}</p>
          <p className="text-sm"><strong>Resend message ID:</strong> {detail.delivery_message_id || 'Not available'}</p>
          {detail.error_message && <p className="text-sm text-red-700">{detail.error_message}</p>}
          <details><summary className="cursor-pointer font-medium">Immutable input snapshot</summary><pre className="mt-2 p-3 overflow-auto max-h-96 text-xs bg-black/5 rounded">{JSON.stringify(detail.input, null, 2)}</pre></details>
          <details><summary className="cursor-pointer font-medium">Aggregated prompt</summary><pre className="mt-2 p-3 overflow-auto max-h-96 whitespace-pre-wrap text-xs bg-black/5 rounded">{detail.aggregated_prompt_text || 'Not compiled'}</pre></details>
          <details><summary className="cursor-pointer font-medium">Evaluation report</summary><div className="mt-2 p-3 overflow-auto max-h-96 whitespace-pre-wrap text-sm bg-black/5 rounded">{detail.ai_evaluation_json?.report_markdown || 'Not evaluated'}</div></details>
        </section>
      )}
    </div>
  );
}
