import { NextRequest, NextResponse } from 'next/server'
import { callN8nWebhook } from '@/lib/n8n'
import { toErrorMessage } from '@/lib/error-message'
import { createClient } from '@/lib/supabase/server'
import {
  canPostCommentOnTicket,
  parseTicketAuthRow,
} from '@/lib/ticket-auth'
import { normalizeTicketDetailEnvelope } from '@/lib/ticket-detail-normalize'
import { COMMENT_TYPE_CUSTOMER, COMMENT_TYPES_STAFF } from '@/lib/ticket-fields'

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

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id: ticketId } = await params
  const { user, role, email } = await getSessionRole()
  if (!user) {
    return NextResponse.json({ success: false, data: null, error: 'Unauthorized' }, { status: 401 })
  }

  const { ok: detailOk, data: detailData } = await callN8nWebhook('tickets-api', {
    body: { action: 'detail', id: ticketId },
  })
  if (!detailOk) {
    return NextResponse.json({ success: false, data: null, error: 'Ticket not found' }, { status: 404 })
  }

  const ticket = parseTicketAuthRow(normalizeTicketDetailEnvelope(detailData))
  if (!ticket) {
    return NextResponse.json({ success: false, data: null, error: 'Ticket not found' }, { status: 404 })
  }

  if (!canPostCommentOnTicket(role, user.id, email, ticket)) {
    return NextResponse.json({ success: false, data: null, error: 'Forbidden' }, { status: 403 })
  }

  const json = await request.json()
  const content = typeof json.content === 'string' ? json.content.trim() : ''
  if (!content) {
    return NextResponse.json({ success: false, data: null, error: 'Content is required' }, { status: 400 })
  }

  let comment_type: string
  if (role === 'customer') {
    comment_type = COMMENT_TYPE_CUSTOMER
  } else {
    const requested = typeof json.comment_type === 'string' ? json.comment_type : 'internal'
    comment_type = (COMMENT_TYPES_STAFF as readonly string[]).includes(requested)
      ? requested
      : 'internal'
  }

  const { ok, status, data } = await callN8nWebhook('tickets-api', {
    body: {
      action: 'comment',
      id: ticketId,
      body: {
        ticket_id: ticketId,
        content,
        comment_type,
        author_id: user.id,
      },
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
