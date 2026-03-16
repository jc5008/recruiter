/**
 * Send candidate feedback follow-up email to HR when candidate requests contact.
 * Requires RESEND_API_KEY and RESEND_FROM_EMAIL in env.
 */
import { Resend } from 'resend';

const FROM = process.env.RESEND_FROM_EMAIL || 'Virtual Interview <onboarding@resend.dev>';
const HR_TO = 'hr.automations@wvsupply.com';

const LABELS = {
  overall_experience: {
    very_good: 'Very good',
    good: 'Good',
    okay: 'Okay',
    difficult: 'Difficult',
    very_difficult: 'Very difficult',
  } as Record<string, string>,
  ease_of_use: {
    very_easy: 'Very easy',
    easy: 'Easy',
    somewhat_confusing: 'Somewhat confusing',
    very_confusing: 'Very confusing',
  } as Record<string, string>,
  comfort_level: {
    very_comfortable: 'Very comfortable',
    comfortable: 'Comfortable',
    neutral: 'Neutral',
    uncomfortable: 'Uncomfortable',
  } as Record<string, string>,
  technical_problems: {
    no_problems: 'No problems',
    minor_problems: 'Minor problems but finished',
    major_problems: 'Major problems',
  } as Record<string, string>,
  technical_issue_types: {
    audio_mic: 'Audio or microphone',
    video_camera: 'Video or camera',
    internet: 'Internet connection',
    instructions_unclear: 'Instructions were unclear',
    something_else: 'Something else',
  } as Record<string, string>,
  fair_chance: {
    yes: 'Yes',
    mostly: 'Mostly',
    not_really: 'Not really',
    no: 'No',
  } as Record<string, string>,
};

function label(map: Record<string, string>, code: string | null | undefined): string {
  if (!code) return '—';
  return map[code] ?? code;
}

function formatIssueTypes(types: string[] | string | null | undefined): string {
  if (!types || (Array.isArray(types) && types.length === 0)) return '—';
  const arr = Array.isArray(types) ? types : types.split(',').map((s) => s.trim()).filter(Boolean);
  return arr.map((c) => LABELS.technical_issue_types[c] ?? c).join(', ') || '—';
}

export type FeedbackFollowUpParams = {
  candidateName: string;
  jobTitle: string | null;
  interviewDate: string;
  candidateId: string;
  overallExperience: string | null;
  easeOfUse: string | null;
  comfortLevel: string | null;
  technicalProblems: string | null;
  technicalIssueTypes: string[] | string | null;
  fairChance: string | null;
  additionalComments: string | null;
};

export async function sendCandidateFeedbackFollowUpEmail(
  params: FeedbackFollowUpParams
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set');
    return { ok: false, error: 'RESEND_API_KEY is not set.' };
  }

  const {
    candidateName,
    jobTitle,
    interviewDate,
    candidateId,
    overallExperience,
    easeOfUse,
    comfortLevel,
    technicalProblems,
    technicalIssueTypes,
    fairChance,
    additionalComments,
  } = params;

  const overall = label(LABELS.overall_experience, overallExperience);
  const ease = label(LABELS.ease_of_use, easeOfUse);
  const comfort = label(LABELS.comfort_level, comfortLevel);
  const tech = label(LABELS.technical_problems, technicalProblems);
  const issueTypes = formatIssueTypes(technicalIssueTypes);
  const fair = label(LABELS.fair_chance, fairChance);

  const subject = `Candidate ${candidateName} Requested Follow-Up Regarding AI Interview Experience`;

  const body = `A candidate has indicated that they would like to be contacted by HR regarding their experience using the AI interview system.

Candidate Information
Name: ${candidateName}
Position Applied For: ${jobTitle ?? '—'}
Interview Date: ${interviewDate}
Candidate ID (if applicable): ${candidateId}

Summary of Candidate Feedback
Overall Experience: ${overall}
Ease of Use: ${ease}
Comfort Level: ${comfort}
Technical Problems Reported: ${tech}
Type of Technical Issue (if selected): ${issueTypes}

Additional Comments from Candidate
${additionalComments?.trim() || '(none)'}

Important Note
The candidate has specifically requested follow-up from HR regarding their feedback on the AI interview system. In accordance with the feedback form notice provided to candidates, HR should review both the candidate's feedback and their interview session in order to understand the experience and discuss it with the candidate.

Recommended Next Step
Please review the candidate's interview summary sent separately to HR. Obtain the phone number from the candidate's resume there. Contact the candidate to acknowledge their feedback and discuss their experience with the AI interview process.
`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM,
    to: [HR_TO],
    subject,
    text: body,
  });
  if (error) {
    console.error('Feedback follow-up email error:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
