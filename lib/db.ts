/**
 * Neon serverless SQL client for Virtual Interviewer.
 * Use in API routes and Server Actions only (server-side).
 *
 * Requires sql_DATABASE_URL in environment (Neon connection string).
 */
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.sql_DATABASE_URL;

function getSql() {
  if (!connectionString) {
    throw new Error(
      'sql_DATABASE_URL is not set. Add it to .env.local for database access.'
    );
  }
  return neon(connectionString);
}

/**
 * Server-side SQL client. Safe for parameterized queries via template literals.
 * @example
 *   const sql = getSql();
 *   const rows = await sql`SELECT * FROM interviews WHERE access_code = ${code}`;
 */
export { getSql };
