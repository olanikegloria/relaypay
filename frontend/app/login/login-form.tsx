'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { BrandLogo } from '@/components/brand-logo'

function safeInternalPath(next: string | null): string | null {
  const t = next?.trim() ?? ''
  if (!t.startsWith('/') || t.startsWith('//')) return null
  if (!t.startsWith('/dashboard') && !t.startsWith('/voice')) return null
  return t
}

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? ''

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const redirectAfterLogin = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/login')
      return
    }
    const fromQuery = safeInternalPath(next)
    router.replace(fromQuery ?? '/')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { error: signErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (signErr) {
        setError(signErr.message)
        return
      }
      await redirectAfterLogin()
    } catch {
      setError('Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background flex items-center justify-center px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
      >
        <div className="absolute -top-20 right-0 h-72 w-72 rounded-full bg-secondary/12 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-primary/8 blur-3xl" />
      </div>
      <Card className="w-full max-w-md overflow-hidden border border-border/80 bg-card shadow-lg shadow-primary/5">
        <CardHeader className="space-y-4 border-b border-border bg-gradient-to-br from-card via-accent/30 to-muted/40 pb-6 pt-8">
          <div className="flex justify-center">
            <BrandLogo href="/" variant="auth" />
          </div>
          <div className="text-center">
            <CardTitle className="text-xl font-semibold tracking-tight text-foreground">Sign in</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Access your RelayPay account</p>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}
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
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-border bg-card"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              No account?{' '}
              <Link href="/signup" className="text-primary font-medium hover:underline">
                Sign up
              </Link>
            </p>
            <Link href="/voice">
              <Button type="button" variant="outline" className="w-full border-primary text-primary">
                Continue as guest (voice only)
              </Button>
            </Link>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
