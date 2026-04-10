/**
 * Server-side helpers for calling RelayPay n8n webhook workflows.
 * Set N8N_WEBHOOK_BASE_URL to your instance base, e.g. https://YOUR.app.n8n.cloud/webhook
 */

function normalizeBase(url: string): string {
  return url.replace(/\/$/, '')
}

export function getN8nWebhookBase(): string | null {
  const raw = process.env.N8N_WEBHOOK_BASE_URL
  if (!raw?.trim()) return null
  return normalizeBase(raw.trim())
}

export function getN8nDashboardApiKey(): string {
  return process.env.N8N_DASHBOARD_API_KEY?.trim() || 'relaypay-dashboard-2026'
}

export type N8nWebhookOptions = {
  method?: 'GET' | 'POST'
  /** JSON body for POST */
  body?: Record<string, unknown>
  /** Query string params (e.g. days, x-api-key for GET webhooks) */
  searchParams?: Record<string, string | number | undefined>
}

export async function callN8nWebhook(
  path: string,
  options: N8nWebhookOptions = {}
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const base = getN8nWebhookBase()
  if (!base) {
    return { ok: false, status: 503, data: { error: 'N8N_WEBHOOK_BASE_URL is not configured' } }
  }

  const apiKey = getN8nDashboardApiKey()
  const segment = path.replace(/^\//, '')
  const url = new URL(`${base}/${segment}`)

  if (options.searchParams) {
    for (const [k, v] of Object.entries(options.searchParams)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    }
  }

  const method = options.method ?? 'POST'
  const headers: Record<string, string> = {
    'x-api-key': apiKey,
  }

  const init: RequestInit = { method, headers }

  if (method === 'POST' && options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(options.body)
  }

  const res = await fetch(url.toString(), init)
  let data: unknown
  const text = await res.text()
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { ok: res.ok, status: res.status, data }
}
