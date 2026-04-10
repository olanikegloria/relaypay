import { NextRequest, NextResponse } from 'next/server'
import { callN8nWebhook, getN8nDashboardApiKey } from '@/lib/n8n'
import { toErrorMessage } from '@/lib/error-message'

/**
 * n8n "Respond to Webhook" (JSON) sometimes returns:
 * - double-encoded JSON (string body parsed once still a string)
 * - a one-item array wrapping the payload
 * - { data: { ticketTrend, agentPerformance } }
 */
function normalizeChartPayload(raw: unknown): { ticketTrend: unknown[]; agentPerformance: unknown[] } {
  let v: unknown = raw
  for (let i = 0; i < 3 && typeof v === 'string' && v.trim(); i++) {
    try {
      v = JSON.parse(v) as unknown
    } catch {
      break
    }
  }
  if (Array.isArray(v) && v.length > 0 && v[0] != null && typeof v[0] === 'object' && !Array.isArray(v[0])) {
    v = v[0]
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>
    const inner = o.data
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      const d = inner as Record<string, unknown>
      if ('ticketTrend' in d || 'agentPerformance' in d) {
        v = inner
      }
    }
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    return { ticketTrend: [], agentPerformance: [] }
  }
  const obj = v as Record<string, unknown>
  return {
    ticketTrend: Array.isArray(obj.ticketTrend) ? obj.ticketTrend : [],
    agentPerformance: Array.isArray(obj.agentPerformance) ? obj.agentPerformance : [],
  }
}

export async function GET(request: NextRequest) {
  const days = request.nextUrl.searchParams.get('days') ?? '7'
  const apiKey = getN8nDashboardApiKey()

  const { ok, status, data } = await callN8nWebhook('analytics-chart', {
    method: 'GET',
    searchParams: {
      days,
      'x-api-key': apiKey,
    },
  })

  if (!ok) {
    return NextResponse.json(
      { success: false, data: null, error: toErrorMessage(data) },
      { status: status >= 400 ? status : 502 }
    )
  }
  const normalized = normalizeChartPayload(data)
  return NextResponse.json({ success: true, data: normalized })
}
