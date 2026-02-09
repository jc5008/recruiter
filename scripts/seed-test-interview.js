/**
 * Seed test interviews so you can validate a code and reach /interview.
 * Run from project root: npm run seed  (or node -r dotenv/config scripts/seed-test-interview.js dotenv_config_path=.env.local)
 *
 * Creates (if missing): one user, one requisition, then interviews with access_code:
 *   TEST-2026, Demo001, Demo002, Demo003, Demo004, Demo005.
 */

require('dotenv').config({ path: process.env.dotenv_config_path || '.env.local' });
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

const sql = neon(process.env.sql_DATABASE_URL);
const SEED_EMAIL = 'seed@wvsupply.local';
const SEED_PASSWORD = 'changeme'; // change after first login

const INTERVIEW_CODES = [
  'TEST-2026',
  'Demo001',
  'Demo002',
  'Demo003',
  'Demo004',
  'Demo005',
];

async function ensureUserAndRequisition(userIdRef, reqIdRef) {
  let users = await sql`SELECT id, password_hash FROM users WHERE email = ${SEED_EMAIL} LIMIT 1`;
  if (users.length > 0) {
    userIdRef.current = users[0].id;
    console.log('Using existing seed user:', userIdRef.current);
    if (users[0].password_hash === 'seed-placeholder') {
      const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
      await sql`UPDATE users SET password_hash = ${passwordHash} WHERE email = ${SEED_EMAIL}`;
      console.log('Updated seed user password (login:', SEED_EMAIL, '/', SEED_PASSWORD, ')');
    }
  } else {
    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    const inserted = await sql`
      INSERT INTO users (email, password_hash, first_name, last_name, role, status)
      VALUES (${SEED_EMAIL}, ${passwordHash}, 'Seed', 'User', 'ADMIN', 'ACTIVE')
      RETURNING id
    `;
    userIdRef.current = inserted[0].id;
    console.log('Created seed user:', userIdRef.current, '(login:', SEED_EMAIL, '/', SEED_PASSWORD, ')');
  }

  let reqs = await sql`SELECT id FROM requisitions LIMIT 1`;
  if (reqs.length > 0) {
    reqIdRef.current = reqs[0].id;
    console.log('Using existing requisition:', reqIdRef.current);
  } else {
    const inserted = await sql`
      INSERT INTO requisitions (req_number, job_title, status, job_requirements, created_by)
      VALUES ('REQ-SEED-001', 'Test Role', 'ACTIVE', 'Test requirements for seed.', ${userIdRef.current})
      RETURNING id
    `;
    reqIdRef.current = inserted[0].id;
    console.log('Created requisition:', reqIdRef.current);
  }
}

async function main() {
  if (!process.env.sql_DATABASE_URL) {
    console.error('Missing sql_DATABASE_URL. Set it in .env.local or pass dotenv_config_path=.env.local');
    process.exit(1);
  }

  const userIdRef = { current: null };
  const reqIdRef = { current: null };
  await ensureUserAndRequisition(userIdRef, reqIdRef);
  const userId = userIdRef.current;
  const reqId = reqIdRef.current;

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 5);

  const created = [];
  for (const code of INTERVIEW_CODES) {
    const existing = await sql`SELECT id FROM interviews WHERE access_code = ${code} LIMIT 1`;
    if (existing.length > 0) {
      console.log('Interview already exists:', code);
      continue;
    }
    const email = `demo-${code.toLowerCase()}@example.com`;
    await sql`
      INSERT INTO interviews (
        candidate_first_name, candidate_last_name, candidate_email,
        requisition_id, access_code, deadline_at, status, registered_by
      )
      VALUES (
        'Demo', 'Candidate', ${email},
        ${reqId}, ${code}, ${deadline.toISOString()}, 'REGISTERED', ${userId}
      )
    `;
    created.push(code);
  }

  if (created.length > 0) {
    console.log('Created interview(s) with access code(s):', created.join(', '));
  }
  console.log('Available codes:', INTERVIEW_CODES.join(', '));
  console.log('Go to /, enter a code, then Continue.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
