/** Maps DB ticket/support status values to readable labels */
export function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}

export function formatCategoryLabel(category: string | null | undefined): string {
  if (!category) return '—'
  return category.replace(/_/g, ' ')
}

export function msToShortDuration(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return '-'
  if (ms < 1000) return `${Math.round(ms)} ms`
  const sec = ms / 1000
  if (sec < 60) return `${sec.toFixed(1)} s`
  const min = sec / 60
  return `${min.toFixed(1)} min`
}
