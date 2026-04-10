import { unwrapN8nEntity } from '@/lib/n8n-entity'

type Role = 'admin' | 'agent' | 'customer'

export type TicketAuthRow = {
  id: string
  assigned_to?: string | null
  customer_email?: string | null
}

export function parseTicketAuthRow(envelope: unknown): TicketAuthRow | null {
  const row = unwrapN8nEntity(envelope) as Record<string, unknown> | null
  if (!row?.id || typeof row.id !== 'string') return null
  return {
    id: row.id,
    assigned_to: typeof row.assigned_to === 'string' ? row.assigned_to : null,
    customer_email: typeof row.customer_email === 'string' ? row.customer_email : null,
  }
}

export function canStaffEditTicket(
  role: Role,
  userId: string,
  ticket: TicketAuthRow
): boolean {
  if (role === 'admin') return true
  if (role === 'agent') return (ticket.assigned_to || '') === userId
  return false
}

export function canAccessTicket(
  role: Role,
  userId: string,
  userEmail: string,
  ticket: TicketAuthRow
): boolean {
  if (role === 'admin') return true
  if (role === 'agent') return (ticket.assigned_to || '') === userId
  return (ticket.customer_email || '').toLowerCase() === userEmail.toLowerCase()
}

export function canPostCommentOnTicket(
  role: Role,
  userId: string,
  userEmail: string,
  ticket: TicketAuthRow
): boolean {
  return canAccessTicket(role, userId, userEmail, ticket)
}
