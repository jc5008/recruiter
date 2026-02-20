-- Add LiveAvatar context to requisitions (for avatar persona per job).
-- Run once after 001_initial.sql (e.g. Neon SQL Editor).

ALTER TABLE requisitions
  ADD COLUMN IF NOT EXISTS liveavatar_context_id VARCHAR(255) NULL;

COMMENT ON COLUMN requisitions.liveavatar_context_id IS 'LiveAvatar context UUID for this requisition; used when starting avatar sessions for candidates.';
