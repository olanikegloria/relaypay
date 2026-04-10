import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SupportAgentsList from './support-agents-list'

export default async function SupportAgentsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role === 'customer') {
    redirect('/dashboard')
  }

  if (profile?.role === 'agent') {
    redirect(`/dashboard/support-agents/${user.id}`)
  }

  return <SupportAgentsList />
}
