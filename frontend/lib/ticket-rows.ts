/** Normalized ticket row from n8n /api/tickets (WF10 may return empty `{}` rows). */

export type TicketRow = {
  id: string
  ticket_number?: number | string
  customer_name?: string | null
  customer_email?: string | null
  subject?: string | null
  status?: string
  priority?: string
  category?: string | null
  created_at?: string
  updated_at?: string
  assigned_to?: string | null
  sla_due_at?: string | null
  sla_breached?: boolean
}

function coerceTicketId(o: Record<string, unknown>): string {
  const raw =
    o.id ??
    o.ticket_id ??
    o.support_ticket_id ??
    (typeof o.data === 'object' && o.data != null
      ? (o.data as Record<string, unknown>).id
      : undefined)
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw)
  return ''
}

/** Normalize n8n ticket-api envelope: `{ data: [...], total }`, nested `{ data: { data: [...] } }`, or one row. */
export function ticketsFromN8nData(data: unknown): TicketRow[] {
  if (data == null || typeof data !== 'object') return []
  const o = data as Record<string, unknown>
  let inner: unknown = o.data !== undefined ? o.data : o

  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    const mid = inner as Record<string, unknown>
    if (Array.isArray(mid.data)) inner = mid.data
  }

  if (Array.isArray(inner)) return normalizeTicketRows(inner)
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    return normalizeTicketRows([inner])
  }
  return []
}

export function normalizeTicketRows(raw: unknown): TicketRow[] {
  if (!Array.isArray(raw)) return []
  const out: TicketRow[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const id = coerceTicketId(o)
    if (!id) continue
    const tn = o.ticket_number
    let ticket_number: number | string | undefined
    if (typeof tn === 'number' && Number.isFinite(tn)) ticket_number = tn
    else if (typeof tn === 'string' && tn.trim()) ticket_number = Number(tn) || tn

    const str = (k: string): string | undefined =>
      typeof o[k] === 'string' ? (o[k] as string) : undefined
    const nullableStr = (k: string): string | null => {
      const v = o[k]
      if (v === null || v === undefined) return null
      return typeof v === 'string' ? v : null
    }
    const bool = (k: string): boolean | undefined =>
      typeof o[k] === 'boolean' ? o[k] : undefined

    out.push({
      id,
      ticket_number,
      customer_name: nullableStr('customer_name'),
      customer_email: nullableStr('customer_email'),
      subject: str('subject'),
      status: str('status'),
      priority: str('priority'),
      category: nullableStr('category'),
      created_at: str('created_at'),
      updated_at: str('updated_at'),
      assigned_to: nullableStr('assigned_to'),
      sla_due_at: nullableStr('sla_due_at'),
      sla_breached: bool('sla_breached'),
    })
  }
  return out
}

export function displayTicketId(t: TicketRow): string {
  if (t.ticket_number != null && String(t.ticket_number).length > 0) {
    return `#${t.ticket_number}`
  }
  if (typeof t.id === 'string' && t.id.length > 0) {
    return t.id.slice(0, 8)
  }
  return '-'
}
