import { Suspense } from 'react'
import LoginForm from './login-form'

function LoginFallback() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <p className="text-muted-foreground">Loading…</p>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  )
}
