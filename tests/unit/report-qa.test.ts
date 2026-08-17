import { describe, expect, it } from 'vitest';
import { buildAggregatedPrompt, type AggregatedInterviewData } from '@/lib/aggregate-interview-data';
import { sanitizeQaError, validateQaReportPayload } from '@/lib/report-qa';

function validPayload() {
  return {
    run_id: '97feee9d-ea95-4dea-90d1-b4024876d002',
    scenario_name: ' Complete ingredients ',
    input: {
      system_instruction_preface: 'Use the QA rubric.',
      candidate: {
        first_name: ' Jane ',
        last_name: ' Candidate ',
        email: 'JANE@EXAMPLE.COM',
        resume_text: 'Resume evidence',
      },
      job: {
        title: ' Warehouse Lead ',
        requirements: 'Requirement A',
        qualifications: 'Qualification B',
        skills: 'Skill C',
        job_analysis_instructions: 'Inspect leadership evidence.',
      },
      interview: {
        started_at: '2026-08-16T20:00:00-04:00',
        ended_at: '2026-08-16T20:15:00-04:00',
        duration_seconds: 900,
      },
      transcript: [
        { speaker: 'AVATAR', content: 'Tell me about your work.', timestamp_offset_ms: 0 },
        { speaker: 'USER', content: 'I led a team.', timestamp_offset_ms: 5000 },
      ],
    },
  };
}

describe('validateQaReportPayload', () => {
  it('normalizes every input section while preserving raw ingredients', () => {
    const result = validateQaReportPayload(validPayload());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.scenario_name).toBe('Complete ingredients');
    expect(result.value.input.candidate).toMatchObject({
      first_name: 'Jane',
      last_name: 'Candidate',
      email: 'jane@example.com',
    });
    expect(result.value.input.job.title).toBe('Warehouse Lead');
    expect(result.value.input.interview.duration_seconds).toBe(900);
    expect(result.value.input.transcript).toHaveLength(2);
  });

  it('permits intentionally blank optional fields and an empty transcript', () => {
    const payload = validPayload();
    payload.input.system_instruction_preface = '';
    payload.input.candidate.resume_text = '';
    payload.input.job.requirements = '';
    payload.input.transcript = [];
    expect(validateQaReportPayload(payload).ok).toBe(true);
  });

  it('rejects inconsistent timestamps and invalid transcript values', () => {
    const payload = validPayload();
    payload.input.interview.ended_at = '2026-08-16T19:00:00-04:00';
    expect(validateQaReportPayload(payload)).toMatchObject({ ok: false, error: 'Interview end must be after interview start' });

    const invalidSegment = validPayload();
    invalidSegment.input.transcript[0].timestamp_offset_ms = -1;
    expect(validateQaReportPayload(invalidSegment)).toMatchObject({ ok: false });
  });

  it('redacts connection strings and credential-shaped values from failures', () => {
    const sanitized = sanitizeQaError(new Error('postgresql://user:password@example/db sk_examplecredential123456'));
    expect(sanitized).not.toContain('password');
    expect(sanitized).not.toContain('sk_examplecredential123456');
  });
});

describe('buildAggregatedPrompt', () => {
  it('includes every agent-visible QA ingredient', () => {
    const data: AggregatedInterviewData = {
      interview: {
        id: 'qa-interview',
        candidate_first_name: 'Jane',
        candidate_last_name: 'Candidate',
        candidate_email: 'jane@example.com',
        resume_text: 'Resume evidence',
        requisition_id: null,
        started_at: new Date('2026-08-17T00:00:00Z'),
        ended_at: new Date('2026-08-17T00:15:00Z'),
        duration_seconds: 900,
      },
      requisition: {
        job_title: 'Warehouse Lead',
        job_requirements: 'Requirement A',
        qualifications: 'Qualification B',
        skills: 'Skill C',
        job_analysis_instructions: 'Inspect leadership evidence.',
      },
      transcript: [
        { speaker: 'AVATAR', content: 'Tell me about your work.', timestamp_offset_ms: 0, created_at: new Date() },
        { speaker: 'USER', content: 'I led a team.', timestamp_offset_ms: 5000, created_at: new Date() },
      ],
      system_instruction_preface: 'Use the QA rubric.',
    };
    const prompt = buildAggregatedPrompt(data);
    for (const expected of [
      'Use the QA rubric.', 'Inspect leadership evidence.', 'Warehouse Lead', 'Requirement A',
      'Qualification B', 'Skill C', 'Jane Candidate', 'jane@example.com', 'Resume evidence',
      '2026-08-17T00:00:00.000Z', '15m 0s', 'Tell me about your work.', 'I led a team.',
    ]) expect(prompt).toContain(expected);
  });
});
