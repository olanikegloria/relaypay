import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from './dashboard-shell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/dashboard')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    redirect('/login')
  }

  const role = profile.role as 'admin' | 'agent' | 'customer'
  const isAdmin = role === 'admin'
  const showCustomersNav = role === 'admin' || role === 'agent'

  return (
    <DashboardShell
      isAdmin={isAdmin}
      showCustomersNav={showCustomersNav}
      role={role}
      userId={user.id}
      userEmail={user.email ?? ''}
      displayName={profile.full_name?.trim() || user.email || 'User'}
    >
      {children}
    </DashboardShell>
  )
}
