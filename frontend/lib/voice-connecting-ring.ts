'use client'

import { useEffect, useRef } from 'react'

/** Ring burst length (ms) — typical “phone ring” on-phase. */
const RING_ON_MS = 2000
/** Full cycle: ring + silence before next ring. */
const RING_CYCLE_MS = 6000
const PEAK_GAIN = 0.07

function createAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  return new AC()
}

function playRingBurst(ctx: AudioContext) {
  const t0 = ctx.currentTime
  const master = ctx.createGain()
  master.connect(ctx.destination)
  master.gain.setValueAtTime(0.0001, t0)
  master.gain.exponentialRampToValueAtTime(PEAK_GAIN, t0 + 0.04)

  for (const hz of [440, 480]) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(hz, t0)
    osc.connect(master)
    osc.start(t0)
    const tEnd = t0 + RING_ON_MS / 1000
    osc.stop(tEnd)
  }

  const tFade = t0 + RING_ON_MS / 1000 - 0.08
  master.gain.exponentialRampToValueAtTime(0.0001, tFade)
}

/**
 * Plays a repeating ring tone only while Vapi is connecting (not during pre-call “Preparing…”).
 * Uses Web Audio (no asset file). Stops automatically when `active` becomes false.
 */
export function useConnectingRing(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    if (!active) {
      if (ctxRef.current) {
        void ctxRef.current.close()
        ctxRef.current = null
      }
      return
    }

    const ctx = createAudioContext()
    if (!ctx) return
    ctxRef.current = ctx

    const kick = async () => {
      try {
        if (ctx.state === 'suspended') await ctx.resume()
      } catch {
        /* autoplay policies */
      }
      playRingBurst(ctx)
    }
    void kick()

    const id = window.setInterval(() => {
      playRingBurst(ctx)
    }, RING_CYCLE_MS)

    return () => {
      window.clearInterval(id)
      void ctx.close()
      if (ctxRef.current === ctx) ctxRef.current = null
    }
  }, [active])
}
