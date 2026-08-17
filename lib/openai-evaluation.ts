/**
 * Phase 6.2: OpenAI AI Evaluation
 *
 * Runs GPT screening evaluation: loads aggregated prompt and instruction preface,
 * calls OpenAI, parses JSON response (report_markdown), stores in interview_reports.
 * See docs/phase-6-2-ai-evaluation-spec.md.
 */

import OpenAI from 'openai';
import { getSql } from './db';
import { aggregateInterviewData, buildAggregatedPrompt } from './aggregate-interview-data';

const INSTRUCTION_PREFACE_KEY = 'instruction_preface';

const FIXED_SYSTEM_BLOCK = `Output rules:
- You must respond with valid JSON only, no other text before or after.
- The JSON must have exactly one key: "report_markdown".
- The value of "report_markdown" must be a single string containing the entire report in Markdown format.
- Use only Markdown: headings (# ## ###), bold (**text**), bullet lists (- item), numbered lists, and paragraphs. Do not use HTML or raw code blocks for the report content.
- In the report, display any dates or timestamps in Eastern Time. (Dates/timestamps are stored in UTC in our system; the report text shown to readers should use Eastern Time.)

Your entire response must be a single JSON object of this form, with no markdown code fence or extra text:
{"report_markdown": "<entire report in Markdown as a single string>"}
Escape any double quotes inside the Markdown string (e.g. \\" for "). Use newlines as \\n if you need to preserve line breaks in the string, or use real newlines within the string value; our parser will accept either.`;

export type EvaluationResult = {
  ok: true;
  interview_id: string;
  report_markdown: string;
  model: string;
  finished_at: string;
  token_usage_input: number;
  token_usage_output: number;
};

export type EvaluationError = {
  ok: false;
  error: string;
};

async function getInstructionPreface(): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    SELECT value FROM system_settings WHERE key = ${INSTRUCTION_PREFACE_KEY} LIMIT 1
  `;
  return (rows[0] as { value: string } | undefined)?.value ?? '';
}

/**
 * Returns the aggregated prompt for an interview: from interview_reports.aggregated_prompt_text if present,
 * otherwise builds via aggregateInterviewData + buildAggregatedPrompt.
 */
async function getAggregatedPromptForInterview(interviewId: string): Promise<{ prompt: string; instructionPreface: string }> {
  const sql = getSql();
  const rows = await sql`
    SELECT aggregated_prompt_text, instruction_preface_snapshot
    FROM interview_reports
    WHERE interview_id = ${interviewId}
    LIMIT 1
  `;
  const row = rows[0] as {
    aggregated_prompt_text: string | null;
    instruction_preface_snapshot: string | null;
  } | undefined;
  const text = row?.aggregated_prompt_text;
  if (text != null && text.trim() !== '') {
    return {
      prompt: text,
      instructionPreface: row?.instruction_preface_snapshot ?? await getInstructionPreface(),
    };
  }
  const data = await aggregateInterviewData(interviewId);
  return { prompt: buildAggregatedPrompt(data), instructionPreface: data.system_instruction_preface };
}

function buildSystemMessage(instructionPreface: string): string {
  const preface = instructionPreface.trim();
  if (preface) {
    return `${preface}\n\n${FIXED_SYSTEM_BLOCK}`;
  }
  return FIXED_SYSTEM_BLOCK;
}

/**
 * Runs AI evaluation for an interview: loads aggregated prompt and instruction preface,
 * calls OpenAI (model from OPENAI_SCREENING_MODEL or gpt-5-mini), parses JSON, stores result.
 */
export async function runEvaluation(interviewId: string): Promise<EvaluationResult | EvaluationError> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'OPENAI_API_KEY is not set' };
  }

  const model = process.env.OPENAI_SCREENING_MODEL?.trim() || 'gpt-5-mini';

  const sql = getSql();

  // Verify interview exists
  const interviewRows = await sql`
    SELECT id FROM interviews WHERE id = ${interviewId} LIMIT 1
  `;
  if (!interviewRows.length) {
    return { ok: false, error: 'Interview not found' };
  }

  let aggregatedPrompt: string;
  let instructionPreface: string;
  try {
    const input = await getAggregatedPromptForInterview(interviewId);
    aggregatedPrompt = input.prompt;
    instructionPreface = input.instructionPreface;
  } catch (err) {
    console.error('getAggregatedPromptForInterview error:', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to load aggregated prompt',
    };
  }

  const systemMessage = buildSystemMessage(instructionPreface);

  const openai = new OpenAI({ apiKey });

  let reportMarkdown: string;
  let usageInput = 0;
  let usageOutput = 0;
  const finishedAt = new Date().toISOString();

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: aggregatedPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (content == null || content.trim() === '') {
      return { ok: false, error: 'OpenAI returned empty content' };
    }

    const parsed = JSON.parse(content) as { report_markdown?: unknown };
    const raw = parsed.report_markdown;
    if (typeof raw !== 'string') {
      return { ok: false, error: 'OpenAI response missing or invalid report_markdown' };
    }
    reportMarkdown = raw;

    if (completion.usage) {
      usageInput = completion.usage.prompt_tokens ?? 0;
      usageOutput = completion.usage.completion_tokens ?? 0;
    }
  } catch (err) {
    if (err instanceof OpenAI.APIError) {
      const msg = err.message || 'OpenAI API error';
      const status = err.status;
      console.error('OpenAI API error:', status, msg);
      return { ok: false, error: `OpenAI API error (${status}): ${msg}` };
    }
    if (err instanceof SyntaxError) {
      console.error('OpenAI response JSON parse error:', err);
      return { ok: false, error: 'Invalid JSON in OpenAI response' };
    }
    console.error('runEvaluation error:', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Evaluation failed',
    };
  }

  const aiEvaluationJson = {
    report_markdown: reportMarkdown,
    model,
    finished_at: finishedAt,
  };

  try {
    await sql`
      INSERT INTO interview_reports (
        interview_id,
        aggregated_prompt_text,
        instruction_preface_snapshot,
        ai_evaluation_json,
        token_usage_input,
        token_usage_output,
        email_delivery_status
      )
      VALUES (
        ${interviewId},
        ${aggregatedPrompt},
        ${instructionPreface},
        ${JSON.stringify(aiEvaluationJson)},
        ${usageInput},
        ${usageOutput},
        'PENDING'
      )
      ON CONFLICT (interview_id) DO UPDATE SET
        instruction_preface_snapshot = COALESCE(interview_reports.instruction_preface_snapshot, ${instructionPreface}),
        ai_evaluation_json = ${JSON.stringify(aiEvaluationJson)},
        token_usage_input = ${usageInput},
        token_usage_output = ${usageOutput}
    `;
    // Note: ON CONFLICT update does not overwrite aggregated_prompt_text (preserves 6.1 data)
  } catch (dbErr) {
    console.error('Failed to save evaluation to interview_reports:', dbErr);
    return {
      ok: false,
      error: dbErr instanceof Error ? dbErr.message : 'Failed to save evaluation',
    };
  }

  return {
    ok: true,
    interview_id: interviewId,
    report_markdown: reportMarkdown,
    model,
    finished_at: finishedAt,
    token_usage_input: usageInput,
    token_usage_output: usageOutput,
  };
}
