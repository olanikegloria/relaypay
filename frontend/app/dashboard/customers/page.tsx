'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { Search, Mail, Plus } from 'lucide-react'
import { formatDate } from '@/lib/date-utils'
import { createClient } from '@/lib/supabase/client'
import { toErrorMessage } from '@/lib/error-message'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

/** Normalized row for cards — WF12 list returns customer_name/customer_email/tier/status; profiles may return id/email/full_name/role. */
type CustomerCardRow = {
  listKey: string
  email: string | null
  full_name: string | null
  role: string | null
  created_at: string | null
  tier: number | null
  status: string | null
}

function normalizeCustomersFromApi(raw: unknown[]): CustomerCardRow[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item, index) => {
    const o = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const emailRaw =
      typeof o.customer_email === 'string'
        ? o.customer_email
        : typeof o.email === 'string'
          ? o.email
          : ''
    const email = emailRaw.trim() || null
    const full_name =
      typeof o.customer_name === 'string'
        ? o.customer_name
        : typeof o.full_name === 'string'
          ? o.full_name
          : null
    const role = typeof o.role === 'string' ? o.role : null
    const created_at = typeof o.created_at === 'string' ? o.created_at : null
    const status = typeof o.status === 'string' ? o.status : null
    let tier: number | null = null
    if (typeof o.tier === 'number' && Number.isFinite(o.tier)) tier = o.tier
    else if (typeof o.tier === 'string' && o.tier.trim()) {
      const n = parseInt(o.tier, 10)
      if (Number.isFinite(n)) tier = n
    }
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : ''
    const sessionId = typeof o.session_id === 'string' ? o.session_id : ''
    const listKey =
      id ||
      [email ?? 'no-email', created_at ?? 'no-date', sessionId, String(index)].filter(Boolean).join('::')

    return {
      listKey,
      email,
      full_name,
      role,
      created_at,
      tier,
      status,
    }
  })
}

function initials(name: string | null | undefined, emailOrFallback: string | null | undefined): string {
  if (name?.trim()) {
    const p = name.trim().split(/\s+/)
    return (p[0][0] + (p[1]?.[0] || '')).toUpperCase().slice(0, 2)
  }
  const fb = String(emailOrFallback ?? '').trim() || '?'
  return fb.slice(0, 2).toUpperCase()
}

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<CustomerCardRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newCustomer, setNewCustomer] = useState({
    fullName: '',
    email: '',
    password: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/customers')
      const json = await res.json()
      if (!json.success) {
        setLoadError('Could not load customers')
        setCustomers([])
        return
      }
      const raw = json.data?.data
      const list = Array.isArray(raw) ? raw : []
      setCustomers(normalizeCustomersFromApi(list))
    } catch {
      setLoadError('Network error')
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    async function loadRole() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user || cancelled) return
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
        if (!cancelled) setIsAdmin(profile?.role === 'admin')
      } catch {
        if (!cancelled) setIsAdmin(false)
      }
    }
    void loadRole()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = customers.filter((c) => {
    const q = searchTerm.toLowerCase().trim()
    if (!q) return true
    const email = (c.email || '').toLowerCase()
    const name = (c.full_name || '').toLowerCase()
    const st = (c.status || '').toLowerCase()
    const tierStr = c.tier != null ? String(c.tier) : ''
    return email.includes(q) || name.includes(q) || st.includes(q) || tierStr.includes(q)
  })

  const handleCardClick = (email: string | null | undefined) => {
    const e = email?.trim()
    if (!e) return
    router.push(`/dashboard/customers/${encodeURIComponent(e)}`)
  }

  const handleCreateCustomer = async () => {
    if (!newCustomer.email.trim() || !newCustomer.password || newCustomer.password.length < 8) {
      setLoadError('Provide email and password (min 8 characters)')
      return
    }
    setCreating(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newCustomer.email.trim(),
          password: newCustomer.password,
          fullName: newCustomer.fullName.trim(),
          role: 'customer',
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setLoadError(toErrorMessage(json.error ?? json) || 'Could not create customer')
        return
      }
      setShowCreateDialog(false)
      setNewCustomer({ fullName: '', email: '', password: '' })
      await load()
    } catch {
      setLoadError('Could not create customer')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Customers</h1>
          <p className="mt-1 text-muted-foreground">Customer profiles and account overview.</p>
        </div>
        {isAdmin ? (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 md:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                New customer
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create customer</DialogTitle>
                <DialogDescription>Create a customer auth account in Supabase.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Full name (optional)</label>
                  <Input
                    value={newCustomer.fullName}
                    onChange={(e) => setNewCustomer((p) => ({ ...p, fullName: e.target.value }))}
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer((p) => ({ ...p, email: e.target.value }))}
                    placeholder="jane@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Temporary password</label>
                  <Input
                    type="password"
                    value={newCustomer.password}
                    onChange={(e) => setNewCustomer((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Minimum 8 characters"
                  />
                </div>
                <Button
                  type="button"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={creating}
                  onClick={() => void handleCreateCustomer()}
                >
                  {creating ? 'Creating...' : 'Create customer'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {loadError && (
        <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError}
        </p>
      )}

      <Card className="border-border">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-border bg-card pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((customer) => {
            const emailOk = Boolean(customer.email?.trim())
            return (
            <Card
              key={customer.listKey}
              className={`h-full border-border transition ${emailOk ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}`}
              onClick={() => emailOk && handleCardClick(customer.email)}
            >
              <CardHeader>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {initials(customer.full_name, customer.email)}
                  </div>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium capitalize text-muted-foreground">
                    {customer.role
                      ? customer.role
                      : customer.tier != null
                        ? `Tier ${customer.tier}`
                        : customer.status
                          ? customer.status.replace(/_/g, ' ')
                          : 'Customer'}
                  </span>
                </div>
                <CardTitle className="text-lg">{customer.full_name || '-'}</CardTitle>
                <p className="text-sm text-muted-foreground">{customer.email?.trim() || 'No email on file'}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 border-t border-border pt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 shrink-0 text-primary" />
                    {emailOk ? (
                      <Link
                        href={`mailto:${customer.email}`}
                        className="truncate hover:text-secondary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {customer.email}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground">Joined {customer.created_at ? formatDate(customer.created_at) : '-'}</p>
                </div>
              </CardContent>
            </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
