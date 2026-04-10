import { NextRequest, NextResponse } from 'next/server'
import { callN8nWebhook } from '@/lib/n8n'
import { toErrorMessage } from '@/lib/error-message'

/** `id` is the URL-encoded customer email (profiles are keyed by auth user id; list/detail workflows use email). */
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const email = decodeURIComponent(id)
  const { ok, status, data } = await callN8nWebhook('customers-api', {
    body: {
      action: 'detail',
      email,
      query: { email },
    },
  })
  if (!ok) {
    return NextResponse.json(
      { success: false, data: null, error: toErrorMessage(data) },
      { status: status >= 400 ? status : 502 }
    )
  }
  return NextResponse.json({ success: true, data })
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const email = decodeURIComponent(id)
  const body = await request.json()
  const { ok, status, data } = await callN8nWebhook('customers-api', {
    body: {
      action: 'detail',
      email,
      query: { email },
      ...body,
    },
  })
  if (!ok) {
    return NextResponse.json(
      { success: false, data: null, error: toErrorMessage(data) },
      { status: status >= 400 ? status : 502 }
    )
  }
  return NextResponse.json({ success: true, data })
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const email = decodeURIComponent(id)
  const { ok, status, data } = await callN8nWebhook('customers-api', {
    body: { action: 'detail', email, query: { email } },
  })
  if (!ok) {
    return NextResponse.json(
      { success: false, data: null, error: toErrorMessage(data) },
      { status: status >= 400 ? status : 502 }
    )
  }
  return NextResponse.json({ success: true, data })
}
