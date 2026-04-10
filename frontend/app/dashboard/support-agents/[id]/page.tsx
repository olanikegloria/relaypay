'use client'

import { useEffect, useState, use } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, CheckCircle, Clock, HeadsetIcon, Mail, User } from 'lucide-react'
import Link from 'next/link'
import { unwrapAgentDetail } from '@/lib/n8n-entity'
import { formatDate } from '@/lib/date-utils'

export default function SupportAgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/support-agents/${encodeURIComponent(id)}`)
        const json = await res.json()
        if (!json.success || !json.data) {
          setError('Not found')
          setData(null)
          return
        }
        const row = unwrapAgentDetail(json.data, id)
        if (!row) {
          if (!cancelled) {
            setError('Agent not found')
            setData(null)
          }
          return
        }
        if (!cancelled) setData(row)
      } catch {
        setError('Failed to load')
        setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <p className="text-destructive">{error || 'Not found'}</p>
        <Link href="/dashboard/support-agents">
          <Button variant="outline">Back</Button>
        </Link>
      </div>
    )
  }

  const tickets = Array.isArray(data.recent_tickets)
    ? data.recent_tickets
    : Array.isArray(data.tickets)
      ? data.tickets
      : []

  const resolved = typeof data.tickets_resolved === 'number' ? data.tickets_resolved : 0
  const assigned = typeof data.tickets_assigned === 'number' ? data.tickets_assigned : 0
  const avgHours = data.avg_resolution_hours
  const online = String(data.online_status || 'offline')

  return (
    <div className="min-h-full bg-muted/30">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-6">
        <Link href="/dashboard/support-agents">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Support
          </Button>
        </Link>

        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="h-1 bg-primary" />
          <div className="p-6 md:p-8 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold shrink-0">
                  <HeadsetIcon className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">{String(data.full_name || 'Agent')}</h1>
                  <div className="flex items-center gap-2 text-muted-foreground mt-1">
                    <Mail className="w-4 h-4 shrink-0 text-primary" />
                    <span className="text-sm break-all">{String(data.email || '')}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="inline-flex rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold capitalize">
                      {String(data.role || 'agent')}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize ${
                        online === 'active'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}
                    >
                      {online.replace(/-/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-center">
                <CheckCircle className="w-5 h-5 text-secondary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{resolved}</p>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Resolved</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-center">
                <Clock className="w-5 h-5 text-secondary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">
                  {avgHours != null && typeof avgHours === 'number' ? avgHours.toFixed(1) : '-'}
                </p>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Avg hours</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-center col-span-2 md:col-span-2">
                <User className="w-5 h-5 text-secondary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{assigned}</p>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Open assignments</p>
              </div>
            </div>

            {data.created_at && (
              <p className="text-xs text-muted-foreground border-t border-border pt-4">
                Joined {formatDate(String(data.created_at))}
              </p>
            )}
          </div>
        </div>

        <Card className="border-border shadow-sm overflow-hidden">
          <div className="h-0.5 bg-secondary/60" />
          <CardHeader>
            <CardTitle className="text-lg">Assigned tickets</CardTitle>
            <p className="text-sm text-muted-foreground font-normal">Work queue for this agent</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {tickets.length === 0 && (
              <p className="text-muted-foreground text-sm py-6 text-center border border-dashed rounded-lg">None right now.</p>
            )}
            {tickets.map((t: Record<string, unknown>) => (
              <div
                key={String(t.id)}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/25 transition-colors"
              >
                <span className="font-medium text-sm truncate">{String(t.subject || '-')}</span>
                <span className="text-xs capitalize text-muted-foreground shrink-0">{String(t.status || '')}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
