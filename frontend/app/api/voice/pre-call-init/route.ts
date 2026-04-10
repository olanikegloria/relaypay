import { NextRequest, NextResponse } from 'next/server'
import { callN8nWebhook, getN8nWebhookBase } from '@/lib/n8n'
import { toErrorMessage } from '@/lib/error-message'

/**
 * Proxies to n8n webhook `pre-call-init` (WF18).
 */
export async function POST(request: NextRequest) {
  try {
    if (!getN8nWebhookBase()) {
      return NextResponse.json(
        { success: false, error: 'N8N_WEBHOOK_BASE_URL is not configured' },
        { status: 503 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : ''
    const customerEmail = typeof body.customerEmail === 'string' ? body.customerEmail.trim() : ''

    if (!customerName) {
      return NextResponse.json({ success: false, error: 'customerName is required' }, { status: 400 })
    }

    const { ok, status, data } = await callN8nWebhook('pre-call-init', {
      body: {
        customerName,
        customerEmail: customerEmail || undefined,
        channel: 'web',
        language: 'en',
      },
    })

    if (!ok) {
      return NextResponse.json(
        { success: false, error: toErrorMessage(data) },
        { status: status >= 400 ? status : 502 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (e) {
    return NextResponse.json({ success: false, error: toErrorMessage(e) }, { status: 500 })
  }
}
