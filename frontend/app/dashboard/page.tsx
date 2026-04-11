'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, Users, Ticket, MessageSquare, HeadsetIcon } from 'lucide-react'
import Link from 'next/link'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { msToShortDuration, formatStatusLabel } from '@/lib/format'
import { displayTicketId, ticketsFromN8nData, type TicketRow } from '@/lib/ticket-rows'
import { createClient } from '@/lib/supabase/client'

type Role = 'admin' | 'agent' | 'customer'

type Stats = {
  answer_rate?: number
  avg_latency_ms?: number
  open_tickets?: number
  urgent_tickets?: number
  active_agents?: number
  avg_resolution_hours?: string | number
  live_calls?: number
}

type ChartPayload = {
  ticketTrend?: Array<{ name: string; tickets?: number; resolved?: number; satisfaction?: number }>
  agentPerformance?: Array<{ name: string; resolved?: number; avgHours?: number }>
}

function roleScopedTickets(all: TicketRow[], role: Role, userId: string, userEmail: string): TicketRow[] {
  if (role === 'admin') return all
  if (role === 'agent') return all.filter((t) => (t.assigned_to || '') === userId)
  return all.filter((t) => (t.customer_email || '').toLowerCase() === userEmail.toLowerCase())
}

export default function DashboardPage() {
  const [role, setRole] = useState<Role>('customer')
  const [stats, setStats] = useState<Stats | null>(null)
  const [charts, setCharts] = useState<ChartPayload | null>(null)
  const [recent, setRecent] = useState<TicketRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('Session expired. Please log in again.')
        return
      }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      const nextRole: Role = profile?.role === 'admin' ? 'admin' : profile?.role === 'agent' ? 'agent' : 'customer'
      setRole(nextRole)

      const tRes = await fetch('/api/tickets?limit=200')
      const tJson = await tRes.json()
      const ticketRows = tJson.success && tJson.data ? ticketsFromN8nData(tJson.data) : []
      const mine = roleScopedTickets(ticketRows, nextRole, user.id, user.email || '')
      setRecent(mine.slice(0, 5))

      if (nextRole === 'admin') {
        const [sRes, cRes] = await Promise.all([
          fetch('/api/dashboard/stats', { method: 'POST' }),
          fetch('/api/analytics/chart?days=7'),
        ])
        const sJson = await sRes.json()
        const cJson = await cRes.json()

        setStats(sJson.success && sJson.data ? (sJson.data as Stats) : null)
        setCharts(cJson.success && cJson.data ? (cJson.data as ChartPayload) : null)
      } else {
        const openMine = mine.filter((t) => ['open', 'assigned', 'in_progress', 'pending_customer'].includes(t.status || '')).length
        const urgentMine = mine.filter((t) => (t.priority || '') === 'urgent').length
        const resolvedMine = mine.filter((t) => (t.status || '') === 'resolved' || (t.status || '') === 'closed').length

        setStats({
          open_tickets: openMine,
          urgent_tickets: urgentMine,
          live_calls: 0,
          answer_rate: mine.length > 0 ? (resolvedMine / mine.length) * 100 : 0,
        })
        setCharts(null)
      }
    } catch {
      setError('Failed to load dashboard')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const chartData = charts?.ticketTrend?.length
    ? charts.ticketTrend
    : [{ name: '-', tickets: 0, resolved: 0, satisfaction: 0 }]

  const statCards =
    role === 'admin'
      ? [
          { title: 'Open tickets', value: stats?.open_tickets != null ? String(stats.open_tickets) : '-', icon: Ticket },
          { title: 'Live sessions', value: stats?.live_calls != null ? String(stats.live_calls) : '-', icon: Users },
          { title: 'Avg latency', value: stats?.avg_latency_ms != null ? msToShortDuration(stats.avg_latency_ms) : '-', icon: MessageSquare },
          { title: 'Answer rate', value: stats?.answer_rate != null ? `${Number(stats.answer_rate).toFixed(0)}%` : '-', icon: TrendingUp },
          { title: 'Active agents', value: stats?.active_agents != null ? String(stats.active_agents) : '-', icon: HeadsetIcon },
        ]
      : [
          { title: role === 'customer' ? 'My tickets' : 'Assigned tickets', value: String(recent.length), icon: Ticket },
          { title: 'Open', value: stats?.open_tickets != null ? String(stats.open_tickets) : '-', icon: MessageSquare },
          { title: 'Urgent', value: stats?.urgent_tickets != null ? String(stats.urgent_tickets) : '-', icon: TrendingUp },
          { title: 'Resolution rate', value: stats?.answer_rate != null ? `${Number(stats.answer_rate).toFixed(0)}%` : '-', icon: Users },
        ]

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            {role === 'admin' ? 'System-wide operations overview.' : 'Your personal support workspace overview.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/tickets">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Ticket className="mr-2 h-4 w-4" />
              Tickets
            </Button>
          </Link>
          {role !== 'customer' && (
            <Link href="/dashboard/customers">
              <Button variant="outline" className="border-primary text-primary hover:bg-accent">
                <Users className="mr-2 h-4 w-4" />
                Customers
              </Button>
            </Link>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className={`grid grid-cols-1 gap-4 ${role === 'admin' ? 'md:grid-cols-2 lg:grid-cols-5' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title} className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                  <div className="rounded-lg bg-secondary/10 p-2">
                    <Icon className="h-4 w-4 text-secondary" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {role === 'admin' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Session and answer trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />
                  <XAxis dataKey="name" stroke="#666666" />
                  <YAxis stroke="#666666" />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e8e8e8', borderRadius: '8px' }} />
                  <Legend />
                  <Line type="monotone" dataKey="tickets" stroke="#1A8FA0" name="Sessions" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="resolved" stroke="#1A3A5C" name="Answers" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle>Answer rate (daily)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />
                  <XAxis dataKey="name" stroke="#666666" />
                  <YAxis stroke="#666666" />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e8e8e8', borderRadius: '8px' }} />
                  <Bar dataKey="satisfaction" fill="#1A8FA0" name="Answer rate %" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle>Recent tickets</CardTitle>
          <Link href="/dashboard/tickets">
            <Button variant="ghost" size="sm" className="text-secondary hover:bg-secondary/10">View all</Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Customer</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Subject</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Priority</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No recent tickets.</td>
                  </tr>
                ) : (
                  recent.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-border transition hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/tickets/${encodeURIComponent(ticket.id)}`}>
                          <Button variant="link" className="h-auto p-0 text-secondary">{displayTicketId(ticket)}</Button>
                        </Link>
                      </td>
                      <td className="px-4 py-3">{ticket.customer_name || '-'}</td>
                      <td className="px-4 py-3">{ticket.subject || '-'}</td>
                      <td className="px-4 py-3 capitalize">{ticket.status ? formatStatusLabel(ticket.status) : '-'}</td>
                      <td className="px-4 py-3 capitalize">{ticket.priority || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
