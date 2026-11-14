/**
 * Panel de administración. Todo pasa por funciones seguras de la base de datos (0004_roles_security.sql),
 * que comprueban el rol en el servidor: ocultar el panel en la app es solo comodidad, no la protección.
 */
import { AuthError, type Role, type User } from './auth'
import { supabase } from './supabase'

export interface AdminUser {
  id: string; email: string; display_name: string | null; role: Role; plan_tier: User['plan_tier']
  created_at: string; last_sign_in_at: string | null; email_confirmed: boolean; saved_plans: number; shared_plans: number
}
export interface AuditEntry { id: number; actor_id: string | null; action: 'set_plan' | 'set_role' | 'principal_admin' | string; target_id: string | null; detail: { from?: string; to?: string }; created_at: string }

const fail = (e: { message?: string; code?: string } | null) => {
  const m = `${e?.code ?? ''} ${e?.message ?? ''}`
  if (/FORBIDDEN|CANNOT_CHANGE|42501/.test(m)) return new AuthError('forbidden')
  if (/fetch|network/i.test(m)) return new AuthError('network')
  return new AuthError('unknown')
}

export async function listUsers(): Promise<AdminUser[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('admin_list_users')
  if (error) throw fail(error)
  return (data ?? []) as AdminUser[]
}

export async function setPlan(id: string, tier: User['plan_tier']) {
  if (!supabase) return
  const { error } = await supabase.rpc('admin_set_plan', { target_user: id, new_tier: tier })
  if (error) throw fail(error)
}

export async function setRole(id: string, role: Exclude<Role, 'owner'>) {
  if (!supabase) return
  const { error } = await supabase.rpc('admin_set_role', { target_user: id, new_role: role })
  if (error) throw /EMAIL_NOT_CONFIRMED/.test(error.message) ? new AuthError('email_not_confirmed') : fail(error)
}

export async function listAudit(limit = 30): Promise<AuditEntry[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('admin_audit').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) throw fail(error)
  return (data ?? []) as AuditEntry[]
}
