import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/** Customers: admins and agents. */
export default async function CustomersSectionLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/customers')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = profile?.role
  if (role !== 'admin' && role !== 'agent') redirect('/dashboard')

  return children
}
