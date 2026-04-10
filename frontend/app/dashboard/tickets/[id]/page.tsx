'use client'

import { useEffect, useState, use, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  Ticket,
  User,
  Mail,
  Calendar,
  Clock,
  AlertTriangle,
  Save,
  MessageSquarePlus,
} from 'lucide-react'
import Link from 'next/link'
import { formatStatusLabel, formatCategoryLabel } from '@/lib/format'
import { unwrapN8nEntity } from '@/lib/n8n-entity'
import { formatDate } from '@/lib/date-utils'
import { createClient } from '@/lib/supabase/client'
import { toErrorMessage } from '@/lib/error-message'
import {
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
} from '@/lib/ticket-fields'

type Role = 'admin' | 'agent' | 'customer'

type CommentRow = {
  id: string
  content: string
  created_at?: string
  comment_type?: string
}

type AgentOption = { id: string; full_name?: string; email?: string }

type TicketDetail = Record<string, unknown> & {
  id: string
  ticket_number?: number
  customer_name?: string | null
  customer_email?: string | null
  subject?: string
  description?: string
  status?: string
  priority?: string
  category?: string | null
  assigned_to?: string | null
  resolution_notes?: string | null
  created_at?: string
  updated_at?: string
  sla_due_at?: string | null
  sla_breached?: boolean
  comments?: CommentRow[]
}

function rowFromApiData(data: unknown): TicketDetail | null {
  const row = unwrapN8nEntity(data) as TicketDetail | null
  if (!row?.id) return null
  return row
}

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<Role>('customer')
  const [userId, setUserId] = useState('')
  const [agents, setAgents] = useState<AgentOption[]>([])

  const [editStatus, setEditStatus] = useState('')
  const [editPriority, setEditPriority] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editAssignedTo, setEditAssignedTo] = useState<string>('')
  const [editResolutionNotes, setEditResolutionNotes] = useState('')
  const [editSubject, setEditSubject] = useState('')
  const [savingProps, setSavingProps] = useState(false)
  const [propsSavedMsg, setPropsSavedMsg] = useState<string | null>(null)

  const [commentBody, setCommentBody] = useState('')
  const [commentType, setCommentType] = useState<'internal' | 'customer_reply'>('internal')
  const [postingComment, setPostingComment] = useState(false)

  const loadTicket = useCallback(async () => {
    setLoading(true)
    setError(null)
    setPropsSavedMsg(null)
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(id)}`)
      const json = await res.json()
      if (res.status === 401) {
        setError('Sign in to view this ticket.')
        setTicket(null)
        return
      }
      if (res.status === 403) {
        setError('You do not have access to this ticket.')
        setTicket(null)
        return
      }
      if (!json.success || json.data == null) {
        setError('Ticket not found or API unavailable')
        setTicket(null)
        return
      }
      const row = rowFromApiData(json.data)
      if (!row) {
        setError('Ticket not found')
        setTicket(null)
        return
      }
      setTicket(row)
      setEditStatus(row.status || 'open')
      setEditPriority(row.priority || 'normal')
      setEditCategory(row.category || '')
      setEditAssignedTo(row.assigned_to || '')
      setEditResolutionNotes(typeof row.resolution_notes === 'string' ? row.resolution_notes : '')
      setEditSubject(row.subject || '')
    } catch {
      setError('Failed to load ticket')
      setTicket(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void loadTicket()
  }, [loadTicket])

  useEffect(() => {
    let cancelled = false
    async function loadRoleAndAgents() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user || cancelled) return
        setUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
        const r: Role = profile?.role === 'admin' ? 'admin' : profile?.role === 'agent' ? 'agent' : 'customer'
        if (cancelled) return
        setRole(r)
        if (r === 'admin' || r === 'agent') {
          const res = await fetch('/api/support-agents')
          const json = await res.json()
          if (!cancelled && json.success && Array.isArray(json.data?.data)) {
            setAgents(json.data.data as AgentOption[])
          }
        }
      } catch {
        if (!cancelled) setRole('customer')
      }
    }
    void loadRoleAndAgents()
    return () => {
      cancelled = true
    }
  }, [])

  const staffCanEdit =
    ticket &&
    (role === 'admin' || (role === 'agent' && String(ticket.assigned_to || '') === userId))

  const selectClass =
    'w-full h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40'

  const saveProperties = async () => {
    if (!ticket || !staffCanEdit || savingProps) return
    setSavingProps(true)
    setPropsSavedMsg(null)
    try {
      const body: Record<string, unknown> = {
        status: editStatus,
        priority: editPriority,
        category: editCategory || null,
        assigned_to: editAssignedTo || null,
        resolution_notes: editResolutionNotes,
        subject: editSubject.trim() || ticket.subject,
      }
      const res = await fetch(`/api/tickets/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(toErrorMessage(json.error ?? json) || 'Update failed')
        return
      }
      setError(null)
      setPropsSavedMsg('Ticket updated.')
      await loadTicket()
    } catch {
      setError('Failed to save changes')
    } finally {
      setSavingProps(false)
    }
  }

  const postComment = async () => {
    const trimmed = commentBody.trim()
    if (!trimmed || postingComment || !ticket) return
    setPostingComment(true)
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(id)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          ...(role !== 'customer' ? { comment_type: commentType } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(toErrorMessage(json.error ?? json) || 'Could not post comment')
        return
      }
      setError(null)
      setCommentBody('')
      await loadTicket()
    } catch {
      setError('Failed to post comment')
    } finally {
      setPostingComment(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <p className="text-destructive">{error || 'Not found'}</p>
        <Link href="/dashboard/tickets">
          <Button variant="outline">Back to tickets</Button>
        </Link>
      </div>
    )
  }

  const title =
    ticket.ticket_number != null
      ? `Ticket #${ticket.ticket_number}`
      : `Ticket ${(typeof ticket.id === 'string' ? ticket.id : id).slice(0, 8)}`

  const comments = Array.isArray(ticket.comments) ? ticket.comments : []

  const assigneeLabel = (aid: string | null | undefined) => {
    if (!aid) return 'Unassigned'
    const a = agents.find((x) => x.id === aid)
    return a?.full_name?.trim() || a?.email || aid.slice(0, 8)
  }

  return (
    <div className="min-h-full bg-muted/30">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/tickets">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Tickets
            </Button>
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="h-1 bg-primary" />
          <div className="p-6 md:p-8 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-2 text-primary">
                  <Ticket className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-semibold uppercase tracking-wide">{title}</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
                  {ticket.subject || 'No subject'}
                </h1>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium capitalize">
                  {ticket.status ? formatStatusLabel(ticket.status) : '-'}
                </span>
                <span className="inline-flex items-center rounded-full bg-secondary/15 text-secondary px-3 py-1 text-xs font-medium capitalize border border-secondary/20">
                  {ticket.priority || 'normal'}
                </span>
                {ticket.sla_breached ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 text-destructive px-3 py-1 text-xs font-medium border border-destructive/20">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    SLA breached
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-border bg-muted/40 p-4 md:p-5">
              <div className="flex gap-3">
                <User className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer</p>
                  <p className="font-medium text-foreground">{ticket.customer_name || '-'}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Mail className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</p>
                  <p className="font-medium text-foreground break-all">{ticket.customer_email || '-'}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Calendar className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Created</p>
                  <p className="font-medium text-foreground">
                    {ticket.created_at ? formatDate(String(ticket.created_at)) : '-'}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Updated</p>
                  <p className="font-medium text-foreground">
                    {ticket.updated_at ? formatDate(String(ticket.updated_at)) : '-'}
                  </p>
                </div>
              </div>
              {(role === 'admin' || role === 'agent') && (
                <>
                  <div className="flex gap-3 sm:col-span-2">
                    <Ticket className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</p>
                      <p className="font-medium text-foreground">{formatCategoryLabel(ticket.category)}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 sm:col-span-2">
                    <User className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assignee</p>
                      <p className="font-medium text-foreground">{assigneeLabel(ticket.assigned_to)}</p>
                    </div>
                  </div>
                  {ticket.sla_due_at ? (
                    <div className="flex gap-3 sm:col-span-2">
                      <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">SLA due</p>
                        <p className="font-medium text-foreground">{formatDate(String(ticket.sla_due_at))}</p>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2">Description</h2>
              <div className="rounded-lg border border-border bg-background/80 p-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {ticket.description || '-'}
              </div>
            </div>
          </div>
        </div>

        {staffCanEdit && (
          <Card className="border-border shadow-sm overflow-hidden border-l-4 border-l-primary">
            <div className="h-0.5 bg-primary/30" />
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Ticket className="w-5 h-5 text-primary" />
                Ticket properties
              </CardTitle>
              <p className="text-sm text-muted-foreground font-normal">
                Status, priority, routing, and resolution — same fields your agents use in a full helpdesk.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
                  <select
                    className={selectClass}
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                  >
                    {TICKET_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {formatStatusLabel(s)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Priority</label>
                  <select
                    className={selectClass}
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                  >
                    {TICKET_PRIORITIES.map((p) => (
                      <option key={p} value={p} className="capitalize">
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</label>
                  <select
                    className={selectClass}
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                  >
                    <option value="">— None —</option>
                    {TICKET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {formatCategoryLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assigned to</label>
                  <select
                    className={selectClass}
                    value={editAssignedTo}
                    onChange={(e) => setEditAssignedTo(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.full_name?.trim() || a.email || a.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subject</label>
                  <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} className="bg-background" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Resolution notes
                  </label>
                  <Textarea
                    value={editResolutionNotes}
                    onChange={(e) => setEditResolutionNotes(e.target.value)}
                    rows={4}
                    className="bg-background resize-y min-h-[100px]"
                    placeholder="Internal resolution summary, next steps, or handoff context…"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() => void saveProperties()}
                  disabled={savingProps}
                  className="bg-primary text-primary-foreground"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {savingProps ? 'Saving…' : 'Save properties'}
                </Button>
                {propsSavedMsg ? (
                  <span className="text-sm text-muted-foreground">{propsSavedMsg}</span>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-border shadow-sm overflow-hidden">
          <div className="h-0.5 bg-secondary/60" />
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquarePlus className="w-5 h-5 text-secondary" />
              Conversation
            </CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              {role === 'customer'
                ? 'Replies you post here are visible to support.'
                : 'Internal notes stay in-house; public replies are visible to the customer.'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              {role !== 'customer' && (
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="ctype"
                      checked={commentType === 'internal'}
                      onChange={() => setCommentType('internal')}
                    />
                    Internal note
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="ctype"
                      checked={commentType === 'customer_reply'}
                      onChange={() => setCommentType('customer_reply')}
                    />
                    Public reply to customer
                  </label>
                </div>
              )}
              <Textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                rows={3}
                placeholder={
                  role === 'customer' ? 'Type your message to support…' : 'Add a note or reply…'
                }
                className="bg-background"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void postComment()}
                disabled={postingComment || !commentBody.trim()}
              >
                {postingComment ? 'Posting…' : 'Post'}
              </Button>
            </div>

            {comments.length === 0 && (
              <p className="text-muted-foreground text-sm py-4 text-center border border-dashed border-border rounded-lg">
                No comments yet.
              </p>
            )}
            {comments.map((c) => (
              <div
                key={c.id || `${c.created_at}-${c.content?.slice(0, 12)}`}
                className="rounded-lg border border-border bg-card p-4 shadow-sm hover:border-primary/20 transition-colors"
              >
                <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">{c.content}</p>
                <p className="text-xs text-muted-foreground mt-3 flex flex-wrap gap-x-2">
                  <span
                    className={`capitalize font-medium ${
                      c.comment_type === 'internal' ? 'text-amber-700 dark:text-amber-400' : 'text-secondary'
                    }`}
                  >
                    {c.comment_type?.replace(/_/g, ' ') || 'comment'}
                  </span>
                  {c.created_at ? <span>· {new Date(c.created_at).toLocaleString()}</span> : null}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
