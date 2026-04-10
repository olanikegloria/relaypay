/** Aligned with `support_tickets` / `ticket_comments` checks in Supabase schema. */

export const TICKET_STATUSES = [
  'open',
  'assigned',
  'in_progress',
  'pending_customer',
  'resolved',
  'closed',
] as const

export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const

export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

export const TICKET_CATEGORIES = [
  'payment_issue',
  'account_access',
  'compliance_kyc',
  'dispute_refund',
  'invoice',
  'onboarding',
  'technical',
  'fraud_security',
  'other',
] as const

export type TicketCategory = (typeof TICKET_CATEGORIES)[number]

export const COMMENT_TYPES_STAFF = ['internal', 'customer_reply'] as const

export const COMMENT_TYPE_CUSTOMER = 'customer_reply' as const

/** Fields staff may PATCH on a ticket (server-enforced). */
export const STAFF_TICKET_UPDATE_KEYS = [
  'status',
  'priority',
  'category',
  'assigned_to',
  'resolution_notes',
  'subject',
] as const
