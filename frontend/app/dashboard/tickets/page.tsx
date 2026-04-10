'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'
import { Search, Plus, Download } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { formatStatusLabel, formatCategoryLabel } from '@/lib/format'
import { TICKET_CATEGORIES } from '@/lib/ticket-fields'
import { displayTicketId, ticketsFromN8nData, type TicketRow } from '@/lib/ticket-rows'
import { toErrorMessage } from '@/lib/error-message'
import { createClient } from '@/lib/supabase/client'

type Role = 'admin' | 'agent' | 'customer'

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [newTicket, setNewTicket] = useState({
    customer_name: '',
    customer_email: '',
    subject: '',
    description: '',
    priority: 'normal' as string,
  })
  const [showNewTicketDialog, setShowNewTicketDialog] = useState(false)
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [role, setRole] = useState<Role>('customer')
  const [userId, setUserId] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [assigneeNames, setAssigneeNames] = useState<Record<string, string>>({})

  const loadTickets = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/tickets?limit=100')
      const json = await res.json()
      if (!json.success || json.data == null) {
        setLoadError(typeof json.error === 'string' ? json.error : 'Failed to load tickets')
        setTickets([])
        return
      }
      const rows = ticketsFromN8nData(json.data)
      setTickets(rows)
    } catch {
      setLoadError('Network error')
      setTickets([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTickets()
  }, [loadTickets])

  useEffect(() => {
    let cancelled = false
    async function loadRole() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        if (!cancelled) {
          setUserId(user.id)
          setUserEmail(user.email || '')
        }
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
        const r: Role = profile?.role === 'admin' ? 'admin' : profile?.role === 'agent' ? 'agent' : 'customer'
        if (!cancelled) setRole(r)
        if (!cancelled && (r === 'admin' || r === 'agent')) {
          try {
            const ar = await fetch('/api/support-agents')
            const aj = await ar.json()
            if (aj.success && Array.isArray(aj.data?.data)) {
              const map: Record<string, string> = {}
              for (const a of aj.data.data as { id: string; full_name?: string; email?: string }[]) {
                if (a?.id) {
                  map[a.id] = a.full_name?.trim() || a.email || a.id.slice(0, 8)
                }
              }
              if (!cancelled) setAssigneeNames(map)
            }
          } catch {
            /* ignore */
          }
        }
      } catch {
        if (!cancelled) setRole('customer')
      }
    }
    void loadRole()
    return () => { cancelled = true }
  }, [])


  const scopedTickets = tickets.filter((ticket) => {
    if (role === 'admin') return true
    if (role === 'agent') return (ticket.assigned_to || '') === userId
    return (ticket.customer_email || '').toLowerCase() === userEmail.toLowerCase()
  })

  const filteredTickets = scopedTickets.filter((ticket) => {
    const label = displayTicketId(ticket)
    const matchesSearch =
      label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ticket.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ticket.subject || '').toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = filterStatus === 'all' || ticket.status === filterStatus
    const matchesPriority = filterPriority === 'all' || ticket.priority === filterPriority
    const matchesCategory =
      filterCategory === 'all' ||
      (filterCategory === 'uncategorized' && !ticket.category) ||
      ticket.category === filterCategory

    return matchesSearch && matchesStatus && matchesPriority && matchesCategory
  })

  const exportCsv = () => {
    const rows = filteredTickets
    const headers = [
      'id',
      'ticket_number',
      'customer_name',
      'customer_email',
      'subject',
      'status',
      'priority',
      'category',
      'assignee',
      'sla_due_at',
      'sla_breached',
      'created_at',
    ]
    const esc = (v: string | number | boolean | null | undefined) => {
      const s = v == null ? '' : String(v)
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const lines = [
      headers.join(','),
      ...rows.map((t) =>
        [
          t.id,
          t.ticket_number ?? '',
          t.customer_name ?? '',
          t.customer_email ?? '',
          t.subject ?? '',
          t.status ?? '',
          t.priority ?? '',
          t.category ?? '',
          t.assigned_to ? assigneeNames[t.assigned_to] || t.assigned_to : '',
          t.sla_due_at ?? '',
          t.sla_breached ? 'yes' : '',
          t.created_at ?? '',
        ]
          .map(esc)
          .join(',')
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relaypay-tickets-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCreateTicket = async () => {
    if (creatingTicket) return
    if (!newTicket.customer_name.trim() || !newTicket.customer_email.trim() || !newTicket.subject.trim() || !newTicket.description.trim()) {
      setLoadError('Fill all required ticket fields before creating.')
      return
    }
    setCreatingTicket(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: newTicket.subject,
          description: newTicket.description,
          customer_name: newTicket.customer_name,
          customer_email: newTicket.customer_email,
          priority: newTicket.priority,
          source: 'web_form',
        }),
      })
      const json = await res.json()
      if (!json.success) {
        setLoadError(toErrorMessage(json.error ?? json) || 'Could not create ticket')
        return
      }
      const created = ticketsFromN8nData(json.data)
      setNewTicket({
        customer_name: '',
        customer_email: '',
        subject: '',
        description: '',
        priority: 'normal',
      })
      setShowNewTicketDialog(false)
      setLoadError(null)
      if (created.length > 0) {
        setTickets((prev) => {
          const ids = new Set(created.map((c) => c.id))
          return [...created, ...prev.filter((p) => !ids.has(p.id))]
        })
      }
      await loadTickets()
    } catch {
      setLoadError('Could not create ticket')
    } finally {
      setCreatingTicket(false)
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tickets</h1>
          <p className="text-muted-foreground mt-1">Manage and track support tickets</p>
        </div>
        {role !== 'customer' && (
        <Dialog open={showNewTicketDialog} onOpenChange={setShowNewTicketDialog}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground w-full md:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              New ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create ticket</DialogTitle>
              <DialogDescription>Creates a row in support_tickets via the tickets-api workflow.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleCreateTicket()
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Customer name</label>
                <Input
                  value={newTicket.customer_name}
                  onChange={(e) => setNewTicket({ ...newTicket, customer_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Customer email</label>
                <Input
                  type="email"
                  value={newTicket.customer_email}
                  onChange={(e) => setNewTicket({ ...newTicket, customer_email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Subject</label>
                <Input
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Description</label>
                <Textarea
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Priority</label>
                <select
                  value={newTicket.priority}
                  onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <Button
                type="button"
                disabled={creatingTicket}
                onClick={() => void handleCreateTicket()}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {creatingTicket ? 'Creating...' : 'Create ticket'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {loadError && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {loadError} (ensure N8N_WEBHOOK_BASE_URL is set and tickets-api workflow is active)
        </p>
      )}

      <Card className="border-border">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="md:col-span-2 lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search tickets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-border bg-card"
                />
              </div>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-card"
            >
              <option value="all">All status</option>
              <option value="open">Open</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In progress</option>
              <option value="pending_customer">Pending customer</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-card"
            >
              <option value="all">All priority</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            {role !== 'customer' ? (
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg bg-card"
              >
                <option value="all">All categories</option>
                <option value="uncategorized">Uncategorized</option>
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {formatCategoryLabel(c)}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>
              {loading ? 'Loading…' : `${filteredTickets.length} tickets`}
            </CardTitle>
            {role !== 'customer' ? (
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={loading || filteredTickets.length === 0}
                onClick={() => exportCsv()}
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Customer</th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Subject</th>
                  {role !== 'customer' ? (
                    <>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Category</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Assignee</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">SLA</th>
                    </>
                  ) : null}
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Priority</th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Created</th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {!loading && scopedTickets.length === 0 ? (
                  <tr>
                    <td colSpan={role === 'customer' ? 7 : 10} className="py-8 px-4 text-center text-muted-foreground">
                      No ticket rows with a valid <code className="text-xs">id</code>. Check n8n WF10 (list action
                      must return real ticket fields, not empty <code className="text-xs">{}</code>).
                    </td>
                  </tr>
                ) : null}
                {!loading && scopedTickets.length > 0 && filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={role === 'customer' ? 7 : 10} className="py-8 px-4 text-center text-muted-foreground">
                      No tickets match your search or filters.
                    </td>
                  </tr>
                ) : null}
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-border hover:bg-muted/50 transition">
                    <td className="py-3 px-4 font-medium text-secondary">{displayTicketId(ticket)}</td>
                    <td className="py-3 px-4">{ticket.customer_name || '-'}</td>
                    <td className="py-3 px-4 max-w-[200px] truncate" title={ticket.subject || ''}>
                      {ticket.subject || '-'}
                    </td>
                    {role !== 'customer' ? (
                      <>
                        <td className="py-3 px-4 text-muted-foreground text-xs max-w-[120px] truncate">
                          {formatCategoryLabel(ticket.category)}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {ticket.assigned_to
                            ? assigneeNames[ticket.assigned_to] || ticket.assigned_to.slice(0, 8)
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {ticket.sla_breached ? (
                            <span className="text-destructive font-medium">Breached</span>
                          ) : ticket.sla_due_at ? (
                            <span className="text-muted-foreground">
                              {new Date(ticket.sla_due_at).toLocaleDateString()}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </>
                    ) : null}
                    <td className="py-3 px-4">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-muted text-foreground capitalize">
                        {ticket.status ? formatStatusLabel(ticket.status) : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 capitalize">{ticket.priority || '-'}</td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {ticket.created_at
                        ? new Date(ticket.created_at).toLocaleString()
                        : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <Link href={`/dashboard/tickets/${ticket.id}`}>
                        <Button variant="link" size="sm" className="text-secondary">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
