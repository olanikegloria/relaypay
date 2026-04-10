'use client'

import { useEffect, useState, use } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Mail, User, Calendar, MessageSquare, Ticket } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/date-utils'
import { unwrapN8nEntity } from '@/lib/n8n-entity'

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const email = decodeURIComponent(id)
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/customers/${encodeURIComponent(id)}`)
        const json = await res.json()
        if (!json.success || !json.data) {
          setError('Customer not found or API error')
          setData(null)
          return
        }
        const row = unwrapN8nEntity(json.data)
        if (!row) {
          if (!cancelled) {
            setError('Customer not found')
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
        <Link href="/dashboard/customers">
          <Button variant="outline">Back</Button>
        </Link>
      </div>
    )
  }

  const sessions = Array.isArray(data.sessions) ? data.sessions : []
  const tickets = Array.isArray(data.tickets) ? data.tickets : []
  const displayName = String(data.full_name || '').trim() || String(data.email || email)

  return (
    <div className="min-h-full bg-muted/30">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-6">
        <Link href="/dashboard/customers">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Customers
          </Button>
        </Link>

        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="h-1 bg-primary" />
          <div className="p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold shrink-0">
                {displayName
                  .split(/\s+/)
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase() || '?'}
              </div>
              <div className="min-w-0 space-y-1">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">{displayName}</h1>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4 shrink-0 text-primary" />
                  <a href={`mailto:${String(data.email || email)}`} className="text-sm hover:text-secondary break-all">
                    {String(data.email || email)}
                  </a>
                </div>
                <span className="inline-flex mt-2 rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize text-foreground">
                  {String(data.role || 'customer')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-border bg-muted/40 p-4 md:p-5">
              <div className="flex gap-3">
                <User className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Role</p>
                  <p className="font-medium capitalize">{String(data.role || 'customer')}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Calendar className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer since</p>
                  <p className="font-medium">{data.created_at ? formatDate(String(data.created_at)) : '-'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Card className="border-border shadow-sm overflow-hidden">
          <div className="h-0.5 bg-secondary/60" />
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-secondary" />
              Recent sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.length === 0 && (
              <p className="text-muted-foreground text-sm py-6 text-center border border-dashed rounded-lg">No sessions.</p>
            )}
            {sessions.map((s: Record<string, unknown>) => (
              <div
                key={String(s.id)}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/25 transition-colors"
              >
                <span className="font-medium capitalize text-sm">{String(s.status || '-')}</span>
                <span className="text-xs text-muted-foreground">
                  {s.started_at ? new Date(String(s.started_at)).toLocaleString() : ''}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm overflow-hidden">
          <div className="h-0.5 bg-secondary/60" />
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Ticket className="w-5 h-5 text-secondary" />
              Tickets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tickets.length === 0 && (
              <p className="text-muted-foreground text-sm py-6 text-center border border-dashed rounded-lg">No tickets.</p>
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
