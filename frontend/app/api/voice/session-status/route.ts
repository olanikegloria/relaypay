import { NextRequest, NextResponse } from 'next/server'
import { callN8nWebhook, getN8nWebhookBase } from '@/lib/n8n'

/** Proxies to WF13: GET .../webhook/session-status?vapi_call_id=... */
export async function GET(request: NextRequest) {
  const vapiCallId = request.nextUrl.searchParams.get('vapi_call_id')?.trim() ?? ''
  if (!vapiCallId) {
    return NextResponse.json({ error: 'vapi_call_id query parameter is required' }, { status: 400 })
  }

  if (!getN8nWebhookBase()) {
    return NextResponse.json({ error: 'N8N_WEBHOOK_BASE_URL is not configured' }, { status: 503 })
  }

  const { ok, status, data } = await callN8nWebhook('session-status', {
    method: 'GET',
    searchParams: { vapi_call_id: vapiCallId },
  })

  if (!ok) {
    return NextResponse.json(data ?? { error: 'session-status failed' }, { status: status >= 400 ? status : 502 })
  }

  return NextResponse.json(data)
}
