import { NextRequest, NextResponse } from 'next/server'
import { callN8nWebhook } from '@/lib/n8n'
import { toErrorMessage } from '@/lib/error-message'
import { createClient } from '@/lib/supabase/server'
import { ticketsFromN8nData } from '@/lib/ticket-rows'

type Role = 'admin' | 'agent' | 'customer'

async function getSessionRole() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null as null, role: 'customer' as Role }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role: Role = profile?.role === 'admin' ? 'admin' : profile?.role === 'agent' ? 'agent' : 'customer'
  return { user, role }
}

export async function GET(request: NextRequest) {
  const { user, role } = await getSessionRole()
  if (!user) {
    return NextResponse.json({ success: false, data: null, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const status = searchParams.get('status') || undefined

  const body: Record<string, unknown> = {
    action: 'list',
    limit,
    offset,
    query: {
      ...(status ? { status } : {}),
    },
  }

  const { ok, status: httpStatus, data } = await callN8nWebhook('tickets-api', { body })
  if (!ok) {
    return NextResponse.json(
      { success: false, data: null, error: toErrorMessage(data) },
      { status: httpStatus >= 400 ? httpStatus : 502 }
    )
  }

  if (role === 'admin') {
    return NextResponse.json({ success: true, data })
  }

  const allRows = ticketsFromN8nData(data)
  const filtered =
    role === 'agent'
      ? allRows.filter((t) => (t.assigned_to || '') === user.id)
      : allRows.filter((t) => (t.customer_email || '').toLowerCase() === String(user.email || '').toLowerCase())

  return NextResponse.json({ success: true, data: { data: filtered, total: filtered.length } })
}

export async function POST(request: NextRequest) {
  const { user, role } = await getSessionRole()
  if (!user) {
    return NextResponse.json({ success: false, data: null, error: 'Unauthorized' }, { status: 401 })
  }
  if (role === 'customer') {
    return NextResponse.json(
      { success: false, data: null, error: 'Customers cannot create tickets from dashboard.' },
      { status: 403 }
    )
  }

  const incoming = await request.json()
  const body = {
    action: 'create' as const,
    ...incoming,
  }
  const { ok, status, data } = await callN8nWebhook('tickets-api', { body })
  if (!ok) {
    return NextResponse.json(
      { success: false, data: null, error: toErrorMessage(data) },
      { status: status >= 400 ? status : 502 }
    )
  }
  return NextResponse.json({ success: true, data })
}
