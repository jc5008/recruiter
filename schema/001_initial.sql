-- Virtual Interviewer — Initial schema (from Project Description Feb 2026)
-- Run once on a fresh Neon database (e.g. Neon Console SQL Editor or psql).
-- Order matters: extensions first, then types, then tables (respecting FK order).

-- Enable UUID extension for secure IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------
-- 1. USER MANAGEMENT & AUTH
-- ----------------------------------------------------------
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'OBSERVER', 'AUDITOR');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'ADMIN',
    status user_status NOT NULL DEFAULT 'ACTIVE',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------
-- 2. JOB REQUISITIONS
-- ----------------------------------------------------------
CREATE TYPE req_status AS ENUM ('ACTIVE', 'CLOSED', 'ON_HOLD', 'INACTIVE');

CREATE TABLE requisitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    req_number VARCHAR(50) UNIQUE NOT NULL,
    job_title VARCHAR(150) NOT NULL,
    status req_status NOT NULL DEFAULT 'ACTIVE',
    job_requirements TEXT,
    qualifications TEXT,
    skills TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------
-- 3. INTERVIEWS & CANDIDATES
-- ----------------------------------------------------------
CREATE TYPE interview_status AS ENUM ('REGISTERED', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'FAILED');

CREATE TABLE interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_first_name VARCHAR(100) NOT NULL,
    candidate_last_name VARCHAR(100) NOT NULL,
    candidate_email VARCHAR(255) NOT NULL,
    resume_text TEXT,
    requisition_id UUID REFERENCES requisitions(id) ON DELETE RESTRICT,
    access_code VARCHAR(20) UNIQUE NOT NULL,
    deadline_at TIMESTAMPTZ NOT NULL,
    status interview_status NOT NULL DEFAULT 'REGISTERED',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    heygen_session_id VARCHAR(255),
    registered_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------
-- 4. TRANSCRIPT & OBSERVATION
-- ----------------------------------------------------------
CREATE TYPE speaker_type AS ENUM ('USER', 'AVATAR');

CREATE TABLE transcript_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
    speaker speaker_type NOT NULL,
    content TEXT NOT NULL,
    timestamp_offset_ms INTEGER,
    is_processed_for_tts BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE observation_audio (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transcript_segment_id UUID REFERENCES transcript_segments(id),
    audio_file_url TEXT,
    generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------
-- 5. ANALYSIS & REPORTS
-- ----------------------------------------------------------
CREATE TABLE interview_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_id UUID UNIQUE REFERENCES interviews(id) ON DELETE CASCADE,
    ai_evaluation_json JSONB,
    pdf_report_url TEXT,
    token_usage_input INTEGER,
    token_usage_output INTEGER,
    email_delivery_status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------
-- 6. AUDIT & SYSTEM CONFIG
-- ----------------------------------------------------------
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id UUID REFERENCES users(id),
    event_type VARCHAR(50) NOT NULL,
    resource_target VARCHAR(100),
    ip_address VARCHAR(45),
    outcome VARCHAR(20),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
