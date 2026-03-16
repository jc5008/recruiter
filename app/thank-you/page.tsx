'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const INTERVIEW_ID_KEY = 'interview_id';

const RADIO_OVERALL = [
  { value: 'very_good', label: 'Very good' },
  { value: 'good', label: 'Good' },
  { value: 'okay', label: 'Okay' },
  { value: 'difficult', label: 'Difficult' },
  { value: 'very_difficult', label: 'Very difficult' },
];
const RADIO_EASE = [
  { value: 'very_easy', label: 'Very easy' },
  { value: 'easy', label: 'Easy' },
  { value: 'somewhat_confusing', label: 'Somewhat confusing' },
  { value: 'very_confusing', label: 'Very confusing' },
];
const RADIO_COMFORT = [
  { value: 'very_comfortable', label: 'Very comfortable' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'uncomfortable', label: 'Uncomfortable' },
];
const RADIO_TECHNICAL = [
  { value: 'no_problems', label: 'No problems' },
  { value: 'minor_problems', label: 'Minor problems but finished' },
  { value: 'major_problems', label: 'Major problems' },
];
const RADIO_FAIR = [
  { value: 'yes', label: 'Yes' },
  { value: 'mostly', label: 'Mostly' },
  { value: 'not_really', label: 'Not really' },
  { value: 'no', label: 'No' },
];
const CHECKBOX_ISSUES = [
  { value: 'audio_mic', label: 'Audio or microphone' },
  { value: 'video_camera', label: 'Video or camera' },
  { value: 'internet', label: 'Internet connection' },
  { value: 'instructions_unclear', label: 'Instructions were unclear' },
  { value: 'something_else', label: 'Something else' },
];

export default function ThankYouPage() {
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    overall_experience: '',
    ease_of_use: '',
    comfort_level: '',
    technical_problems: '',
    technical_issue_types: [] as string[],
    fair_chance: '',
    additional_comments: '',
    contact_requested: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = sessionStorage.getItem(INTERVIEW_ID_KEY);
    setInterviewId(id?.trim() || null);
  }, []);

  const showTechnicalIssueTypes = form.technical_problems === 'minor_problems' || form.technical_problems === 'major_problems';

  function handleIssueChange(value: string, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      technical_issue_types: checked
        ? [...prev.technical_issue_types, value]
        : prev.technical_issue_types.filter((v) => v !== value),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!interviewId) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId,
          overall_experience: form.overall_experience || null,
          ease_of_use: form.ease_of_use || null,
          comfort_level: form.comfort_level || null,
          technical_problems: form.technical_problems || null,
          technical_issue_types: form.technical_issue_types.length ? form.technical_issue_types : null,
          fair_chance: form.fair_chance || null,
          additional_comments: form.additional_comments?.trim() || null,
          contact_requested: form.contact_requested,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to submit feedback');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-black/12 bg-[var(--bg-color)] text-[var(--text-primary)]';
  const labelClass = 'block text-sm font-medium mb-1';
  const radioWrapClass = 'flex flex-wrap gap-3';

  return (
    <div className="virtual-interview-page flex flex-col min-h-screen">
      <header className="nav-container grid grid-cols-3 items-center">
        <div className="flex items-center gap-2">
          <Image src="/wvs_logo.png" alt="WV Supply Logo" width={128} height={36} className="shrink-0 w-[128px] h-[36px] object-contain" />
        </div>
        <h1 className="display-title text-center justify-self-center">Virtual Interview</h1>
        <div className="flex-1" />
      </header>

      <main className="flex-1 flex flex-col items-center px-5 py-8">
        <div className="info-card w-full max-w-md p-8 rounded-2xl shadow-md text-center mb-8" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>
          <h2 className="text-xl font-semibold mb-2">Thank you</h2>
          <p className="text-sm sub-text mb-4 leading-relaxed">
            Your interview has been submitted. Our team will review your responses and contact you about next steps.
          </p>
          <p className="text-sm sub-text mb-6 leading-relaxed">
            If you have questions in the meantime, please contact Human Resources at{' '}
            <a href="tel:+13043994568" className="font-medium underline" style={{ color: 'var(--accent-red)' }}>
              (304) 399-4568
            </a>
            .
          </p>
          <Link href="/" className="btn btn-primary inline-block">
            Return to home
          </Link>
        </div>

        {interviewId === null ? (
          <p className="text-sm sub-text max-w-md text-center">
            Feedback is not available for this session. You can still return home using the link above.
          </p>
        ) : submitted ? (
          <div className="info-card w-full max-w-md p-6 rounded-2xl shadow-md text-center" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)' }}>
            <p className="text-sm font-medium">Thank you for your feedback.</p>
          </div>
        ) : (
          <div className="w-full max-w-md">
            <p className="text-sm sub-text mb-2">Thank you for completing your interview. Estimated time: 30–60 seconds.</p>
            <p className="text-sm sub-text mb-2">
              Your feedback is optional. Providing feedback will not affect your chances of being selected for the position. It is completely voluntary, but we appreciate it because it helps us improve the interview process.
            </p>
            <p className="text-sm sub-text mb-4">
              In most cases, feedback submitted on this form is reviewed separately from interview responses. If you choose the option asking us to contact you about your feedback, a member of our HR team will review both your feedback and your interview activity so we can understand your experience and discuss it with you.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6" style={{ background: 'var(--card-bg)', color: 'var(--text-primary)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(0,0,0,0.08)' }}>
              {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

              <div>
                <p className={labelClass}>1) How was your experience with the interview system?</p>
                <div className={radioWrapClass}>
                  {RADIO_OVERALL.map((o) => (
                    <label key={o.value} className="inline-flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="overall" value={o.value} checked={form.overall_experience === o.value} onChange={() => setForm((f) => ({ ...f, overall_experience: o.value }))} className="rounded-full" />
                      <span className="text-sm">{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className={labelClass}>2) How easy was it to understand what to do during the interview?</p>
                <div className={radioWrapClass}>
                  {RADIO_EASE.map((o) => (
                    <label key={o.value} className="inline-flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="ease" value={o.value} checked={form.ease_of_use === o.value} onChange={() => setForm((f) => ({ ...f, ease_of_use: o.value }))} className="rounded-full" />
                      <span className="text-sm">{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className={labelClass}>3) How comfortable did you feel speaking with the interview system?</p>
                <div className={radioWrapClass}>
                  {RADIO_COMFORT.map((o) => (
                    <label key={o.value} className="inline-flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="comfort" value={o.value} checked={form.comfort_level === o.value} onChange={() => setForm((f) => ({ ...f, comfort_level: o.value }))} className="rounded-full" />
                      <span className="text-sm">{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className={labelClass}>4) Did you have any technical problems?</p>
                <div className={radioWrapClass}>
                  {RADIO_TECHNICAL.map((o) => (
                    <label key={o.value} className="inline-flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="technical" value={o.value} checked={form.technical_problems === o.value} onChange={() => setForm((f) => ({ ...f, technical_problems: o.value }))} className="rounded-full" />
                      <span className="text-sm">{o.label}</span>
                    </label>
                  ))}
                </div>
                {showTechnicalIssueTypes && (
                  <div className="mt-3 pl-2 border-l-2 border-black/12">
                    <p className="text-sm font-medium mb-2">What kind of issue occurred?</p>
                    <div className="flex flex-col gap-2">
                      {CHECKBOX_ISSUES.map((c) => (
                        <label key={c.value} className="inline-flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" value={c.value} checked={form.technical_issue_types.includes(c.value)} onChange={(e) => handleIssueChange(c.value, e.target.checked)} className="rounded" />
                          <span className="text-sm">{c.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className={labelClass}>5) Did the system give you a fair chance to explain your experience?</p>
                <div className={radioWrapClass}>
                  {RADIO_FAIR.map((o) => (
                    <label key={o.value} className="inline-flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="fair" value={o.value} checked={form.fair_chance === o.value} onChange={() => setForm((f) => ({ ...f, fair_chance: o.value }))} className="rounded-full" />
                      <span className="text-sm">{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="comments" className={labelClass}>6) Anything you would change or improve? (Optional)</label>
                <textarea id="comments" rows={3} value={form.additional_comments} onChange={(e) => setForm((f) => ({ ...f, additional_comments: e.target.value }))} className={inputClass} placeholder="Your comments..." />
              </div>

              <div>
                <p className={labelClass}>7) Would you like us to contact you about your feedback?</p>
                <div className="flex flex-col gap-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="contact" value="no" checked={!form.contact_requested} onChange={() => setForm((f) => ({ ...f, contact_requested: false }))} className="rounded-full" />
                    <span className="text-sm">No, feedback only</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="contact" value="yes" checked={form.contact_requested} onChange={() => setForm((f) => ({ ...f, contact_requested: true }))} className="rounded-full" />
                    <span className="text-sm">Yes, I would like someone from HR to follow up with me</span>
                  </label>
                </div>
              </div>

              <button type="submit" disabled={submitting} className="btn btn-primary w-full">
                {submitting ? 'Submitting…' : 'Submit feedback'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
