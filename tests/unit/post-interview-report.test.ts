import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sqlMock, aggregateMock, evaluateMock, deliverMock } = vi.hoisted(() => ({
  sqlMock: vi.fn(async (...args: unknown[]): Promise<Array<Record<string, unknown>>> => {
    void args;
    return [];
  }),
  aggregateMock: vi.fn(),
  evaluateMock: vi.fn(),
  deliverMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ getSql: () => sqlMock }));
vi.mock('@/lib/aggregate-interview-data', () => ({
  aggregateInterviewData: aggregateMock,
  buildAggregatedPrompt: vi.fn(() => 'prompt'),
}));
vi.mock('@/lib/openai-evaluation', () => ({ runEvaluation: evaluateMock }));
vi.mock('@/lib/report-delivery', () => ({ sendReport: deliverMock }));

import { processPostInterviewReport } from '@/lib/post-interview-report';

describe('post-interview retry orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqlMock.mockImplementation(async (...args: unknown[]) =>
      (args[0] as TemplateStringsArray).join('').includes('SELECT id FROM admin_qa_report_runs')
        ? [{ id: 'qa-run-1' }]
        : []
    );
    evaluateMock.mockResolvedValue({
      ok: true,
      interview_id: 'interview-1',
      report_markdown: '# report',
      model: 'test-model',
      finished_at: '2026-08-17T00:00:00.000Z',
      token_usage_input: 10,
      token_usage_output: 20,
    });
    deliverMock.mockResolvedValue({ ok: true, interview_id: 'interview-1', message_id: 'message-1' });
  });

  it('retries delivery without recompiling or rerunning evaluation', async () => {
    const result = await processPostInterviewReport('interview-1', 'DELIVERING');
    expect(result.ok).toBe(true);
    expect(aggregateMock).not.toHaveBeenCalled();
    expect(evaluateMock).not.toHaveBeenCalled();
    expect(deliverMock).toHaveBeenCalledOnce();
    expect(deliverMock).toHaveBeenCalledWith('interview-1', {
      idempotencyKey: 'post-interview-qa/qa-run-1',
    });
  });

  it('retries evaluation without recreating input records, then delivers', async () => {
    const result = await processPostInterviewReport('interview-1', 'EVALUATING');
    expect(result.ok).toBe(true);
    expect(aggregateMock).not.toHaveBeenCalled();
    expect(evaluateMock).toHaveBeenCalledOnce();
    expect(deliverMock).toHaveBeenCalledOnce();
  });

  it('retains the precise failed stage and sanitized error', async () => {
    evaluateMock.mockResolvedValue({ ok: false, error: 'OpenAI failed sk_examplecredential123456' });
    const result = await processPostInterviewReport('interview-1', 'EVALUATING');
    expect(result).toMatchObject({ ok: false, stage: 'FAILED', failed_stage: 'EVALUATING' });
    expect(result.error).not.toContain('sk_examplecredential123456');
    expect(deliverMock).not.toHaveBeenCalled();
  });

  it('turns an unexpected evaluation exception into a structured downstream failure', async () => {
    evaluateMock.mockRejectedValue(new Error('provider setup failed'));
    const result = await processPostInterviewReport('interview-1', 'EVALUATING');
    expect(result).toMatchObject({
      ok: false,
      stage: 'FAILED',
      failed_stage: 'EVALUATING',
      error: 'provider setup failed',
    });
    expect(deliverMock).not.toHaveBeenCalled();
  });

  it('turns an unexpected delivery exception into a structured downstream failure', async () => {
    deliverMock.mockRejectedValue(new Error('renderer setup failed'));
    const result = await processPostInterviewReport('interview-1', 'DELIVERING');
    expect(result).toMatchObject({
      ok: false,
      stage: 'FAILED',
      failed_stage: 'DELIVERING',
      error: 'renderer setup failed',
    });
  });
});
