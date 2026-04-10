import { createClient } from '@/lib/supabase/server'
import { VoiceClient, type VoiceAccountPrefill } from './voice-client'

export default async function VoicePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let accountPrefill: VoiceAccountPrefill | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle()

    const email = (profile?.email ?? user.email ?? '').trim()
    const displayName = (profile?.full_name ?? '').trim() || (email ? email.split('@')[0] : '') || 'Customer'

    if (displayName) {
      accountPrefill = { displayName, email }
    }
  }

  return <VoiceClient accountPrefill={accountPrefill} />
}
