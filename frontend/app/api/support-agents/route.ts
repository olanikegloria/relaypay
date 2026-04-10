import { NextRequest, NextResponse } from 'next/server'
import { callN8nWebhook } from '@/lib/n8n'
import { toErrorMessage } from '@/lib/error-message'
import { createClient } from '@/lib/supabase/server'

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

export async function GET() {
  const { user, role } = await getSessionRole()
  if (!user) {
    return NextResponse.json({ success: false, data: null, error: 'Unauthorized' }, { status: 401 })
  }
  if (role !== 'admin' && role !== 'agent') {
    return NextResponse.json({ success: false, data: null, error: 'Forbidden' }, { status: 403 })
  }

  const { ok, status, data } = await callN8nWebhook('agents-api', {
    body: { action: 'list' },
  })
  if (!ok) {
    return NextResponse.json(
      { success: false, data: null, error: toErrorMessage(data) },
      { status: status >= 400 ? status : 502 }
    )
  }
  return NextResponse.json({ success: true, data })
}

export async function POST(request: NextRequest) {
  const { user, role } = await getSessionRole()
  if (!user) {
    return NextResponse.json({ success: false, data: null, error: 'Unauthorized' }, { status: 401 })
  }
  if (role !== 'admin') {
    return NextResponse.json({ success: false, data: null, error: 'Forbidden' }, { status: 403 })
  }

  const incoming = await request.json()
  const body = { action: 'create' as const, ...incoming }
  const { ok, status, data } = await callN8nWebhook('agents-api', { body })
  if (!ok) {
    return NextResponse.json(
      { success: false, data: null, error: toErrorMessage(data) },
      { status: status >= 400 ? status : 502 }
    )
  }
  return NextResponse.json({ success: true, data })
}
