/**
 * Run schema/003_requisition_context.sql on Neon.
 * Uses sql_DATABASE_URL from .env.local.
 *
 * From project root (recruiter-dc):
 *   node -r dotenv/config scripts/run-migration-003.js dotenv_config_path=.env.local
 * Or: npm run migration:003  (if added to package.json)
 */
require('dotenv').config({ path: process.env.dotenv_config_path || '.env.local' });
const { neon } = require('@neondatabase/serverless');

const connectionString = process.env.sql_DATABASE_URL;
if (!connectionString) {
  console.error('Missing sql_DATABASE_URL in .env.local');
  process.exit(1);
}

const sql = neon(connectionString);

async function run() {
  try {
    await sql`ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS liveavatar_context_id VARCHAR(255) NULL`;
    console.log('Added column requisitions.liveavatar_context_id (if not exists).');
    console.log('Migration 003 done.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

run();
