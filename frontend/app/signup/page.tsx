'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { BrandLogo } from '@/components/brand-logo'

type Tab = 'customer' | 'agent'

export default function SignupPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('customer')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          role: tab,
          inviteCode: tab === 'agent' ? inviteCode : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(typeof data.error === 'string' ? data.error : 'Signup failed')
        return
      }

      const supabase = createClient()
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signErr) {
        setError(signErr.message)
        return
      }

      router.replace('/')
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background flex items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -top-24 left-1/4 h-80 w-80 -translate-x-1/2 rounded-full bg-secondary/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <Card className="w-full max-w-md overflow-hidden border border-border/80 bg-card shadow-lg shadow-primary/5">
        <CardHeader className="space-y-4 border-b border-border bg-gradient-to-br from-card via-accent/30 to-muted/40 pb-6 pt-8">
          <div className="flex justify-center">
            <BrandLogo href="/" variant="auth" />
          </div>
          <div className="text-center">
            <CardTitle className="text-xl font-semibold tracking-tight text-foreground">Create account</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Join as a customer or invited agent</p>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="flex rounded-lg border border-border bg-muted/50 p-1">
            <button
              type="button"
              className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-colors ${
                tab === 'customer'
                  ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setTab('customer')}
            >
              Customer
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-colors ${
                tab === 'agent'
                  ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setTab('agent')}
            >
              Agent
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Full name</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="border-border bg-card" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-border bg-card"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password (min 8 characters)</label>
              <Input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="border-border bg-card"
              />
            </div>
            {tab === 'agent' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Agent invite code</label>
                <Input
                  type="password"
                  autoComplete="off"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  required
                  className="border-border bg-card"
                  placeholder="From your administrator"
                />
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground">
              {loading ? 'Creating…' : 'Create account'}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
            <Link href="/voice">
              <Button type="button" variant="outline" className="w-full border-primary text-primary">
                Continue as guest
              </Button>
            </Link>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
