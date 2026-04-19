import { supabase } from './supabaseClient'

export type AdminUserSearchRow = {
  id: string
  email: string
  display_name: string | null
}

/** Solo permitido por RLS + RPC para el UUID de soporte. */
export async function adminSearchUsers(query: string): Promise<AdminUserSearchRow[]> {
  const { data, error } = await supabase.rpc('admin_search_users', { p_query: query })
  if (error) throw error
  const rows = (data ?? []) as { id: string; email: string; display_name: string | null }[]
  return rows.map((r) => ({
    id: String(r.id),
    email: String(r.email),
    display_name: r.display_name != null ? String(r.display_name) : null,
  }))
}
