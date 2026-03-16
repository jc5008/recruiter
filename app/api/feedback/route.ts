import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { sendCandidateFeedbackFollowUpEmail } from '@/lib/feedback-email';

const VALID_OVERALL = ['very_good', 'good', 'okay', 'difficult', 'very_difficult'];
const VALID_EASE = ['very_easy', 'easy', 'somewhat_confusing', 'very_confusing'];
const VALID_COMFORT = ['very_comfortable', 'comfortable', 'neutral', 'uncomfortable'];
const VALID_TECHNICAL = ['no_problems', 'minor_problems', 'major_problems'];
const VALID_FAIR = ['yes', 'mostly', 'not_really', 'no'];
const VALID_ISSUE_TYPES = ['audio_mic', 'video_camera', 'internet', 'instructions_unclear', 'something_else'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const interviewId = typeof body.interviewId === 'string' ? body.interviewId.trim() : null;
    if (!interviewId) {
      return NextResponse.json({ error: 'Interview id is required' }, { status: 400 });
    }

    const sql = getSql();
    const interviewRows = await sql`
      SELECT i.id, i.candidate_first_name, i.candidate_last_name, i.started_at, r.job_title
      FROM interviews i
      LEFT JOIN requisitions r ON r.id = i.requisition_id
      WHERE i.id = ${interviewId}
      LIMIT 1
    `;
    if (!interviewRows.length) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    const interview = interviewRows[0] as {
      id: string;
      candidate_first_name: string;
      candidate_last_name: string;
      started_at: string | null;
      job_title: string | null;
    };

    const overall_experience = VALID_OVERALL.includes(body.overall_experience) ? body.overall_experience : null;
    const ease_of_use = VALID_EASE.includes(body.ease_of_use) ? body.ease_of_use : null;
    const comfort_level = VALID_COMFORT.includes(body.comfort_level) ? body.comfort_level : null;
    const technical_problems = VALID_TECHNICAL.includes(body.technical_problems) ? body.technical_problems : null;
    const fair_chance = VALID_FAIR.includes(body.fair_chance) ? body.fair_chance : null;
    const contact_requested = Boolean(body.contact_requested);

    let technical_issue_types: string | null = null;
    if (body.technical_issue_types) {
      const arr = Array.isArray(body.technical_issue_types)
        ? body.technical_issue_types
        : [body.technical_issue_types];
      const valid = arr.filter((v: string) => VALID_ISSUE_TYPES.includes(String(v).trim()));
      if (valid.length) technical_issue_types = valid.join(',');
    }

    const additional_comments =
      typeof body.additional_comments === 'string' ? body.additional_comments.trim().slice(0, 10000) : null;

    await sql`
      INSERT INTO candidate_feedback (
        interview_id, overall_experience, ease_of_use, comfort_level,
        technical_problems, technical_issue_types, fair_chance, additional_comments, contact_requested
      )
      VALUES (
        ${interviewId}, ${overall_experience}, ${ease_of_use}, ${comfort_level},
        ${technical_problems}, ${technical_issue_types}, ${fair_chance}, ${additional_comments}, ${contact_requested}
      )
      ON CONFLICT (interview_id) DO UPDATE SET
        overall_experience = EXCLUDED.overall_experience,
        ease_of_use = EXCLUDED.ease_of_use,
        comfort_level = EXCLUDED.comfort_level,
        technical_problems = EXCLUDED.technical_problems,
        technical_issue_types = EXCLUDED.technical_issue_types,
        fair_chance = EXCLUDED.fair_chance,
        additional_comments = EXCLUDED.additional_comments,
        contact_requested = EXCLUDED.contact_requested
    `;

    if (contact_requested) {
      const candidateName = [interview.candidate_first_name, interview.candidate_last_name].filter(Boolean).join(' ') || 'Candidate';
      const interviewDate = interview.started_at
        ? new Date(interview.started_at).toLocaleDateString(undefined, { dateStyle: 'long' })
        : new Date().toLocaleDateString(undefined, { dateStyle: 'long' });
      sendCandidateFeedbackFollowUpEmail({
        candidateName,
        jobTitle: interview.job_title ?? null,
        interviewDate,
        candidateId: interview.id,
        overallExperience: overall_experience,
        easeOfUse: ease_of_use,
        comfortLevel: comfort_level,
        technicalProblems: technical_problems,
        technicalIssueTypes: technical_issue_types,
        fairChance: fair_chance,
        additionalComments: additional_comments,
      }).then((r) => {
        if (!r.ok) console.error('Feedback follow-up email failed:', r.error);
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Feedback submit error:', e);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}
