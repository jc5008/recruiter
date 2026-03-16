/**
 * Verify candidate_feedback table exists.
 * Usage: node -r dotenv/config scripts/verify-feedback-table.js dotenv_config_path=.env.local
 */
const path = require('path');
require('dotenv').config({ path: process.env.dotenv_config_path || path.join(__dirname, '..', '.env.local') });
const { neon } = require('@neondatabase/serverless');

const connectionString = process.env.sql_DATABASE_URL;
if (!connectionString) {
  console.error('Missing sql_DATABASE_URL');
  process.exit(1);
}

const sql = neon(connectionString);

async function verify() {
  try {
    const rows = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'candidate_feedback'
      ORDER BY ordinal_position
    `;
    if (rows.length === 0) {
      console.error('Verification failed: candidate_feedback table not found');
      process.exit(1);
    }
    console.log('Verified: candidate_feedback exists with', rows.length, 'columns');
    process.exit(0);
  } catch (err) {
    console.error('Verification error:', err.message || err);
    process.exit(1);
  }
}

verify();
