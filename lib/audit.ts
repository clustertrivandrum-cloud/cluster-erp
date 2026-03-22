import { createAdminClient } from '@/lib/supabase-admin'

type AuditPayload = {
    actorId?: string | null
    action: string
    entityType: string
    entityId: string
    before?: any
    after?: any
}

export async function logAudit(payload: AuditPayload) {
    try {
        const supabase = createAdminClient()
        await supabase.from('audit_logs').insert({
            actor_id: payload.actorId ?? null,
            action: payload.action,
            entity_type: payload.entityType,
            entity_id: payload.entityId,
            before: payload.before ?? null,
            after: payload.after ?? null,
        })
    } catch (e) {
        console.error('Audit log failed', e)
    }
}
