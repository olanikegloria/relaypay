/**
 * n8n list/detail responses often use `{ data: [...], total }` where the real row is `data[0]`,
 * or `{ data: { ...single } }`. Normalize to one object for UI.
 */
export function unwrapN8nEntity(envelope: unknown): Record<string, unknown> | null {
  if (envelope == null) return null

  if (Array.isArray(envelope)) {
    const first = envelope[0]
    return first && typeof first === 'object' && !Array.isArray(first)
      ? (first as Record<string, unknown>)
      : null
  }

  if (typeof envelope !== 'object') return null
  const o = envelope as Record<string, unknown>
  const inner = o.data

  if (Array.isArray(inner)) {
    const first = inner[0]
    return first && typeof first === 'object' && !Array.isArray(first)
      ? (first as Record<string, unknown>)
      : null
  }

  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    return inner as Record<string, unknown>
  }

  if (o.id !== undefined || o.email !== undefined || o.full_name !== undefined) {
    return o
  }

  return null
}

/**
 * Agent detail from n8n should be `{ data: { id, full_name, ... recent_tickets } }`.
 * If the workflow mistakenly returns a list `{ data: [...], total }`, pick the row
 * matching `requestedId` instead of always using `data[0]`.
 */
export function unwrapAgentDetail(
  envelope: unknown,
  requestedId: string
): Record<string, unknown> | null {
  const want = String(requestedId).trim().toLowerCase()
  if (!want) return unwrapN8nEntity(envelope)

  if (envelope == null || typeof envelope !== 'object') return null
  const o = envelope as Record<string, unknown>
  const inner = o.data

  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    const row = inner as Record<string, unknown>
    if (row.id != null && String(row.id).toLowerCase() === want) {
      return row
    }
    const nested = row.data
    if (Array.isArray(nested)) {
      const found = nested.find(
        (r) =>
          r &&
          typeof r === 'object' &&
          String((r as Record<string, unknown>).id).toLowerCase() === want
      ) as Record<string, unknown> | undefined
      if (found) return found
    }
  }

  if (Array.isArray(inner)) {
    const row = inner.find(
      (r) =>
        r &&
        typeof r === 'object' &&
        String((r as Record<string, unknown>).id).toLowerCase() === want
    ) as Record<string, unknown> | undefined
    return row ?? null
  }

  return unwrapN8nEntity(envelope)
}
