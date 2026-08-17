import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sqlMock, processMock } = vi.hoisted(() => ({
  sqlMock: vi.fn(async (...args: unknown[]): Promise<Array<Record<string, unknown>>> => {
    const sqlText = (args[0] as TemplateStringsArray).join('');
    if (sqlText.includes('SELECT id, started_at, ended_at, status')) {
      return [{
        id: 'candidate-interview',
        started_at: new Date(Date.now() - 60_000),
        ended_at: null,
        status: 'ACTIVE',
      }];
    }
    return [];
  }),
  processMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ getSql: () => sqlMock }));
vi.mock('@/lib/post-interview-report', () => ({
  processPostInterviewReport: processMock,
}));

import { POST } from '@/app/api/interviews/[id]/complete/route';

describe('candidate completion report regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps candidate completion successful after an unexpected downstream exception', async () => {
    processMock.mockRejectedValue(new Error('provider initialization failed'));
    const response = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'candidate-interview' }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      status: 'COMPLETED',
      has_aggregated_prompt: false,
    });
  });

  it('continues to report an explicit aggregation failure', async () => {
    processMock.mockResolvedValue({
      ok: false,
      interview_id: 'candidate-interview',
      stage: 'FAILED',
      failed_stage: 'AGGREGATING',
      error: 'missing report ingredients',
    });
    const response = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'candidate-interview' }),
    });
    expect(response.status).toBe(500);
  });
});
