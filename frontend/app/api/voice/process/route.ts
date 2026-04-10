import { NextRequest, NextResponse } from 'next/server'
import { callN8nWebhook, getN8nWebhookBase } from '@/lib/n8n'
import { toErrorMessage } from '@/lib/error-message'

/** Matches Vapi tool-call shape so WF1 can normalize to transcript (see WF1 Validate node). */
function buildVapiToolCallsPayload(
  question: string,
  callId: string,
  variableValues: {
    customer_name: string
    customer_email: string
    relaypay_session_id?: string
  }
) {
  const q = question.trim()
  const vars: Record<string, string> = {
    customer_name: variableValues.customer_name,
    customer_email: variableValues.customer_email,
  }
  if (variableValues.relaypay_session_id?.trim()) {
    vars.relaypay_session_id = variableValues.relaypay_session_id.trim()
  }
  return {
    message: {
      type: 'tool-calls',
      toolCallList: [
        {
          id: 'text-fallback',
          function: {
            name: 'olanike_tool',
            arguments: JSON.stringify({ question: q }),
          },
        },
      ],
      call: {
        id: callId,
        assistantOverrides: {
          variableValues: vars,
        },
      },
    },
    call: { id: callId },
  }
}

function extractAgentReply(data: unknown): { text: string; raw: unknown } {
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>
    const results = o.results
    if (Array.isArray(results) && results.length > 0) {
      const first = results[0] as Record<string, unknown>
      if (typeof first.result === 'string') return { text: first.result, raw: data }
    }
    if (typeof o.result === 'string') return { text: o.result, raw: data }
    if (typeof o.message === 'string') return { text: o.message, raw: data }
    if (typeof o.error === 'string') return { text: `Error: ${o.error}`, raw: data }
    const inner = o.data
    if (inner && typeof inner === 'object') {
      const d = inner as Record<string, unknown>
      if (typeof d.result === 'string') return { text: d.result, raw: data }
      const dr = d.results
      if (Array.isArray(dr) && dr.length > 0) {
        const row = dr[0] as Record<string, unknown>
        if (typeof row.result === 'string') return { text: row.result, raw: data }
      }
    }
  }
  if (typeof data === 'string') return { text: data, raw: data }
  return { text: 'No response from support service.', raw: data }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    const callId =
      typeof body.callId === 'string' && body.callId.trim().length > 0
        ? body.callId.trim()
        : crypto.randomUUID()

    const customerName =
      typeof body.customerName === 'string' && body.customerName.trim()
        ? body.customerName.trim()
        : 'Voice Customer'
    const customerEmail =
      typeof body.customerEmail === 'string' && body.customerEmail.trim()
        ? body.customerEmail.trim()
        : ''
    const relaypaySessionId =
      typeof body.relaypaySessionId === 'string' ? body.relaypaySessionId.trim() : ''

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      )
    }

    if (!getN8nWebhookBase()) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Voice backend is not configured. Set N8N_WEBHOOK_BASE_URL in your environment.',
        },
        { status: 503 }
      )
    }

    const { ok, status, data } = await callN8nWebhook('vapi-main', {
      body: buildVapiToolCallsPayload(message, callId, {
        customer_name: customerName,
        customer_email: customerEmail,
        ...(relaypaySessionId ? { relaypay_session_id: relaypaySessionId } : {}),
      }),
    })

    if (!ok) {
      return NextResponse.json(
        {
          success: false,
          callId,
          error: toErrorMessage(data),
        },
        { status: status >= 400 ? status : 502 }
      )
    }

    const { text, raw } = extractAgentReply(data)

    return NextResponse.json({
      success: true,
      callId,
      data: {
        output: text,
        raw,
        processedAt: new Date().toISOString(),
      },
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to process message' },
      { status: 500 }
    )
  }
}
