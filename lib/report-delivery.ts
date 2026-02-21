/**
 * Phase 6.3: Report delivery via Resend
 *
 * Builds a single PDF with: AI Evaluation (as formatted) | Candidate Resume | Transcript.
 * Sends the PDF as an email attachment; updates email_delivery_status.
 */

import { Resend } from 'resend';
import { marked } from 'marked';
import { getSql } from './db';

const REPORT_DELIVERY_EMAIL_KEY = 'report_delivery_email';

export type DeliverResult =
  | { ok: true; interview_id: string; message_id?: string }
  | { ok: false; error: string };

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function getReportDeliveryEmail(): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    SELECT value FROM system_settings WHERE key = ${REPORT_DELIVERY_EMAIL_KEY} LIMIT 1
  `;
  return (rows[0] as { value: string } | undefined)?.value?.trim() ?? '';
}

/**
 * Builds full HTML for the report PDF: AI Evaluation + Candidate Resume + Transcript.
 */
async function buildReportHtml(
  reportMarkdown: string,
  resumeText: string | null,
  transcript: Array<{ speaker: string; content: string; timestamp_offset_ms: number | null }>
): Promise<string> {
  let aiSectionHtml: string;
  try {
    const result = marked(reportMarkdown);
    aiSectionHtml = typeof result === 'string' ? result : await result;
  } catch {
    aiSectionHtml = reportMarkdown.replace(/\n/g, '<br>\n');
  }

  const resumeSectionHtml = resumeText?.trim()
    ? `<section class="section">
  <h1 class="section-title">Candidate Resume</h1>
  <div class="resume-block"><pre class="resume-pre">${escapeHtml(resumeText.trim())}</pre></div>
</section>`
    : '<section class="section"><h1 class="section-title">Candidate Resume</h1><p class="muted">No resume provided.</p></section>';

  const transcriptEntries = transcript
    .map(
      (seg) =>
        `<div class="transcript-segment">
  <span class="transcript-speaker">${escapeHtml(seg.speaker === 'USER' ? 'Candidate' : 'Interviewer')}</span>
  ${seg.timestamp_offset_ms != null ? `<span class="transcript-time">${(seg.timestamp_offset_ms / 1000).toFixed(1)}s</span>` : ''}
  <div class="transcript-content">${escapeHtml(seg.content)}</div>
</div>`
    )
    .join('\n');

  const transcriptSectionHtml = `<section class="section">
  <h1 class="section-title">Transcript</h1>
  <div class="transcript-list">${transcriptEntries || '<p class="muted">No transcript.</p>'}</div>
</section>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Post-Interview Report</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #1a1a1a; margin: 0; padding: 24px; font-size: 11pt; }
    .section { margin-bottom: 28px; page-break-inside: avoid; }
    .section-title { font-size: 14pt; margin: 0 0 12px 0; padding-bottom: 6px; border-bottom: 1px solid #ccc; }
    #ai-eval h1 { font-size: 14pt; }
    #ai-eval h2 { font-size: 12pt; }
    #ai-eval h3 { font-size: 11pt; }
    #ai-eval p, #ai-eval ul, #ai-eval ol { margin: 0 0 8px 0; }
    .resume-block { background: #f8f8f8; padding: 12px; border-radius: 4px; overflow-x: auto; }
    .resume-pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; font-size: 10pt; }
    .transcript-list { display: flex; flex-direction: column; gap: 10px; }
    .transcript-segment { padding: 8px 12px; background: #f5f5f5; border-left: 3px solid #666; }
    .transcript-speaker { font-weight: 600; margin-right: 8px; }
    .transcript-time { font-size: 9pt; color: #666; margin-right: 8px; }
    .transcript-content { margin-top: 4px; }
    .muted { color: #666; font-style: italic; }
  </style>
</head>
<body>
  <section id="ai-eval" class="section">
    <h1 class="section-title">AI Evaluation</h1>
    <div class="ai-content">${aiSectionHtml}</div>
  </section>
  ${resumeSectionHtml}
  ${transcriptSectionHtml}
</body>
</html>`;
}

/**
 * Renders HTML to a PDF buffer using Puppeteer.
 * On Vercel uses puppeteer-core + @sparticuz/chromium; locally uses full puppeteer.
 */
async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  const isVercel = process.env.VERCEL === '1';
  let browser: Awaited<ReturnType<Awaited<ReturnType<typeof import('puppeteer')>>['launch']>>;

  if (isVercel) {
    const puppeteer = await import('puppeteer-core');
    const chromium = await import('@sparticuz/chromium');
    // On Vercel the bundled function has no node_modules/@sparticuz/chromium/bin; use remote pack URL.
    const remotePath = process.env.CHROMIUM_REMOTE_EXEC_PATH;
    const executablePath = remotePath
      ? await chromium.default.executablePath(remotePath)
      : await chromium.default.executablePath();
    browser = await puppeteer.default.launch({
      args: chromium.default.args,
      defaultViewport: chromium.default.defaultViewport,
      executablePath,
      headless: chromium.default.headless ?? true,
    });
  } else {
    const puppeteer = await import('puppeteer');
    browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Sends the post-interview report as a PDF attachment to the configured report delivery email via Resend.
 * PDF content order: AI Evaluation (current format) | Candidate Resume | Transcript.
 * Requires: RESEND_API_KEY, RESEND_FROM_EMAIL (or RESEND_FROM); report_delivery_email in system_settings.
 */
export async function sendReport(interviewId: string): Promise<DeliverResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? process.env.RESEND_FROM;

  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY is not set' };
  }
  if (!fromAddress?.trim()) {
    return { ok: false, error: 'RESEND_FROM_EMAIL (or RESEND_FROM) is not set' };
  }

  const toEmail = await getReportDeliveryEmail();
  if (!toEmail) {
    return { ok: false, error: 'Report delivery email is not configured. Set it in Admin → Settings.' };
  }

  const sql = getSql();

  const reportRows = await sql`
    SELECT r.ai_evaluation_json,
           i.candidate_first_name, i.candidate_last_name, i.resume_text,
           req.job_title
    FROM interview_reports r
    JOIN interviews i ON i.id = r.interview_id
    LEFT JOIN requisitions req ON req.id = i.requisition_id
    WHERE r.interview_id = ${interviewId}
    LIMIT 1
  `;

  if (!reportRows.length) {
    return { ok: false, error: 'Interview report not found. Run evaluation (6.2) first.' };
  }

  const row = reportRows[0] as {
    ai_evaluation_json: { report_markdown?: string } | null;
    candidate_first_name: string;
    candidate_last_name: string;
    resume_text: string | null;
    job_title: string | null;
  };

  const reportMarkdown =
    row.ai_evaluation_json && typeof row.ai_evaluation_json.report_markdown === 'string'
      ? row.ai_evaluation_json.report_markdown
      : null;

  if (!reportMarkdown?.trim()) {
    return { ok: false, error: 'No report content. Run evaluation (6.2) first.' };
  }

  const transcriptRows = await sql`
    SELECT speaker, content, timestamp_offset_ms
    FROM transcript_segments
    WHERE interview_id = ${interviewId}
    ORDER BY created_at ASC, timestamp_offset_ms ASC NULLS LAST
  `;

  const transcript = transcriptRows.map((t) => ({
    speaker: t.speaker as string,
    content: t.content as string,
    timestamp_offset_ms: t.timestamp_offset_ms as number | null,
  }));

  const html = await buildReportHtml(reportMarkdown, row.resume_text ?? null, transcript);

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await htmlToPdfBuffer(html);
  } catch (err) {
    console.error('PDF generation error:', err);
    await sql`
      UPDATE interview_reports
      SET email_delivery_status = 'FAILED'
      WHERE interview_id = ${interviewId}
    `;
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to generate PDF',
    };
  }

  const candidateName = `${row.candidate_first_name} ${row.candidate_last_name}`.trim() || 'Candidate';
  const jobTitle = row.job_title?.trim() || 'Position';
  const subject = `Post-Interview Report: ${candidateName} – ${jobTitle}`;

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress.trim(),
      to: [toEmail],
      subject,
      html: '<p>Please find the post-interview report attached (PDF: AI Evaluation, Candidate Resume, Transcript).</p>',
      attachments: [
        {
          filename: `post-interview-report-${interviewId.slice(0, 8)}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error('Resend send error:', error);
      await sql`
        UPDATE interview_reports
        SET email_delivery_status = 'FAILED'
        WHERE interview_id = ${interviewId}
      `;
      return { ok: false, error: error.message || 'Resend send failed' };
    }

    await sql`
      UPDATE interview_reports
      SET email_delivery_status = 'SENT'
      WHERE interview_id = ${interviewId}
    `;

    return {
      ok: true,
      interview_id: interviewId,
      message_id: data?.id,
    };
  } catch (err) {
    console.error('Report delivery error:', err);
    await sql`
      UPDATE interview_reports
      SET email_delivery_status = 'FAILED'
      WHERE interview_id = ${interviewId}
    `;
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to send report',
    };
  }
}
