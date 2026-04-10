import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function SupportAgentDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = profile?.role

  if (role === 'customer') {
    redirect('/dashboard')
  }

  if (role === 'agent' && id !== user.id) {
    redirect(`/dashboard/support-agents/${user.id}`)
  }

  return children
}
