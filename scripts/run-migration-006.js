/**
 * Run migration 006: Create candidate_feedback table.
 * Uses pg client so DDL persists (Neon serverless driver does not persist DDL).
 *
 * Usage: node scripts/run-migration-006.js
 *    or: node -r dotenv/config scripts/run-migration-006.js dotenv_config_path=.env.local
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: process.env.dotenv_config_path || path.join(__dirname, '..', '.env.local') });
const { Client } = require('pg');

const connectionString = process.env.sql_DATABASE_URL;
if (!connectionString) {
  console.error('Missing sql_DATABASE_URL in .env.local');
  process.exit(1);
}

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const exists = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'candidate_feedback'"
    );
    if (exists.rows.length > 0) {
      console.log('Migration 006 already applied (candidate_feedback exists).');
      return;
    }
    const migrationPath = path.join(__dirname, '..', 'schema', '006_candidate_feedback.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    console.log('Running migration 006: candidate_feedback table...');
    await client.query(migrationSQL);
    console.log('Migration 006 completed successfully.');
    const check = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'candidate_feedback'"
    );
    if (check.rows.length === 0) {
      console.error('Verification failed: candidate_feedback table not found after migration.');
      process.exit(1);
    }
    console.log('Verified: candidate_feedback table exists.');
  } catch (err) {
    console.error('Migration failed:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
