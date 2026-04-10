import { NextRequest, NextResponse } from 'next/server'
import { callN8nWebhook } from '@/lib/n8n'
import { toErrorMessage } from '@/lib/error-message'
import { createClient } from '@/lib/supabase/server'
import { normalizeTicketDetailEnvelope } from '@/lib/ticket-detail-normalize'
import { unwrapN8nEntity } from '@/lib/n8n-entity'
import {
  canAccessTicket,
  canStaffEditTicket,
  parseTicketAuthRow,
  type TicketAuthRow,
} from '@/lib/ticket-auth'
import {
  STAFF_TICKET_UPDATE_KEYS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '@/lib/ticket-fields'

type Ctx = { params: Promise<{ id: string }> }

type Role = 'admin' | 'agent' | 'customer'

async function getSessionRole() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null as null, role: 'customer' as Role, email: '' }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role: Role = profile?.role === 'admin' ? 'admin' : profile?.role === 'agent' ? 'agent' : 'customer'
  return { user, role, email: user.email ?? '' }
}

async function fetchTicketDetailRaw(id: string): Promise<unknown | null> {
  const { ok, data } = await callN8nWebhook('tickets-api', {
    body: { action: 'detail', id },
  })
  if (!ok) return null
  return normalizeTicketDetailEnvelope(data)
}

async function loadTicketAuthRow(id: string): Promise<TicketAuthRow | null> {
  const raw = await fetchTicketDetailRaw(id)
  if (!raw) return null
  return parseTicketAuthRow(raw)
}

function filterCommentsForCustomer(row: Record<string, unknown>): Record<string, unknown> {
  const comments = row.comments
  if (!Array.isArray(comments)) return row
  const visible = comments.filter((c) => {
    if (!c || typeof c !== 'object') return false
    const t = (c as Record<string, unknown>).comment_type
    return t === 'customer_reply' || t === 'status_update'
  })
  return { ...row, comments: visible }
}

function pickStaffUpdates(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {}
  const src = raw as Record<string, unknown>
  const out: Record<string, unknown> = {}

  for (const key of STAFF_TICKET_UPDATE_KEYS) {
    if (!(key in src)) continue
    const v = src[key]

    if (key === 'assigned_to') {
      if (v === null || v === '') out[key] = null
      else if (typeof v === 'string' && v.trim()) out[key] = v.trim()
      continue
    }

    if (key === 'resolution_notes') {
      if (typeof v === 'string') out[key] = v
      continue
    }

    if (key === 'subject') {
      if (typeof v === 'string' && v.trim()) out[key] = v.trim()
      continue
    }

    if (key === 'status' && typeof v === 'string' && (TICKET_STATUSES as readonly string[]).includes(v)) {
      out[key] = v
      continue
    }
    if (key === 'priority' && typeof v === 'string' && (TICKET_PRIORITIES as readonly string[]).includes(v)) {
      out[key] = v
      continue
    }
    if (key === 'category') {
      if (v === null || v === '') {
        out[key] = null
      } else if (typeof v === 'string' && (TICKET_CATEGORIES as readonly string[]).includes(v)) {
        out[key] = v
      }
    }
  }

  return out
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { user, role, email } = await getSessionRole()
  if (!user) {
    return NextResponse.json({ success: false, data: null, error: 'Unauthorized' }, { status: 401 })
  }

  const raw = await fetchTicketDetailRaw(id)
  if (!raw) {
    return NextResponse.json({ success: false, data: null, error: 'Ticket not found' }, { status: 404 })
  }

  const ticket = parseTicketAuthRow(raw)
  if (!ticket) {
    return NextResponse.json({ success: false, data: null, error: 'Ticket not found' }, { status: 404 })
  }

  if (!canAccessTicket(role, user.id, email, ticket)) {
    return NextResponse.json({ success: false, data: null, error: 'Forbidden' }, { status: 403 })
  }

  const row = unwrapN8nEntity(raw) as Record<string, unknown> | null
  if (!row?.id) {
    return NextResponse.json({ success: false, data: null, error: 'Ticket not found' }, { status: 404 })
  }

  const payload =
    role === 'customer' ? { data: filterCommentsForCustomer(row) } : { data: row }

  return NextResponse.json({ success: true, ...payload })
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { user, role } = await getSessionRole()
  if (!user) {
    return NextResponse.json({ success: false, data: null, error: 'Unauthorized' }, { status: 401 })
  }

  const ticket = await loadTicketAuthRow(id)
  if (!ticket) {
    return NextResponse.json({ success: false, data: null, error: 'Ticket not found' }, { status: 404 })
  }

  if (!canStaffEditTicket(role, user.id, ticket)) {
    return NextResponse.json(
      { success: false, data: null, error: 'Forbidden' },
      { status: 403 }
    )
  }

  const body = await request.json()
  const updates = pickStaffUpdates(body)
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { success: false, data: null, error: 'No valid fields to update' },
      { status: 400 }
    )
  }

  const { ok, status, data } = await callN8nWebhook('tickets-api', {
    body: {
      action: 'update',
      id,
      body: { updates },
    },
  })
  if (!ok) {
    return NextResponse.json(
      { success: false, data: null, error: toErrorMessage(data) },
      { status: status >= 400 ? status : 502 }
    )
  }
  return NextResponse.json({ success: true, data })
}

