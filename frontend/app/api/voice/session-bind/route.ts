import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toErrorMessage } from '@/lib/error-message'

type SessionMetadata = Record<string, unknown>

function parseMetadata(raw: unknown): SessionMetadata {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as SessionMetadata
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as SessionMetadata
    } catch {
      /* ignore */
    }
  }
  return {}
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : ''
    const vapiCallId = typeof body.vapi_call_id === 'string' ? body.vapi_call_id.trim() : ''
    const customerToken = typeof body.customer_token === 'string' ? body.customer_token.trim() : ''

    if (!sessionId || !vapiCallId || !customerToken) {
      return NextResponse.json(
        { success: false, error: 'session_id, vapi_call_id, and customer_token are required' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const { data: row, error: fetchErr } = await admin
      .from('sessions')
      .select('id,metadata')
      .eq('id', sessionId)
      .maybeSingle()

    if (fetchErr) {
      return NextResponse.json({ success: false, error: toErrorMessage(fetchErr) }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 })
    }

    const meta = parseMetadata(row.metadata)
    const expected =
      typeof meta.customer_token === 'string'
        ? meta.customer_token
        : typeof meta.customerToken === 'string'
          ? meta.customerToken
          : null

    if (!expected || expected !== customerToken) {
      return NextResponse.json({ success: false, error: 'Invalid customer_token' }, { status: 403 })
    }

    const nextMeta: SessionMetadata = {
      ...meta,
      vapi_call_bound_at: new Date().toISOString(),
    }

    const { error: updErr } = await admin
      .from('sessions')
      .update({
        vapi_call_id: vapiCallId,
        metadata: nextMeta,
      })
      .eq('id', sessionId)

    if (updErr) {
      return NextResponse.json({ success: false, error: toErrorMessage(updErr) }, { status: 500 })
    }

    return NextResponse.json({ success: true, vapi_call_id: vapiCallId })
  } catch (e) {
    const msg = toErrorMessage(e)
    if (msg.includes('Missing NEXT_PUBLIC_SUPABASE_URL')) {
      return NextResponse.json({ success: false, error: 'Supabase admin client is not configured' }, { status: 503 })
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
