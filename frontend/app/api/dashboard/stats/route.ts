import { NextResponse } from 'next/server'
import { callN8nWebhook } from '@/lib/n8n'
import { toErrorMessage } from '@/lib/error-message'

export async function POST() {
  const { ok, status, data } = await callN8nWebhook('dashboard-stats', {
    body: {},
  })
  if (!ok) {
    return NextResponse.json(
      { success: false, data: null, error: toErrorMessage(data) },
      { status: status >= 400 ? status : 502 }
    )
  }
  return NextResponse.json({ success: true, data })
}
