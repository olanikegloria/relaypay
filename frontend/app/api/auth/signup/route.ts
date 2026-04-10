import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toErrorMessage } from '@/lib/error-message'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const roleRaw = body.role === 'agent' ? 'agent' : 'customer'
    const inviteCode = typeof body.inviteCode === 'string' ? body.inviteCode.trim() : ''

    if (!email || !password || password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Valid email and password (8+ characters) required' },
        { status: 400 }
      )
    }

    const expectedInvite = process.env.AGENT_INVITE_CODE?.trim() ?? ''
    if (roleRaw === 'agent') {
      if (!expectedInvite || inviteCode !== expectedInvite) {
        return NextResponse.json({ success: false, error: 'Invalid agent invite code' }, { status: 403 })
      }
    }

    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || null,
        role: roleRaw,
        invite_valid: roleRaw === 'agent',
      },
    })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      userId: data.user?.id,
      email: data.user?.email,
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: toErrorMessage(e) }, { status: 500 })
  }
}
