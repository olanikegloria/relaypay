'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Plus, Search, CheckCircle, Clock } from 'lucide-react'

type AgentRow = {
  id: string
  full_name?: string
  email?: string
  role?: string
  online_status?: string
  tickets_resolved?: number
  tickets_assigned?: number
  avg_resolution_hours?: number | null
  created_at?: string
}

function initials(name: string | undefined, email: string | undefined): string {
  if (name?.trim()) {
    const p = name.trim().split(/\s+/)
    return (p[0][0] + (p[1]?.[0] || '')).toUpperCase().slice(0, 2)
  }
  return (email || '?').slice(0, 2).toUpperCase()
}

export default function SupportAgentsList() {
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [newAgent, setNewAgent] = useState({ name: '', email: '', role: 'agent' })
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/support-agents')
      const json = await res.json()
      if (!json.success || !json.data?.data) {
        setLoadError('Could not load agents')
        setAgents([])
        return
      }
      setAgents(Array.isArray(json.data.data) ? json.data.data : [])
    } catch {
      setLoadError('Network error')
      setAgents([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      (agent.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (agent.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    const st = agent.online_status || 'offline'
    const matchesStatus = statusFilter === 'all' || st === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/support-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAgent.name,
          email: newAgent.email,
          role: newAgent.role,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        setLoadError('Create agent failed (requires auth user id in Supabase)')
        return
      }
      setNewAgent({ name: '', email: '', role: 'agent' })
      setIsDialogOpen(false)
      await load()
    } catch {
      setLoadError('Create failed')
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Support agents</h1>
          <p className="text-muted-foreground mt-1">Team directory from support_agents</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground w-full md:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add agent
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New agent</DialogTitle>
              <DialogDescription>
                WF11 create expects a matching auth.users id. In production, provision the user first.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateAgent} className="space-y-4">
              <Input
                placeholder="Full name"
                value={newAgent.name}
                onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                required
              />
              <Input
                type="email"
                placeholder="Email"
                value={newAgent.email}
                onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })}
                required
              />
              <select
                value={newAgent.role}
                onChange={(e) => setNewAgent({ ...newAgent, role: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card"
              >
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
                <option value="supervisor">Supervisor</option>
              </select>
              <Button type="submit" className="w-full bg-primary text-primary-foreground">
                Submit
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loadError && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {loadError}
        </p>
      )}

      <Card className="border-border">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search agents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-border bg-card"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-card"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="offline">Offline</option>
              <option value="on-break">On break</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredAgents.map((agent) => (
            <Card key={agent.id} className="border-border hover:shadow-md transition">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      {initials(agent.full_name, agent.email)}
                    </div>
                    <div>
                      <CardTitle className="text-xl">{agent.full_name || '-'}</CardTitle>
                      <p className="text-sm text-muted-foreground">{agent.email}</p>
                      <p className="text-xs text-secondary mt-1 capitalize">{agent.role || 'agent'}</p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${
                      agent.online_status === 'active'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {agent.online_status || 'offline'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-secondary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Resolved</p>
                      <p className="font-semibold">{agent.tickets_resolved ?? 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-secondary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Avg hours</p>
                      <p className="font-semibold">
                        {agent.avg_resolution_hours != null ? agent.avg_resolution_hours.toFixed(1) : '-'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground">
                    Open assignments: {agent.tickets_assigned ?? 0}
                  </p>
                  <Link href={`/dashboard/support-agents/${agent.id}`}>
                    <Button size="sm" variant="outline" className="border-primary text-primary">
                      View
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
