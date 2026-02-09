# Database Schema (Neon)

Schema for the Virtual Interviewer app, aligned with the Project Description (Feb 2026).

**Neon project name:** You can name the project **recruiter-db** (or any name) in the Neon Console; the app only uses the connection string in `sql_DATABASE_URL`.

## Setup checklist

Before using interview codes or the database, confirm:

1. **Run the schema once** (see options below).  
2. **Set `sql_DATABASE_URL`** in `.env.local` to your Neon connection string.

---

## Running the schema

**Option A — Neon Console (recommended)**  
1. In [Neon Console](https://console.neon.tech), open your project and go to **SQL Editor**.  
2. Paste the contents of `001_initial.sql`.  
3. Run the script.  
4. Copy the connection string and add it as `sql_DATABASE_URL` in `.env.local`.

**Option B — Neon CLI**  
If you use [Neon CLI](https://neon.tech/docs/reference/neon-cli):

```bash
neon sql "$(cat schema/001_initial.sql)"
```

**Option C — psql**  
If you have `psql` and a connection string:

```bash
psql "$sql_DATABASE_URL" -f schema/001_initial.sql
```

## Important

- Run **once** on a **new** database. The script creates types and tables; it is not idempotent (e.g. `CREATE TYPE` will fail if the type already exists).  
- For future changes, add new migration files (e.g. `002_add_foo.sql`) and run them in order.  
- The app uses `lib/db.ts` (Neon serverless driver) for all queries; set `sql_DATABASE_URL` in `.env.local` for API routes and Server Actions that need the DB.
