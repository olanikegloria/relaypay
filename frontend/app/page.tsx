import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/logout-button'
import { BrandLogo } from '@/components/brand-logo'
import { Headphones, LayoutDashboard, MessageSquare, Shield, Sparkles } from 'lucide-react'

export default async function Home() {
  let user: User | null = null
  let role: string | null = null
  let displayName: string | null = null

  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    const {
      data: { user: u },
    } = await supabase.auth.getUser()
    user = u
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .maybeSingle()
      role = profile?.role ?? 'customer'
      displayName = profile?.full_name?.trim() || user.email?.split('@')[0] || 'there'
    }
  }

  const staffRole = role === 'agent' || role === 'admin'

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -top-24 right-0 h-[28rem] w-[28rem] rounded-full bg-secondary/15 blur-3xl" />
        <div className="absolute top-1/3 -left-32 h-[22rem] w-[22rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-accent/40 blur-3xl" />
      </div>

      <header className="sticky top-0 z-20 border-b border-border/80 bg-card/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <BrandLogo href="/" variant="nav" />
          <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="Account">
            {user ? (
              <>
                <span
                  className="hidden max-w-[200px] truncate text-xs text-muted-foreground sm:inline"
                  title={user.email ?? ''}
                >
                  {user.email}
                </span>
                <LogoutButton />
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-foreground">
                    Log in
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="bg-primary text-primary-foreground shadow-sm">
                    Sign up
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {!user ? (
          <>
            <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16 md:pt-20">
              <div className="mx-auto max-w-3xl text-center">
                <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
                  <Sparkles className="h-3.5 w-3.5 text-secondary" aria-hidden />
                  Customer experience platform
                </p>
                <div className="mb-8 flex justify-center">
                  <BrandLogo href={null} variant="hero" />
                </div>
                <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                  Support that feels fast, human, and on-brand
                </h1>
                <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                  RelayPay brings together voice and digital support so your team can resolve issues
                  with clarity, without losing the personal touch customers expect.
                </p>
                <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                  <Link href="/login" className="sm:min-w-[11rem]">
                    <Button
                      size="lg"
                      className="h-12 w-full bg-primary text-primary-foreground shadow-md transition-shadow hover:shadow-lg"
                    >
                      Log in
                    </Button>
                  </Link>
                  <Link href="/signup" className="sm:min-w-[11rem]">
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-12 w-full border-2 border-primary/40 bg-card text-primary hover:bg-accent/50"
                    >
                      Create account
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="mx-auto mt-16 grid max-w-5xl gap-5 sm:grid-cols-3">
                {[
                  {
                    icon: Headphones,
                    title: 'Voice-first support',
                    body: 'Let customers reach you by voice when typing is not enough, without sacrificing ticket quality.',
                  },
                  {
                    icon: Shield,
                    title: 'Structured workflows',
                    body: 'Issues are captured consistently so agents spend less time chasing context.',
                  },
                  {
                    icon: MessageSquare,
                    title: 'Omnichannel-ready',
                    body: 'A single experience layer for conversations that can span voice and text in one session.',
                  },
                ].map(({ icon: Icon, title, body }) => (
                  <div
                    key={title}
                    className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 text-primary transition-colors group-hover:bg-secondary/15 group-hover:text-secondary">
                      <Icon className="h-6 w-6" aria-hidden />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                ))}
              </div>

              <div className="mx-auto mt-14 flex max-w-3xl flex-wrap items-center justify-center gap-x-10 gap-y-6 border-y border-border py-10 text-center">
                {[
                  { k: '24/7', l: 'Always-on routing' },
                  { k: 'Fast', l: 'Low-latency voice' },
                  { k: 'Focused', l: 'Agent-ready UI' },
                ].map(({ k, l }) => (
                  <div key={k} className="min-w-[6rem]">
                    <div className="text-2xl font-bold text-secondary sm:text-3xl">{k}</div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{l}</p>
                  </div>
                ))}
              </div>
            </section>

            <footer className="mt-auto border-t border-border bg-card/50 py-8">
              <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-center text-sm text-muted-foreground sm:flex-row sm:text-left sm:px-6">
                <span>© {new Date().getFullYear()} RelayPay. All rights reserved.</span>
                <span className="text-xs">Built for teams who care about customer trust.</span>
              </div>
            </footer>
          </>
        ) : (
          <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="text-center">
              <p className="text-sm font-medium text-secondary">Welcome back</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Hi, {displayName}
              </h1>
              <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                Choose where to go next. You can open your workspace, start a support call, or sign out
                when you are done.
              </p>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              <Link
                href="/dashboard"
                className="group block rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/25 hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-inner">
                  <LayoutDashboard className="h-6 w-6" aria-hidden />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-foreground group-hover:text-primary">
                  {staffRole ? 'Staff workspace' : 'My dashboard'}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {staffRole
                    ? 'Tickets, customers, and team tools for agents and administrators.'
                    : 'Track your own tickets and profile in one place.'}
                </p>
                <span className="mt-4 inline-flex text-sm font-medium text-secondary">
                  Open dashboard →
                </span>
              </Link>

              <Link
                href="/voice"
                className="group block rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-secondary/30 hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <Headphones className="h-6 w-6" aria-hidden />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-foreground group-hover:text-secondary">
                  Customer voice support
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Start a live voice session with RelayPay support, ideal for customers and demos.
                </p>
                <span className="mt-4 inline-flex text-sm font-medium text-secondary">
                  Start support call →
                </span>
              </Link>
            </div>

            <div className="mt-10 flex justify-center">
              <LogoutButton variant="outline" size="lg" className="min-w-[200px]" />
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
