import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Mail, User, Calendar, Ticket } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/date-utils'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/dashboard/profile')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, created_at')
    .eq('id', user.id)
    .maybeSingle()

  const email = profile?.email || user.email || ''
  const role = (profile?.role as string) || 'customer'
  const displayName = profile?.full_name?.trim() || email.split('@')[0] || 'User'

  const { data: ticketsRaw } = await supabase
    .from('support_tickets')
    .select('id, ticket_number, subject, status, priority, created_at')
    .eq('customer_email', email)
    .order('created_at', { ascending: false })
    .limit(12)

  const tickets = Array.isArray(ticketsRaw) ? ticketsRaw : []

  return (
    <div className="min-h-full bg-muted/30">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-10">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
        </Link>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="h-1 bg-primary" />
          <div className="space-y-6 p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                {displayName
                  .split(/\s+/)
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase() || '?'}
              </div>
              <div className="min-w-0 space-y-1">
                <h1 className="text-2xl font-bold text-foreground md:text-3xl">{displayName}</h1>
                <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0 text-primary" />
                  <span className="break-all text-sm">{email}</span>
                </div>
                <span className="mt-2 inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize text-foreground">
                  {role}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:grid-cols-2 md:p-5">
              <div className="flex gap-3">
                <User className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</p>
                  <p className="font-medium capitalize">{role}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Member since</p>
                  <p className="font-medium">{profile?.created_at ? formatDate(String(profile.created_at)) : '-'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Card className="overflow-hidden border-border shadow-sm">
          <div className="h-0.5 bg-secondary/60" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Ticket className="h-5 w-5 text-secondary" />
              My tickets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tickets.length === 0 && (
              <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">No tickets yet.</p>
            )}
            {tickets.map((t) => (
              <Link key={String(t.id)} href={`/dashboard/tickets/${encodeURIComponent(String(t.id))}`}>
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/25">
                  <span className="truncate text-sm font-medium">{String(t.subject || '-')}</span>
                  <span className="shrink-0 text-xs capitalize text-muted-foreground">{String(t.status || '')}</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
