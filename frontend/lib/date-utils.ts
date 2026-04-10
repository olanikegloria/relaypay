/** Formats ISO timestamps or date-only strings (e.g. `2026-04-08`) for display. */
export function formatDate(dateInput: string | Date | undefined | null): string {
  if (dateInput == null || dateInput === '') return '-'
  const raw =
    dateInput instanceof Date
      ? dateInput
      : typeof dateInput === 'string'
        ? dateInput.trim()
        : String(dateInput)

  // Legacy: date-only "YYYY-MM-DD": parse as UTC date to avoid TZ shifting the calendar day
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T12:00:00Z`)
    if (Number.isNaN(date.getTime())) return '-'
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const year = date.getUTCFullYear()
    return `${month}/${day}/${year}`
  }

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return '-'
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()
  return `${month}/${day}/${year}`
}
