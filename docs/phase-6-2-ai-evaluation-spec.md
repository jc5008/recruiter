# Phase 6.2 — AI Evaluation: Response Shape & Prompt Instructions

This document defines the exact **response shape** and **prompt instructions** for the OpenAI evaluation step (default model: GPT-5 mini). The model returns **one big Markdown blob**, stored in `interview_reports.ai_evaluation_json`.

---

## 1. Response shape

### API response from OpenAI

We ask the model to respond with **valid JSON only**, so we can parse it and store metadata alongside the report.

**Required shape:**

```json
{
  "report_markdown": "# Post-Interview Evaluation Report\n\n..."
}
```

- **`report_markdown`** (string, required): The full evaluation report as a single Markdown string. No other keys are required from the model.

### What we store in the database

**Table:** `interview_reports`  
**Column:** `ai_evaluation_json` (JSONB)

**Stored object:**

```json
{
  "report_markdown": "<full Markdown string from the model>",
  "model": "gpt-5-mini",
  "finished_at": "2026-02-19T12:00:00.000Z"
}
```

- **`report_markdown`**: Exactly what the model returned (one big Markdown blob).
- **`model`**: Model identifier used (e.g. `gpt-5-mini`). Set by our code after the call.
- **`finished_at`**: ISO 8601 timestamp when evaluation completed. Set by our code.

We may later add `token_usage_input`, `token_usage_output` here or keep them only on the table columns.

### Token usage

Store in `interview_reports` as already defined:

- `token_usage_input` (integer)
- `token_usage_output` (integer)

Populate from the OpenAI API response (`usage.prompt_tokens`, `usage.completion_tokens`).

---

## 2. Prompt instructions

### 2.1 System message (fixed)

Send this as the **system** message to the model (do **not** include the required-sections list here; that is handled by the instruction_preface):

```
Output rules:
- You must respond with valid JSON only, no other text before or after.
- The JSON must have exactly one key: "report_markdown".
- The value of "report_markdown" must be a single string containing the entire report in Markdown format.
- Use only Markdown: headings (# ## ###), bold (**text**), bullet lists (- item), numbered lists, and paragraphs. Do not use HTML or raw code blocks for the report content.
- In the report, display any dates or timestamps in Eastern Time. (Dates/timestamps are stored in UTC in our system; the report text shown to readers should use Eastern Time.)
```

Optional: if the app uses a **Standard Instruction Preface** from `system_settings` (instruction_preface), prepend it to the system message. The instruction_preface defines the report structure (required sections, tone, etc.). So the full system message = instruction_preface + the fixed block above.

### 2.2 User message (content)

The **user** message body is the **aggregated prompt** we already store: the full text from `interview_reports.aggregated_prompt_text` (or from `buildAggregatedPrompt(aggregateInterviewData(interviewId))`). It already contains:

- System Instructions (if any)
- Job Information (title, requirements, qualifications, skills)
- Candidate Information (name, email, resume)
- Interview metadata (started, ended, duration)
- Full transcript (Candidate / Interviewer lines)

Do not duplicate or alter that structure; use it as-is so the model sees one consistent "content package."

### 2.3 Response format instruction (in system or user)

Include this in the **system** message so the model's reply is valid JSON:

```
Your entire response must be a single JSON object of this form, with no markdown code fence or extra text:
{"report_markdown": "<entire report in Markdown as a single string>"}
Escape any double quotes inside the Markdown string (e.g. \" for "). Use newlines as \\n if you need to preserve line breaks in the string, or use real newlines within the string value; our parser will accept either.
```

So the model returns only that JSON object; we parse it, read `report_markdown`, and store it in `ai_evaluation_json.report_markdown`.

---

## 3. Required sections in the Markdown report

**Do not include this section list in the fixed system message.** The required sections and report structure are defined in the **instruction_preface** (Standard Instruction Preface in Admin → System settings). The model receives that via the system message (prepended before the fixed block).

For reference only (what the instruction_preface should cover), the report is expected to include sections such as:

### Candidate Header

Include:

- **Title** — One top-level heading, e.g. `# Post-Interview Evaluation Report`
- **Candidate Name**
- **Position Title**
- **Date of Screening** (display in Eastern Time)

If any field is missing, write: *Not provided.*

---

### Candidate Questions and Follow-Up Requirements

- List each question the candidate asked, quoted verbatim from the transcript.
- For each question:
  - Provide a concise summary of how I responded
  - Identify whether follow-up is required
  - If follow-up is required, clearly explain why
- If the candidate did not ask any questions, explicitly state: *The candidate did not ask any questions during the screening.*

Also include additional follow-up needs based on transcript evidence, including:

- Missing information
- Incomplete answers
- Identity inconsistencies
- Logistical uncertainty
- Transcript interruption
- Role misunderstanding

Only include follow-up items supported by evidence. Do not invent follow-up needs.

---

### Screening Evaluation Ratings

Assign exactly one rating in each category:

- **Overall Recommendation:** Advance / Do Not Advance
- **Qualification Alignment:** High / Moderate / Low
- **Role Alignment:** Strong / Moderate / Weak
- **Communication and Professionalism:** Strong / Moderate / Weak
- **Logistical Alignment:** Confirmed / Uncertain / Conflicting
- **Engagement and Cooperation:** High / Moderate / Low

Ratings must be based strictly on transcript evidence and evidence sufficiency. Use conservative ratings when evidence is limited.

---

### Overview of the Candidate

Length: 125–200 words

Provide a comprehensive narrative summary synthesizing:

- Overall suitability
- Work history context
- Observable strengths and limitations
- Screening engagement level
- Evidence sufficiency
- Screening reliability

Explicitly identify if screening evidence is insufficient for confident conclusions. This section must accurately reflect evaluation confidence level.

---

### Recent Work and Responsibilities

Length: 50–125 words

Explain:

- Candidate's recent roles
- Responsibilities described during screening
- Level of ownership

Clearly distinguish between transcript-confirmed responsibilities and unverified resume claims. If insufficient evidence exists, explicitly state this.

---

### Relevant Experience for the Role

Length: 50–125 words

Explain:

- Experience confirmed during screening
- Transferable experience, if applicable
- Evidence limitations

Do not treat resume claims as confirmed unless supported by transcript.

---

### Role Understanding and Expectation Alignment Certification

Length: 50–125 words

State whether candidate demonstrated:

- Clear understanding
- Partial understanding
- Unclear or unverified understanding

Support with transcript evidence.

---

### Risk Indicators and Areas Requiring Further Investigation

Length: 50–125 words

Explicitly identify:

- Transcript insufficiency
- Identity inconsistencies
- Resume-transcript gaps
- Limited engagement
- Missing logistical confirmation
- Missing qualification verification

Do not speculate. Only include evidence-supported risks.

---

### [Position-Specific Elements]

Insert here any position-specific elements to be evaluated, structured similarly to the preceding sections, each including specified length and other instruction parameters.

---

The report is one big Markdown blob; the instruction_preface specifies the exact structure and order the model should follow.

---

## 4. Implementation checklist

- [ ] Call OpenAI API (e.g. GPT-5 mini) with:
  - System message: optional instruction_preface + fixed system block (including JSON-only and `report_markdown` instructions).
  - User message: full aggregated prompt text.
- [ ] Parse response as JSON; read `report_markdown`.
- [ ] Build stored object: `{ report_markdown, model, finished_at }`.
- [ ] Save to `interview_reports.ai_evaluation_json` and set `token_usage_input` / `token_usage_output`.
- [ ] Retry on transient failures (e.g. 429, 5xx) with backoff.
- [ ] On failure, log and optionally leave `ai_evaluation_json` null and set a status or error field if you add one.

---

## 5. Example (minimal) `report_markdown` blob

```markdown
# Post-Interview Evaluation Report

## Candidate Header
- **Candidate Name:** Jane Doe
- **Position Title:** Senior Driver
- **Date of Screening:** February 19, 2026 (Eastern)

## Candidate Questions and Follow-Up Requirements
The candidate did not ask any questions during the screening.

## Screening Evaluation Ratings
- **Overall Recommendation:** Advance
- **Qualification Alignment:** High
- **Role Alignment:** Strong
- **Communication and Professionalism:** Strong
- **Logistical Alignment:** Confirmed
- **Engagement and Cooperation:** High

## Overview of the Candidate
[125–200 words...]

## Recent Work and Responsibilities
[50–125 words...]

## Relevant Experience for the Role
[50–125 words...]

## Role Understanding and Expectation Alignment Certification
[50–125 words...]

## Risk Indicators and Areas Requiring Further Investigation
[50–125 words...]
```

The string above would be the value of `report_markdown` in the JSON response and in `ai_evaluation_json.report_markdown`.
