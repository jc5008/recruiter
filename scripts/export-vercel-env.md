# Export environment variables from old Vercel project (recruiter-dc)

Run these commands from the **recruiter-dc** app folder (this directory).

## 1. Install Vercel CLI (if needed)

```bash
npm install -g vercel
```

Or use `npx vercel` in place of `vercel` below.

## 2. Log in to Vercel (one-time)

```bash
vercel login
```

Follow the browser prompt to authenticate.

## 3. Link to the old project and pull env vars

```bash
vercel link --yes --project recruiter-dc --scope wv-supply
vercel env pull .env.vercel-export
```

This creates **`.env.vercel-export`** in this folder with all environment variables from [recruiter-dc](https://vercel.com/wv-supply/recruiter-dc/).

## 4. Add them to the new project

- Open your **new** Vercel project (e.g. **recruiter**).
- In **Settings → Environment Variables**, add each variable from `.env.vercel-export` (copy/paste or use **Bulk edit**).
- Or, after linking this folder to the new project (`vercel link --project recruiter --scope wv-supply`), you can push vars with:
  ```bash
  vercel env pull .env.local
  # Then for each var you can run: vercel env add NAME
  ```

## Optional: unlink after export

To point this folder back at your new repo/project:

```bash
vercel link --yes --project recruiter --scope wv-supply
```

**Note:** Add `.env.vercel-export` to `.gitignore` so you don’t commit secrets.
