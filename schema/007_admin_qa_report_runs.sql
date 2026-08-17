-- SUPER_ADMIN Post-Interview Report QA harness.
-- Additive migration; run after 006_candidate_feedback.sql.

CREATE TABLE IF NOT EXISTS admin_qa_report_runs (
    id UUID PRIMARY KEY,
    interview_id UUID UNIQUE NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    scenario_name VARCHAR(200),
    input_schema_version INTEGER NOT NULL DEFAULT 1,
    input_json JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PERSISTED',
    failed_stage VARCHAR(20),
    error_message TEXT,
    processing_attempt_id UUID,
    attempt_count INTEGER NOT NULL DEFAULT 1,
    delivery_message_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    CONSTRAINT admin_qa_report_runs_status_check CHECK (
      status IN ('PERSISTED', 'AGGREGATING', 'EVALUATING', 'DELIVERING', 'COMPLETED', 'FAILED')
    ),
    CONSTRAINT admin_qa_report_runs_failed_stage_check CHECK (
      failed_stage IS NULL OR failed_stage IN ('AGGREGATING', 'EVALUATING', 'DELIVERING')
    ),
    CONSTRAINT admin_qa_report_runs_input_schema_check CHECK (input_schema_version >= 1)
);

CREATE INDEX IF NOT EXISTS admin_qa_report_runs_created_at_idx
  ON admin_qa_report_runs (created_at DESC);

ALTER TABLE admin_qa_report_runs
  ADD COLUMN IF NOT EXISTS processing_attempt_id UUID,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS delivery_message_id VARCHAR(255);

ALTER TABLE interview_reports
  ADD COLUMN IF NOT EXISTS instruction_preface_snapshot TEXT NULL;

COMMENT ON TABLE admin_qa_report_runs IS
  'SUPER_ADMIN-only simulated Post-Interview Report inputs and execution state.';

COMMENT ON COLUMN admin_qa_report_runs.input_json IS
  'Immutable, versioned snapshot of all raw ingredients supplied to the Post-Interview Report pipeline.';

COMMENT ON COLUMN interview_reports.instruction_preface_snapshot IS
  'Exact instruction preface used for this evaluation; prevents settings changes from altering a compiled run.';
