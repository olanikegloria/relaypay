/**
 * Safe string for API responses and UI (never pass raw PostgREST / unknown objects to React).
 */
export function toErrorMessage(err: unknown): string {
  if (err == null) return 'Unknown error'
  if (typeof err === 'string') return err
  if (typeof err === 'number' || typeof err === 'boolean') return String(err)
  if (err instanceof Error) return err.message || 'Error'
  if (typeof err === 'object') {
    const o = err as Record<string, unknown>
    if (typeof o.message === 'string' && o.message) return o.message
    if (typeof o.msg === 'string' && o.msg) return o.msg
    if (typeof o.details === 'string' && o.details) return o.details
    if (typeof o.hint === 'string' && o.hint) return o.hint
    if (typeof o.error === 'string') return o.error
    if (o.error && typeof o.error === 'object') {
      const e = o.error as Record<string, unknown>
      if (typeof e.message === 'string') return e.message
      if (typeof e.msg === 'string') return e.msg
    }
  }
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}
