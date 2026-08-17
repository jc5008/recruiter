import { expect, test } from '@playwright/test';
import { getSql } from '@/lib/db';
import { createSessionCookie } from '@/lib/auth';

const enabled = process.env.RUN_DB_INTEGRATION === '1' && Boolean(process.env.sql_DATABASE_URL);
const baseUrl = process.env.PLAYWRIGHT_BASE_URL
  || `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT || '3000'}`;

test.describe('authenticated Post-Interview QA', () => {
  test.skip(!enabled, 'Requires an isolated integration database');

  const superUserId = crypto.randomUUID();
  const demotedUserId = crypto.randomUUID();
  const suffix = crypto.randomUUID();
  const superEmail = `qa-browser-super-${suffix}@example.invalid`;
  const demotedEmail = `qa-browser-demoted-${suffix}@example.invalid`;
  let superCookie = '';
  let staleSuperCookie = '';

  test.beforeAll(async () => {
    const sql = getSql();
    await sql`
      INSERT INTO users (id, email, password_hash, first_name, last_name, role, status)
      VALUES
        (${superUserId}, ${superEmail}, 'not-used', 'Browser', 'Super', 'SUPER_ADMIN', 'ACTIVE'),
        (${demotedUserId}, ${demotedEmail}, 'not-used', 'Browser', 'Demoted', 'ADMIN', 'ACTIVE')
    `;
    superCookie = await createSessionCookie({
      userId: superUserId,
      email: superEmail,
      role: 'SUPER_ADMIN',
    });
    staleSuperCookie = await createSessionCookie({
      userId: demotedUserId,
      email: demotedEmail,
      role: 'SUPER_ADMIN',
    });
  });

  test.afterAll(async () => {
    const sql = getSql();
    await sql`DELETE FROM interviews WHERE registered_by IN (${superUserId}, ${demotedUserId})`;
    await sql`DELETE FROM audit_logs WHERE actor_user_id IN (${superUserId}, ${demotedUserId})`;
    await sql`DELETE FROM users WHERE id IN (${superUserId}, ${demotedUserId})`;
  });

  test('uses the current database role for visibility and access', async ({ browser }) => {
    const superContext = await browser.newContext();
    await superContext.addCookies([{ name: 'admin_session', value: superCookie, url: baseUrl }]);
    const superPage = await superContext.newPage();
    await superPage.goto('/admin');
    await expect(superPage.getByRole('link', { name: 'Post-Interview QA' })).toBeVisible();
    await superPage.goto('/admin/report-qa');
    await expect(superPage.getByRole('heading', { name: 'Post-Interview Report QA' })).toBeVisible();
    expect((await superPage.request.get('/api/admin/report-qa/runs')).status()).toBe(200);
    await superContext.close();

    const demotedContext = await browser.newContext();
    await demotedContext.addCookies([{ name: 'admin_session', value: staleSuperCookie, url: baseUrl }]);
    const demotedPage = await demotedContext.newPage();
    await demotedPage.goto('/admin');
    await expect(demotedPage.getByRole('link', { name: 'Post-Interview QA' })).toHaveCount(0);
    await demotedPage.goto('/admin/report-qa');
    await expect(demotedPage).toHaveURL(/\/admin$/);
    expect((await demotedPage.request.get('/api/admin/report-qa/runs')).status()).toBe(403);
    await demotedContext.close();
  });

  test('bypasses candidate flow, retains blank instructions on failure, and isolates the run', async ({ browser }) => {
    const context = await browser.newContext();
    await context.addCookies([{ name: 'admin_session', value: superCookie, url: baseUrl }]);
    const page = await context.newPage();
    const bypassRequests: string[] = [];
    page.on('request', (request) => {
      if (/liveavatar|\/api\/(start|token)|validate-code/i.test(request.url())) {
        bypassRequests.push(request.url());
      }
    });

    await page.goto('/admin/report-qa');
    const instruction = page.getByLabel('Instruction preface');
    await expect(instruction).not.toHaveValue('');
    await instruction.fill('');
    const createResponse = page.waitForResponse((response) =>
      response.url().endsWith('/api/admin/report-qa/runs') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Run QA report and send email' }).click();
    expect((await createResponse).status()).toBe(502);
    await expect(page.locator('p[role="alert"]')).toContainText('OPENAI_API_KEY is not set');
    await expect(instruction).toHaveValue('');
    expect(bypassRequests).toEqual([]);

    const email = await page.getByLabel('Email *').inputValue();
    const candidates = await page.request.get('/api/admin/candidates');
    const developer = await page.request.get('/api/admin/developer/interviews');
    expect(candidates.status()).toBe(200);
    expect(developer.status()).toBe(200);
    expect(JSON.stringify(await candidates.json())).not.toContain(email);
    expect(JSON.stringify(await developer.json())).not.toContain(email);

    const sql = getSql();
    const counts = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM admin_qa_report_runs q
          JOIN interviews i ON i.id = q.interview_id
          WHERE i.registered_by = ${superUserId}) AS runs,
        (SELECT COUNT(*)::int FROM interviews WHERE registered_by = ${superUserId}) AS interviews
    `;
    expect(counts[0]).toMatchObject({ runs: 1, interviews: 1 });
    await context.close();
  });
});
