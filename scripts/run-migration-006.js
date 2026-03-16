/**
 * Run migration 006: Create candidate_feedback table.
 *
 * Usage: node -r dotenv/config scripts/run-migration-006.js dotenv_config_path=.env.local
 */
require('dotenv').config({ path: process.env.dotenv_config_path || '.env.local' });
const { neon } = require('@neondatabase/serverless');
const { readFileSync } = require('fs');
const { join } = require('path');

const connectionString = process.env.sql_DATABASE_URL;
if (!connectionString) {
  console.error('Missing sql_DATABASE_URL in .env.local');
  process.exit(1);
}

const sql = neon(connectionString);

async function run() {
  try {
    const migrationPath = join(__dirname, '../schema/006_candidate_feedback.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('Running migration 006: candidate_feedback table...');
    await sql.unsafe(migrationSQL);
    console.log('Migration 006 completed successfully');
  } catch (err) {
    console.error('Migration failed:', err.message || err);
    process.exit(1);
  }
}

run();
