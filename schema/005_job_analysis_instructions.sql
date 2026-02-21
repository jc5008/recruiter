-- Add Job Analysis Instructions to requisitions (job-specific prompt for AI evaluation).
-- Run once after 004 (e.g. Neon SQL Editor).

ALTER TABLE requisitions
  ADD COLUMN IF NOT EXISTS job_analysis_instructions TEXT NULL;

COMMENT ON COLUMN requisitions.job_analysis_instructions IS 'Job-specific prompt instructions appended to aggregated prompt after System Instructions, before Job Information.';
