# Installing Puppeteer on Vercel

Phase 6.3 generates a PDF report (AI Evaluation + Resume + Transcript) and emails it via Resend. On **Vercel**, the full `puppeteer` package and its bundled Chromium are too large for serverless (250MB limit). Use **puppeteer-core** (no browser) plus **@sparticuz/chromium** (serverless Chromium binary) instead.

## 1. Install the serverless packages

In your project root:

```bash
npm install puppeteer-core @sparticuz/chromium
```

- **puppeteer-core**: Same API as Puppeteer but does not download Chromium (stays under Vercel’s size limits).
- **@sparticuz/chromium**: Chromium build for serverless (Lambda/Vercel). First run may decompress to `/tmp`; warm invocations reuse it.

Version alignment: use a Chromium version that matches your Puppeteer major. For Puppeteer 24, use **@sparticuz/chromium@143** (or the latest 14x listed on [Puppeteer Chromium Support](https://pptr.dev/chromium-support)). Example:

```bash
npm install puppeteer-core@24 @sparticuz/chromium@143
```

## 2. Code: use Chromium only on Vercel

The app already detects Vercel and launches the right browser:

- **Local**: `puppeteer` (full package) and its bundled Chrome.
- **Vercel**: `puppeteer-core` + `@sparticuz/chromium` (executable path and args from `@sparticuz/chromium`).

No extra config in your code is required if you followed the setup in this repo.

## 3. Vercel project settings

- **Function timeout**: PDF generation can take 10–30+ seconds. On **Hobby** the limit is 10s; on **Pro** you get 60s (or more). Increase the timeout for the route that runs report delivery (e.g. in Vercel Dashboard → Project → Settings → Functions, or `vercel.json`).
- **Memory**: Allocate at least **1024 MB** (recommended 1500 MB+) for the function that runs Puppeteer. Set in Vercel Dashboard → Project → Settings → Functions → Memory.
- **Environment**: Ensure `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (or `RESEND_FROM`), and `sql_DATABASE_URL` are set in the Vercel project. Report recipient is configured in Admin → Settings (`report_delivery_email`).

## 4. Optional: `vercel.json` for timeout and memory

Example (adjust path if your deliver API lives elsewhere):

```json
{
  "functions": {
    "app/api/interviews/[id]/deliver/route.ts": {
      "maxDuration": 60,
      "memory": 1024
    },
    "app/api/admin/developer/deliver/route.ts": {
      "maxDuration": 60,
      "memory": 1024
    }
  }
}
```

## 5. Deploy and test

1. Commit and push (or deploy via Vercel CLI).
2. In production, open Admin → Developer, select a candidate with an existing evaluation, and click **Deliver report (email)**.
3. If the function times out, increase `maxDuration` and/or `memory`. If you see “Could not find Chrome”, confirm `@sparticuz/chromium` is a **production** dependency (not only dev) so it’s included in the serverless bundle.

## 6. Troubleshooting

| Issue | What to do |
|--------|------------|
| Timeout | Raise function `maxDuration` (Pro plan) and/or `memory`. |
| “Could not find Chrome” | Use `puppeteer-core` + `@sparticuz/chromium` in production; ensure `@sparticuz/chromium` is not only in `devDependencies`. |
| Bundle too large | You’re already using the minimal path (puppeteer-core + @sparticuz/chromium on Vercel). If needed, try `@sparticuz/chromium-min` and host the Chromium pack externally (see [Sparticuz chromium-min](https://github.com/Sparticuz/chromium#-min-package)). |
| Cold start slow | First request after idle can take 15–30s while Chromium is extracted; subsequent requests are faster. |

## References

- [Deploying Puppeteer with Next.js on Vercel](https://examples.vercel.com/guides/deploying-puppeteer-with-nextjs-on-vercel)
- [@sparticuz/chromium](https://www.npmjs.com/package/@sparticuz/chromium) on npm
- [Puppeteer Chromium Support](https://pptr.dev/chromium-support) for version pairing
