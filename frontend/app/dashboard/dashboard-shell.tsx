'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/brand-logo'
import {
  BarChart3,
  Users,
  Ticket,
  Settings,
  LogOut,
  Menu,
  X,
  Home,
  HeadsetIcon,
  User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  children: React.ReactNode
  isAdmin: boolean
  /** Customers list: admins and agents */
  showCustomersNav: boolean
  role: 'admin' | 'agent' | 'customer'
  userId: string
  userEmail: string
  displayName: string
}

export default function DashboardShell({
  children,
  isAdmin,
  showCustomersNav,
  role,
  userId,
  userEmail,
  displayName,
}: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const profileHref = role === 'customer'
    ? '/dashboard/profile'
    : isAdmin
      ? '/dashboard/support-agents'
      : `/dashboard/support-agents/${userId}`
  const profileIcon = role === 'customer' ? User : HeadsetIcon
  const profileLabel = role === 'admin' ? 'Support agents' : 'My profile'

  const navItems = [
    { href: '/dashboard', icon: BarChart3, label: 'Dashboard', exact: true },
    { href: '/dashboard/tickets', icon: Ticket, label: 'Tickets' },
    ...(showCustomersNav ? [{ href: '/dashboard/customers', icon: Users, label: 'Customers' as const }] : []),
    { href: profileHref, icon: profileIcon, label: profileLabel },
    ...(isAdmin ? [{ href: '/dashboard/settings', icon: Settings, label: 'Settings' as const }] : []),
  ]

  const isActive = (href: string, exact: boolean = false) => {
    if (exact) return pathname === href
    if (href.includes('/support-agents') && pathname.startsWith('/dashboard/support-agents')) {
      return pathname === href || pathname.startsWith(href + '/')
    }
    return pathname.startsWith(href)
  }

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/90">
        <BrandLogo href="/" variant="compact" aria-label="RelayPay home" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-foreground hover:bg-muted"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      <div className="flex">
        <aside
          className={`${
            sidebarOpen ? 'block' : 'hidden'
          } md:block w-full md:w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border min-h-screen md:sticky md:top-0 z-20 relative`}
        >
          <div className="hidden md:flex items-center gap-3 border-b border-sidebar-border p-6">
            <BrandLogo href="/" variant="nav" aria-label="RelayPay home" />
          </div>
          <p className="px-4 pt-4 text-xs text-muted-foreground truncate" title={userEmail}>
            {displayName}
          </p>
          <nav className="p-4 space-y-3">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href, item.exact)
              return (
                <Link key={item.href + item.label} href={item.href}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start gap-2 ${
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/20'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                </Link>
              )
            })}
          </nav>

          <div className="md:absolute md:bottom-0 left-0 right-0 p-4 border-t border-sidebar-border space-y-3 mt-8 md:mt-0">
            <Link href="/voice">
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent/20"
              >
                <Home className="w-4 h-4" />
                Voice support
              </Button>
            </Link>
            <Button
              variant="ghost"
              type="button"
              onClick={() => void logout()}
              className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </Button>
          </div>
        </aside>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
