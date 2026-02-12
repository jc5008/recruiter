import { getSql } from '@/lib/db';

type AuditParams = {
  actorUserId: string;
  eventType: string;
  resourceTarget?: string;
  ipAddress?: string | null;
  outcome?: string;
  details?: Record<string, unknown>;
};

export async function writeAuditLog(params: AuditParams): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO audit_logs (actor_user_id, event_type, resource_target, ip_address, outcome, details)
    VALUES (
      ${params.actorUserId},
      ${params.eventType},
      ${params.resourceTarget ?? null},
      ${params.ipAddress ?? null},
      ${params.outcome ?? null},
      ${params.details ? JSON.stringify(params.details) : null}
    )
  `;
}
