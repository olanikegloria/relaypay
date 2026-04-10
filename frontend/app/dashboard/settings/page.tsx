import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { callN8nWebhook, getN8nWebhookBase } from '@/lib/n8n'
import { Activity, Database, HeadsetIcon, RefreshCcw, Ticket, Users } from 'lucide-react'

type StatsData = {
  open_tickets?: number
  live_calls?: number
  active_agents?: number
  avg_latency_ms?: number
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/dashboard/settings')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [{ count: customersCount }, { count: agentsCount }, { count: openTicketsCount }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase.from('support_agents').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('support_tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'assigned', 'in_progress']),
  ])

  const statsRes = await callN8nWebhook('dashboard-stats', { body: {} })
  const stats = (statsRes.ok ? (statsRes.data as StatsData) : null) ?? null

  const n8nBase = getN8nWebhookBase()

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin settings</h1>
        <p className="mt-1 text-muted-foreground">Operational controls and backend-connected health overview.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary"><Users className="h-5 w-5" /></div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Customers</p>
                <p className="text-2xl font-bold text-foreground">{customersCount ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-secondary/10 p-2 text-secondary"><HeadsetIcon className="h-5 w-5" /></div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Active agents</p>
                <p className="text-2xl font-bold text-foreground">{agentsCount ?? stats?.active_agents ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-500/10 p-2 text-orange-600"><Ticket className="h-5 w-5" /></div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Open tickets</p>
                <p className="text-2xl font-bold text-foreground">{openTicketsCount ?? stats?.open_tickets ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600"><Activity className="h-5 w-5" /></div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Live calls</p>
                <p className="text-2xl font-bold text-foreground">{stats?.live_calls ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Backend status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="text-muted-foreground">n8n webhook base</span>
              <span className={n8nBase ? 'font-medium text-emerald-600' : 'font-medium text-destructive'}>
                {n8nBase ? 'Configured' : 'Missing'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="text-muted-foreground">Dashboard stats endpoint</span>
              <span className={statsRes.ok ? 'font-medium text-emerald-600' : 'font-medium text-destructive'}>
                {statsRes.ok ? 'Reachable' : 'Unavailable'}
              </span>
            </div>
            {!statsRes.ok && (
              <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive">
                Could not fetch dashboard stats from n8n. Confirm workflow is active and API key matches.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Admin actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/dashboard/support-agents" className="block">
              <Button variant="outline" className="w-full justify-start border-border">
                <HeadsetIcon className="mr-2 h-4 w-4" />
                Manage support agents
              </Button>
            </Link>
            <Link href="/dashboard/customers" className="block">
              <Button variant="outline" className="w-full justify-start border-border">
                <Users className="mr-2 h-4 w-4" />
                Manage customers
              </Button>
            </Link>
            <Link href="/dashboard/tickets" className="block">
              <Button variant="outline" className="w-full justify-start border-border">
                <Ticket className="mr-2 h-4 w-4" />
                Open tickets queue
              </Button>
            </Link>
            <Link href="/dashboard" className="block">
              <Button className="w-full justify-start bg-primary text-primary-foreground hover:bg-primary/90">
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh operational dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Database className="h-5 w-5 text-secondary" />Data sources</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Settings uses live data from Supabase tables (`profiles`, `support_agents`, `support_tickets`) and n8n (`dashboard-stats`).
        </CardContent>
      </Card>
    </div>
  )
}
