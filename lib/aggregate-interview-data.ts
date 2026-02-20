/**
 * Phase 6.1: Data Aggregation Utility
 * 
 * Aggregates all required data for AI evaluation:
 * - Candidate identity, job title, requisition ID
 * - Timestamps, duration
 * - Resume (plain text)
 * - Full transcript
 * - System instructions (from system_settings)
 * - Job requirements (from requisition)
 */

import { getSql } from './db';

export type AggregatedInterviewData = {
  interview: {
    id: string;
    candidate_first_name: string;
    candidate_last_name: string;
    candidate_email: string;
    resume_text: string | null;
    requisition_id: string | null;
    started_at: Date | null;
    ended_at: Date | null;
    duration_seconds: number | null;
  };
  requisition: {
    job_title: string | null;
    job_requirements: string | null;
    qualifications: string | null;
    skills: string | null;
  } | null;
  transcript: Array<{
    speaker: 'USER' | 'AVATAR';
    content: string;
    timestamp_offset_ms: number | null;
    created_at: Date;
  }>;
  system_instruction_preface: string;
};

/**
 * Aggregates all data needed for AI evaluation from an interview ID.
 */
export async function aggregateInterviewData(interviewId: string): Promise<AggregatedInterviewData> {
  const sql = getSql();

  // Fetch interview with requisition join
  const interviewRows = await sql`
    SELECT 
      i.id,
      i.candidate_first_name,
      i.candidate_last_name,
      i.candidate_email,
      i.resume_text,
      i.requisition_id,
      i.started_at,
      i.ended_at,
      i.duration_seconds,
      r.job_title,
      r.job_requirements,
      r.qualifications,
      r.skills
    FROM interviews i
    LEFT JOIN requisitions r ON r.id = i.requisition_id
    WHERE i.id = ${interviewId}
    LIMIT 1
  `;

  if (!interviewRows.length) {
    throw new Error(`Interview ${interviewId} not found`);
  }

  const row = interviewRows[0] as {
    id: string;
    candidate_first_name: string;
    candidate_last_name: string;
    candidate_email: string;
    resume_text: string | null;
    requisition_id: string | null;
    started_at: Date | null;
    ended_at: Date | null;
    duration_seconds: number | null;
    job_title: string | null;
    job_requirements: string | null;
    qualifications: string | null;
    skills: string | null;
  };

  // Fetch transcript segments
  const transcriptRows = await sql`
    SELECT speaker, content, timestamp_offset_ms, created_at
    FROM transcript_segments
    WHERE interview_id = ${interviewId}
    ORDER BY created_at ASC, timestamp_offset_ms ASC NULLS LAST
  `;

  const transcript = transcriptRows.map((t) => ({
    speaker: t.speaker as 'USER' | 'AVATAR',
    content: t.content as string,
    timestamp_offset_ms: t.timestamp_offset_ms as number | null,
    created_at: t.created_at as Date,
  }));

  // Fetch system instruction preface (default to empty if not set)
  const instructionRows = await sql`
    SELECT value FROM system_settings WHERE key = 'instruction_preface' LIMIT 1
  `;
  const system_instruction_preface = (instructionRows[0] as { value: string } | undefined)?.value ?? '';

  return {
    interview: {
      id: row.id,
      candidate_first_name: row.candidate_first_name,
      candidate_last_name: row.candidate_last_name,
      candidate_email: row.candidate_email,
      resume_text: row.resume_text,
      requisition_id: row.requisition_id,
      started_at: row.started_at,
      ended_at: row.ended_at,
      duration_seconds: row.duration_seconds,
    },
    requisition: row.requisition_id
      ? {
          job_title: row.job_title,
          job_requirements: row.job_requirements,
          qualifications: row.qualifications,
          skills: row.skills,
        }
      : null,
    transcript,
    system_instruction_preface,
  };
}

/**
 * Builds the aggregated prompt text from aggregated data.
 * This is the exact prompt that will be sent to the AI model.
 */
export function buildAggregatedPrompt(data: AggregatedInterviewData): string {
  const parts: string[] = [];

  // System instruction preface
  if (data.system_instruction_preface.trim()) {
    parts.push(`## System Instructions\n\n${data.system_instruction_preface.trim()}\n`);
  }

  // Job information
  if (data.requisition) {
    parts.push(`## Job Information\n`);
    if (data.requisition.job_title) {
      parts.push(`**Job Title:** ${data.requisition.job_title}\n`);
    }
    if (data.requisition.job_requirements) {
      parts.push(`**Job Requirements:**\n${data.requisition.job_requirements}\n`);
    }
    if (data.requisition.qualifications) {
      parts.push(`**Qualifications:**\n${data.requisition.qualifications}\n`);
    }
    if (data.requisition.skills) {
      parts.push(`**Skills:**\n${data.requisition.skills}\n`);
    }
    parts.push('');
  }

  // Candidate information
  parts.push(`## Candidate Information\n`);
  parts.push(`**Name:** ${data.interview.candidate_first_name} ${data.interview.candidate_last_name}\n`);
  parts.push(`**Email:** ${data.interview.candidate_email}\n`);
  if (data.interview.resume_text) {
    parts.push(`**Resume:**\n${data.interview.resume_text}\n`);
  }
  parts.push('');

  // Interview metadata
  if (data.interview.started_at) {
    parts.push(`**Interview Started:** ${data.interview.started_at.toISOString()}\n`);
  }
  if (data.interview.ended_at) {
    parts.push(`**Interview Ended:** ${data.interview.ended_at.toISOString()}\n`);
  }
  if (data.interview.duration_seconds !== null) {
    const minutes = Math.floor(data.interview.duration_seconds / 60);
    const seconds = data.interview.duration_seconds % 60;
    parts.push(`**Duration:** ${minutes}m ${seconds}s\n`);
  }
  parts.push('');

  // Transcript
  parts.push(`## Interview Transcript\n\n`);
  if (data.transcript.length === 0) {
    parts.push('(No transcript available)\n');
  } else {
    for (const segment of data.transcript) {
      const speakerLabel = segment.speaker === 'USER' ? 'Candidate' : 'Interviewer';
      const timeStr =
        segment.timestamp_offset_ms !== null
          ? `[${Math.floor(segment.timestamp_offset_ms / 1000)}s] `
          : '';
      parts.push(`${speakerLabel} ${timeStr}: ${segment.content}\n`);
    }
  }

  return parts.join('\n');
}
