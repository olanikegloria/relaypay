import { NextResponse } from 'next/server'
import { callN8nWebhook } from '@/lib/n8n'
import { toErrorMessage } from '@/lib/error-message'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ success: false, data: null, error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = profile?.role ?? 'customer'
  if (role === 'customer') {
    return NextResponse.json({ success: false, data: null, error: 'Forbidden' }, { status: 403 })
  }

  const { ok, status, data } = await callN8nWebhook('customers-api', {
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
