import { NextRequest, NextResponse } from 'next/server'
import { callN8nWebhook } from '@/lib/n8n'
import { toErrorMessage } from '@/lib/error-message'
import { unwrapAgentDetail } from '@/lib/n8n-entity'

type Ctx = { params: Promise<{ id: string }> }

function pickAgentFromListPayload(payload: unknown, requestedId: string): Record<string, unknown> | null {
  const want = String(requestedId).trim().toLowerCase()
  if (!payload || typeof payload !== 'object') return null
  const rows = (payload as Record<string, unknown>).data
  if (!Array.isArray(rows)) return null
  const row = rows.find(
    (r) => r && typeof r === 'object' && String((r as Record<string, unknown>).id).toLowerCase() === want
  ) as Record<string, unknown> | undefined
  return row ?? null
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { ok, status, data } = await callN8nWebhook('agents-api', {
    body: { action: 'detail', id },
  })
  if (!ok) {
    return NextResponse.json(
      { success: false, data: null, error: toErrorMessage(data) },
      { status: status >= 400 ? status : 502 }
    )
  }

  let normalized = data
  const row = unwrapAgentDetail(data, id)
  if (row) {
    normalized = { data: row }
  } else {
    const fromList = pickAgentFromListPayload(data, id)
    if (fromList) {
      normalized = { data: { ...fromList, recent_tickets: [] } }
    }
  }

  return NextResponse.json({ success: true, data: normalized })
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { ok, status, data } = await callN8nWebhook('agents-api', {
    body: { action: 'deactivate', id },
  })
  if (!ok) {
    return NextResponse.json(
      { success: false, data: null, error: toErrorMessage(data) },
      { status: status >= 400 ? status : 502 }
    )
  }
  return NextResponse.json({ success: true, data })
}
