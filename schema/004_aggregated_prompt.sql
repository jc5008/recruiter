-- Add aggregated_prompt_text column to interview_reports (for Phase 6.1 debugging and long-term analysis).
-- Run once after 001_initial.sql (e.g. Neon SQL Editor).

ALTER TABLE interview_reports
  ADD COLUMN IF NOT EXISTS aggregated_prompt_text TEXT NULL;

COMMENT ON COLUMN interview_reports.aggregated_prompt_text IS 'Full aggregated prompt (system instructions + job requirements + transcript + resume) sent to AI for evaluation. Stored for development debugging and long-term analysis.';
