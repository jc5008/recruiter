-- Candidate feedback: optional post-interview survey linked to interview_id.
-- Run once after 001_initial.sql and other migrations (e.g. Neon SQL Editor).

CREATE TABLE candidate_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID NOT NULL UNIQUE REFERENCES interviews(id) ON DELETE CASCADE,
    overall_experience VARCHAR(30) NULL,
    ease_of_use VARCHAR(30) NULL,
    comfort_level VARCHAR(30) NULL,
    technical_problems VARCHAR(30) NULL,
    technical_issue_types VARCHAR(255) NULL,
    fair_chance VARCHAR(20) NULL,
    additional_comments TEXT NULL,
    contact_requested BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE candidate_feedback IS 'Optional candidate feedback form submitted on thank-you page; one row per interview.';
