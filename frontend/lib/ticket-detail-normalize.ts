/** WF10 detail / nested proxy shapes */
export function normalizeTicketDetailEnvelope(data: unknown): unknown {
  if (data == null || typeof data !== 'object') return data
  const o = data as Record<string, unknown>
  const inner = o.data
  if (inner != null && typeof inner === 'object' && !Array.isArray(inner)) {
    const layer = inner as Record<string, unknown>
    if ('data' in layer && layer.data != null && typeof layer.data === 'object') {
      return { ...o, data: layer.data }
    }
  }
  return data
}
