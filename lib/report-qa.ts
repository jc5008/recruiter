export const QA_INPUT_SCHEMA_VERSION = 1 as const;

export type QaTranscriptSegment = {
  speaker: 'USER' | 'AVATAR';
  content: string;
  timestamp_offset_ms: number | null;
};

export type QaReportInput = {
  system_instruction_preface: string;
  candidate: {
    first_name: string;
    last_name: string;
    email: string;
    resume_text: string;
  };
  job: {
    title: string;
    requirements: string;
    qualifications: string;
    skills: string;
    job_analysis_instructions: string;
  };
  interview: {
    started_at: string | null;
    ended_at: string | null;
    duration_seconds: number | null;
  };
  transcript: QaTranscriptSegment[];
};

export type QaReportPayload = {
  run_id?: string;
  scenario_name: string;
  input: QaReportInput;
};

export type QaRunStage =
  | 'PERSISTED'
  | 'AGGREGATING'
  | 'EVALUATING'
  | 'DELIVERING'
  | 'COMPLETED'
  | 'FAILED';

export type QaFailedStage = 'AGGREGATING' | 'EVALUATING' | 'DELIVERING';

type ValidationSuccess = { ok: true; value: QaReportPayload };
type ValidationFailure = { ok: false; error: string };

const MAX_LONG_TEXT = 200_000;
const MAX_TRANSCRIPT_SEGMENTS = 1_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function stringValue(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' || value.length > maxLength) return null;
  return value;
}

function optionalIsoDate(value: unknown): string | null | undefined {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function validateQaReportPayload(value: unknown): ValidationSuccess | ValidationFailure {
  if (!value || typeof value !== 'object') return { ok: false, error: 'Invalid request body' };
  const raw = value as Record<string, unknown>;
  const input = raw.input;
  if (!input || typeof input !== 'object') return { ok: false, error: 'Missing QA input' };

  const source = input as Record<string, unknown>;
  const candidate = source.candidate as Record<string, unknown> | undefined;
  const job = source.job as Record<string, unknown> | undefined;
  const interview = source.interview as Record<string, unknown> | undefined;
  if (!candidate || !job || !interview) return { ok: false, error: 'Candidate, job, and interview sections are required' };

  const firstName = stringValue(candidate.first_name, 100)?.trim();
  const lastName = stringValue(candidate.last_name, 100)?.trim();
  const email = stringValue(candidate.email, 255)?.trim().toLowerCase();
  const resume = stringValue(candidate.resume_text, MAX_LONG_TEXT);
  const title = stringValue(job.title, 150)?.trim();
  const requirements = stringValue(job.requirements, MAX_LONG_TEXT);
  const qualifications = stringValue(job.qualifications, MAX_LONG_TEXT);
  const skills = stringValue(job.skills, MAX_LONG_TEXT);
  const jobInstructions = stringValue(job.job_analysis_instructions, MAX_LONG_TEXT);
  const systemInstructions = stringValue(source.system_instruction_preface, MAX_LONG_TEXT);

  if (!firstName || !lastName) return { ok: false, error: 'Candidate first and last name are required' };
  if (!email || !EMAIL_PATTERN.test(email)) return { ok: false, error: 'A valid candidate email is required' };
  if (!title) return { ok: false, error: 'Job title is required' };
  if ([resume, requirements, qualifications, skills, jobInstructions, systemInstructions].some((entry) => entry === null)) {
    return { ok: false, error: 'One or more text fields exceed the allowed size or are invalid' };
  }

  const startedAt = optionalIsoDate(interview.started_at);
  const endedAt = optionalIsoDate(interview.ended_at);
  if (startedAt === undefined || endedAt === undefined) return { ok: false, error: 'Interview timestamps must be valid dates' };
  if (startedAt && endedAt && new Date(endedAt).getTime() < new Date(startedAt).getTime()) {
    return { ok: false, error: 'Interview end must be after interview start' };
  }

  const rawDuration = interview.duration_seconds;
  const duration = rawDuration === null || rawDuration === '' ? null : Number(rawDuration);
  if (duration !== null && (!Number.isInteger(duration) || duration < 0 || duration > 86400)) {
    return { ok: false, error: 'Duration must be a whole number between 0 and 86400 seconds' };
  }

  if (!Array.isArray(source.transcript) || source.transcript.length > MAX_TRANSCRIPT_SEGMENTS) {
    return { ok: false, error: `Transcript must contain at most ${MAX_TRANSCRIPT_SEGMENTS} segments` };
  }

  const transcript: QaTranscriptSegment[] = [];
  for (let index = 0; index < source.transcript.length; index++) {
    const segment = source.transcript[index] as Record<string, unknown>;
    if (!segment || (segment.speaker !== 'USER' && segment.speaker !== 'AVATAR')) {
      return { ok: false, error: `Transcript segment ${index + 1} has an invalid speaker` };
    }
    const content = stringValue(segment.content, 20_000);
    if (content === null || !content.trim()) {
      return { ok: false, error: `Transcript segment ${index + 1} must contain text` };
    }
    const rawTimestamp = segment.timestamp_offset_ms;
    const timestamp = rawTimestamp === null || rawTimestamp === '' ? null : Number(rawTimestamp);
    if (timestamp !== null && (!Number.isInteger(timestamp) || timestamp < 0 || timestamp > 86_400_000)) {
      return { ok: false, error: `Transcript segment ${index + 1} has an invalid timestamp` };
    }
    transcript.push({ speaker: segment.speaker, content, timestamp_offset_ms: timestamp });
  }

  const scenarioNameValue = stringValue(raw.scenario_name ?? '', 200);
  if (scenarioNameValue === null) return { ok: false, error: 'Scenario name is too long' };
  const scenarioName = scenarioNameValue.trim();
  const runId = raw.run_id == null ? undefined : String(raw.run_id);
  if (runId && !UUID_PATTERN.test(runId)) return { ok: false, error: 'Invalid run ID' };

  return {
    ok: true,
    value: {
      run_id: runId,
      scenario_name: scenarioName,
      input: {
        system_instruction_preface: systemInstructions!,
        candidate: { first_name: firstName, last_name: lastName, email: email!, resume_text: resume! },
        job: {
          title,
          requirements: requirements!,
          qualifications: qualifications!,
          skills: skills!,
          job_analysis_instructions: jobInstructions!,
        },
        interview: { started_at: startedAt, ended_at: endedAt, duration_seconds: duration },
        transcript,
      },
    },
  };
}

export function sanitizeQaError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error');
  return message
    .replace(/(?:postgres(?:ql)?:\/\/)[^\s]+/gi, '[database connection redacted]')
    .replace(/(?:sk|re)_[A-Za-z0-9_-]{12,}/g, '[credential redacted]')
    .slice(0, 1_000);
}
