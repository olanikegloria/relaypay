'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'
import { Send, MessageSquare, ArrowLeft, Phone, PhoneOff, User } from 'lucide-react'
import { toErrorMessage } from '@/lib/error-message'
import { isBenignVoiceSdkMessage } from '@/lib/voice-sdk-errors'

export type VoiceAccountPrefill = { displayName: string; email: string }

type Props = { accountPrefill: VoiceAccountPrefill | null }

interface Message {
  id: string
  type: 'user' | 'agent'
  text: string
  timestamp: Date
  viaText?: boolean
}

const CALL_ID_KEY = 'relaypay_vapi_call_id'
const SESSION_ID_KEY = 'relaypay_session_id'
const CUSTOMER_TOKEN_KEY = 'relaypay_customer_token'

type PreCallPayload = {
  session_id: string
  vapi_assistant_id: string
  customer_token: string
}

type IntroMode = 'guest_form' | 'account_ready' | null

function parsePreCallData(raw: unknown): PreCallPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const inner =
    o.data && typeof o.data === 'object' ? (o.data as Record<string, unknown>) : o
  if (inner.ok === false || inner.pre_call_error) return null
  const session_id = String(inner.session_id ?? inner.sessionId ?? '').trim()
  const vapi_assistant_id = String(
    inner.vapi_assistant_id ?? inner.vapiAssistantId ?? inner.assistantId ?? ''
  ).trim()
  const customer_token = String(inner.customer_token ?? inner.customerToken ?? '').trim()
  if (!session_id || !customer_token) return null
  return { session_id, vapi_assistant_id, customer_token }
}

function vapiEventToMessage(err: unknown): string {
  if (err == null) return 'Unknown error'
  if (typeof err === 'string') return err
  if (typeof err !== 'object') return String(err)
  const e = err as Record<string, unknown>
  const nested = e.error
  if (nested && typeof nested === 'object') {
    const n = nested as Record<string, unknown>
    if (typeof n.message === 'string') return n.message
    if (typeof n.msg === 'string') return n.msg
  }
  if (typeof e.message === 'string') return e.message
  if (typeof e.msg === 'string') return e.msg
  return toErrorMessage(err)
}

export function VoiceClient({ accountPrefill }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [customerName, setCustomerName] = useState(() => accountPrefill?.displayName ?? '')
  const [customerEmail, setCustomerEmail] = useState(() => accountPrefill?.email ?? '')
  const [intro, setIntro] = useState<IntroMode>(() => (accountPrefill ? 'account_ready' : 'guest_form'))
  const [preCallLoading, setPreCallLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [callActive, setCallActive] = useState(false)
  const [vapiCallId, setVapiCallId] = useState<string | null>(null)
  const [backendError, setBackendError] = useState<string | null>(null)
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null)
  const [callSeconds, setCallSeconds] = useState(0)
  const [postCallSummary, setPostCallSummary] = useState<string | null>(null)

  const vapiRef = useRef<InstanceType<typeof import('@vapi-ai/web').default> | null>(null)
  const bindDoneRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const existing = sessionStorage.getItem(CALL_ID_KEY)
    if (existing) setVapiCallId(existing)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onRejection = (e: PromiseRejectionEvent) => {
      const msg =
        typeof e.reason === 'string' ? e.reason : vapiEventToMessage(e.reason)
      if (isBenignVoiceSdkMessage(msg)) {
        e.preventDefault()
      }
    }
    window.addEventListener('unhandledrejection', onRejection)
    return () => window.removeEventListener('unhandledrejection', onRejection)
  }, [])

  useEffect(() => {
    if (!callStartedAt) return
    const id = window.setInterval(() => {
      setCallSeconds(Math.floor((Date.now() - callStartedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [callStartedAt])

  const getPublicKey = () =>
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY?.trim() ?? '' : ''

  const getFallbackAssistantId = () =>
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID?.trim() ?? '' : ''

  const sendToAgent = async (text: string, source: 'voice' | 'text' = 'text') => {
    const trimmed = text.trim()
    if (!trimmed) return

    const callId = vapiCallId || sessionStorage.getItem(CALL_ID_KEY)
    if (!callId) {
      setBackendError('Start a voice call first, or wait until the call is connected.')
      return
    }

    setIsSending(true)
    setBackendError(null)

    if (source === 'text') {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: 'user',
          text: trimmed,
          timestamp: new Date(),
          viaText: true,
        },
      ])
    }

    try {
      const res = await fetch('/api/voice/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          callId,
          customerName: customerName.trim() || 'Voice Customer',
          customerEmail: customerEmail.trim() || '',
          relaypaySessionId:
            typeof window !== 'undefined'
              ? sessionStorage.getItem(SESSION_ID_KEY) || undefined
              : undefined,
        }),
      })
      const payload = await res.json()

      if (!res.ok || !payload.success) {
        setBackendError(toErrorMessage(payload.error ?? payload))
        const fallback =
          'Sorry, we could not reach support right now. Please try again in a moment or call back later.'
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), type: 'agent', text: fallback, timestamp: new Date() },
        ])
        return
      }

      if (payload.callId && payload.callId !== callId) {
        sessionStorage.setItem(CALL_ID_KEY, payload.callId)
        setVapiCallId(payload.callId)
      }

      const replyText = typeof payload.data?.output === 'string' ? payload.data.output : 'No response received.'
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), type: 'agent', text: replyText, timestamp: new Date(), viaText: true },
      ])
      // Speak the reply. If VAPI call is active use vapi.say() so ElevenLabs reads it
      // (same voice as the live call). Fall back to browser TTS when no call is running.
      const vapi = vapiRef.current
      if (callActive && vapi) {
        try {
          vapi.say(replyText, false)
        } catch {
          window.speechSynthesis?.cancel()
          window.speechSynthesis?.speak(new SpeechSynthesisUtterance(replyText))
        }
      } else {
        window.speechSynthesis?.cancel()
        window.speechSynthesis?.speak(new SpeechSynthesisUtterance(replyText))
      }
    } catch {
      setBackendError('Network error')
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), type: 'agent', text: 'A network error occurred.', timestamp: new Date() },
      ])
    } finally {
      setIsSending(false)
    }
  }

  const pollSessionOutcome = useCallback(async (callId: string) => {
    let tries = 0
    const run = async () => {
      try {
        const res = await fetch(`/api/voice/session-status?vapi_call_id=${encodeURIComponent(callId)}`)
        const data = await res.json()
        if (data?.found && typeof data.summary === 'string' && data.summary.trim()) {
          setPostCallSummary(data.summary.trim())
          return
        }
        if (data?.found && data.status === 'completed') {
          setPostCallSummary('Your session is complete. Thank you for contacting RelayPay.')
          return
        }
      } catch {
        /* ignore */
      }
      tries += 1
      if (tries < 8) window.setTimeout(run, 2000)
    }
    window.setTimeout(run, 1500)
  }, [])

  const bindSession = async (sessionId: string, realCallId: string, customerToken: string) => {
    const res = await fetch('/api/voice/session-bind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        vapi_call_id: realCallId,
        customer_token: customerToken,
      }),
    })
    const json = await res.json()
    if (!res.ok || !json.success) {
      throw new Error(toErrorMessage(json.error ?? json))
    }
    sessionStorage.setItem(CALL_ID_KEY, realCallId)
    sessionStorage.setItem(SESSION_ID_KEY, sessionId)
    sessionStorage.setItem(CUSTOMER_TOKEN_KEY, customerToken)
    setVapiCallId(realCallId)
  }

  const stopVapiCall = async () => {
    const vapi = vapiRef.current
    if (!vapi) return
    try {
      await vapi.stop()
    } catch {
      /* ignore */
    }
    setCallActive(false)
    setConnecting(false)
    const id = sessionStorage.getItem(CALL_ID_KEY)
    if (id) void pollSessionOutcome(id)
  }

  const startVapiSession = async (pc: PreCallPayload, displayName: string, email: string) => {
    const pub = getPublicKey()
    if (!pub) {
      setBackendError('Voice calling is not available in this environment.')
      setConnecting(false)
      return
    }

    const assistantId = pc.vapi_assistant_id || getFallbackAssistantId()
    if (!assistantId) {
      setBackendError(
        'Voice assistant is not configured for this environment. Please contact the site administrator.'
      )
      setConnecting(false)
      return
    }

    bindDoneRef.current = false
    const { default: Vapi } = await import('@vapi-ai/web')
    if (!vapiRef.current) {
      vapiRef.current = new Vapi(pub)
    }
    const vapi = vapiRef.current

    vapi.once('call-end', () => {
      setCallActive(false)
      const id = sessionStorage.getItem(CALL_ID_KEY)
      if (id) void pollSessionOutcome(id)
    })
    vapi.on('error', (err: unknown) => {
      const msg = vapiEventToMessage(err)
      if (isBenignVoiceSdkMessage(msg)) return
      setBackendError(msg)
    })

    const firstMessage = `Hello ${displayName}, you are connected to RelayPay support. How can I help you today?`

    try {
      const call = await vapi.start(assistantId, {
        firstMessage,
        firstMessageMode: 'assistant-speaks-first',
        variableValues: {
          customer_name: displayName,
          customer_email: email,
          relaypay_session_id: pc.session_id,
        },
      })

      const realId = call?.id
      if (realId && !bindDoneRef.current) {
        try {
          await bindSession(pc.session_id, realId, pc.customer_token)
          bindDoneRef.current = true
        } catch (bindErr) {
          try {
            await vapi.stop()
          } catch {
            /* ignore */
          }
          throw bindErr
        }
      }

      setCallActive(true)
      setConnecting(false)
      setCallStartedAt(Date.now())
    } catch (e) {
      setConnecting(false)
      setCallActive(false)
      const msg = toErrorMessage(e)
      if (!isBenignVoiceSdkMessage(msg)) {
        setBackendError(msg)
      }
    }
  }

  const runPreCall = async (name: string, email: string) => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    setBackendError(null)
    setPreCallLoading(true)

    try {
      const res = await fetch('/api/voice/pre-call-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: trimmedName,
          customerEmail: email.trim() || undefined,
        }),
      })
      const json = await res.json()
      const parsed = parsePreCallData(json.success ? json.data ?? json : json)

      if (!res.ok || !json.success || !parsed) {
        const msg = toErrorMessage(json.error).trim()
        setBackendError(
          msg ||
            'We could not start your session. Please check your connection and try again, or contact support if this continues.'
        )
        return
      }

      setIntro(null)
      setConnecting(true)
      await startVapiSession(parsed, trimmedName, email.trim())
    } catch {
      setBackendError('Network error during pre-call.')
    } finally {
      setPreCallLoading(false)
    }
  }

  const handleSubmitGuestForm = async (e: React.FormEvent) => {
    e.preventDefault()
    await runPreCall(customerName, customerEmail)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim() || isSending) return
    const t = inputText
    setInputText('')
    await sendToAgent(t, 'text')
  }

  const resetToIntro = () => {
    bindDoneRef.current = false
    setIntro(accountPrefill ? 'account_ready' : 'guest_form')
    setPostCallSummary(null)
    setCallStartedAt(null)
    setCallSeconds(0)
  }

  const introShell = (children: React.ReactNode) => (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute top-0 right-0 h-72 w-72 rounded-full bg-secondary/12 blur-3xl" />
        <div className="absolute bottom-20 left-0 h-64 w-64 rounded-full bg-primary/8 blur-3xl" />
      </div>
      {children}
    </main>
  )

  if (intro === 'account_ready' && accountPrefill) {
    return introShell(
      <Card className="w-full max-w-md overflow-hidden border border-border/80 bg-card shadow-lg shadow-primary/5">
        <CardHeader className="space-y-4 border-b border-border bg-gradient-to-br from-card via-accent/30 to-muted/40 pb-6 pt-8">
          <div className="flex justify-center">
            <BrandLogo href="/" variant="auth" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2 text-center text-xl font-semibold tracking-tight text-foreground">
            <User className="h-5 w-5 text-secondary" aria-hidden />
            Start your support call
          </CardTitle>
          <p className="text-center text-sm text-muted-foreground">
            You are signed in. We will connect you using your account details below.
          </p>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
            <p className="font-semibold text-foreground">{customerName || accountPrefill.displayName}</p>
            {(customerEmail || accountPrefill.email) ? (
              <p className="mt-1 break-all text-muted-foreground">{customerEmail || accountPrefill.email}</p>
            ) : (
              <p className="mt-1 text-muted-foreground">No email on file</p>
            )}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your voice conversation is private and used only to help resolve your request. You can also send a
            typed message during the call if you prefer.
          </p>
          {backendError && (
            <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {backendError}
            </p>
          )}
          <Button
            type="button"
            disabled={preCallLoading}
            onClick={() => void runPreCall(customerName || accountPrefill.displayName, customerEmail)}
            className="h-11 w-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            {preCallLoading ? 'Preparing…' : 'Start call'}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm font-medium text-secondary hover:underline"
            onClick={() => {
              setBackendError(null)
              setIntro('guest_form')
            }}
          >
            Use a different name or email
          </button>
          <Link href="/">
            <Button type="button" variant="outline" className="h-11 w-full border-primary/40 text-primary hover:bg-accent/50">
              Back to home
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  if (intro === 'guest_form') {
    return introShell(
      <Card className="w-full max-w-md overflow-hidden border border-border/80 bg-card shadow-lg shadow-primary/5">
        <CardHeader className="space-y-4 border-b border-border bg-gradient-to-br from-card via-accent/30 to-muted/40 pb-6 pt-8">
          <div className="flex justify-center">
            <BrandLogo href="/" variant="auth" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2 text-center text-xl font-semibold tracking-tight text-foreground">
            <MessageSquare className="h-5 w-5 text-secondary" aria-hidden />
            Join support call
          </CardTitle>
          <p className="text-center text-sm text-muted-foreground">
            Enter your details and we will connect you with the next available assistant.
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmitGuestForm} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Your name</label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter your name"
                className="border-border bg-background"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Email (optional)</label>
              <Input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="you@company.com"
                className="border-border bg-background"
                autoComplete="email"
              />
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your voice conversation is private and used only to help resolve your request. You can also send a
              typed message during the call if you prefer.
            </p>
            {backendError && (
              <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {backendError}
              </p>
            )}
            <Button
              type="submit"
              disabled={preCallLoading}
              className="h-11 w-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              {preCallLoading ? 'Preparing…' : 'Start call'}
            </Button>
            {accountPrefill ? (
              <button
                type="button"
                className="w-full text-center text-sm font-medium text-secondary hover:underline"
                onClick={() => {
                  setBackendError(null)
                  setCustomerName(accountPrefill.displayName)
                  setCustomerEmail(accountPrefill.email)
                  setIntro('account_ready')
                }}
              >
                Back to signed-in start
              </button>
            ) : null}
            <Link href="/">
              <Button type="button" variant="outline" className="h-11 w-full border-primary/40 text-primary hover:bg-accent/50">
                Back to home
              </Button>
            </Link>
          </form>
        </CardContent>
      </Card>
    )
  }

  const mins = Math.floor(callSeconds / 60)
  const secs = callSeconds % 60
  const callTimer = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  const chatMessages = messages.filter((m) => m.viaText)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="shrink-0 text-foreground hover:bg-muted">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <div className="hidden min-w-0 sm:block">
              <BrandLogo href={null} variant="compact" />
            </div>
          </div>
          <div className="whitespace-nowrap rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            Voice call
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden">
        <div className="p-4">
          <Card className="overflow-hidden border-border/80 bg-card shadow-md">
            <CardContent className="pt-8 pb-6">
              <div className="flex flex-col items-center space-y-5 text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-secondary/20 text-2xl font-bold text-primary shadow-inner">
                  RP
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">RelayPay customer support</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {connecting ? 'Connecting…' : callActive ? `Live call · ${callTimer}` : 'Call ended'}
                  </p>
                </div>
                <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all duration-500 ${
                      callActive ? 'w-full bg-primary' : connecting ? 'w-2/3 animate-pulse bg-secondary' : 'w-1/4 bg-muted-foreground/20'
                    }`}
                  />
                </div>

                {!callActive && !connecting && postCallSummary && (
                  <p className="max-w-md rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    {postCallSummary}
                  </p>
                )}

                <div className="flex w-full max-w-xs flex-col gap-2 sm:flex-row">
                  {connecting ? (
                    <Button type="button" disabled className="w-full bg-muted">
                      <Phone className="mr-2 h-5 w-5" aria-hidden />
                      Connecting…
                    </Button>
                  ) : callActive ? (
                    <Button
                      type="button"
                      onClick={() => void stopVapiCall()}
                      className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      <PhoneOff className="mr-2 h-5 w-5" aria-hidden />
                      End call
                    </Button>
                  ) : (
                    <Button type="button" onClick={resetToIntro} variant="outline" className="w-full border-primary text-primary">
                      New call
                    </Button>
                  )}
                </div>

              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {backendError && (
            <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {backendError}
            </p>
          )}
          {chatMessages.map((message) => (
            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[min(100%,28rem)] rounded-md border px-4 py-3 text-sm leading-relaxed ${
                  message.type === 'user'
                    ? 'border-primary/20 bg-primary text-primary-foreground'
                    : 'border-border bg-card text-card-foreground shadow-sm'
                }`}
              >
                <p>{message.text}</p>
                <div className="mt-2 text-[11px] opacity-70">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-border bg-card/80 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-4xl space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Optional typed messages</p>
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type your question…"
                className="flex-1 border-border bg-background"
                disabled={isSending || !vapiCallId}
              />
              <Button
                type="submit"
                disabled={!inputText.trim() || isSending || !vapiCallId}
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Send className="h-4 w-4" aria-hidden />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
