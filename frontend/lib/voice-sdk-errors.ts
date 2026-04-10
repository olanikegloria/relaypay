/**
 * Vapi / Daily / Krisp often log benign teardown messages (call ended, WASM unload race).
 * Used to avoid showing them as user-facing errors and to optionally filter dev console noise.
 */
export function isBenignVoiceSdkMessage(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('meeting has ended') ||
    m.includes('meeting ended in error') ||
    m.includes('meeting ended due to ejection') ||
    /ejection|already ended|left-meeting/.test(m) ||
    m.includes('krisp') ||
    m.includes('wasm_or_worker_not_ready') ||
    m.includes('audio-processor-error') ||
    (m.includes('error unloading') && m.includes('processor'))
  )
}
