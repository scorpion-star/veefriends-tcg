'use client'

import { useEffect, useRef } from 'react'
import { Application, Graphics } from 'pixi.js'

export type BurstResult = 'win' | 'lose'

interface Props {
  /** 'win' | 'lose' | null (null = tie, no burst) */
  result: BurstResult | null
  /** Increment each round so the effect re-fires even if result stays the same */
  triggerKey: number
}

const WIN_COLORS  = [0xFFD700, 0xFFF176, 0xFFB300, 0xFFFFFF, 0xFFA726, 0xF59E0B]
// Bright, saturated reds + white flash so particles are visible on the dark overlay
const LOSE_COLORS = [0xFF4444, 0xFF6666, 0xFF2222, 0xFFAAAA, 0xFF0000, 0xFFFFFF]

export default function RoundBurst({ result, triggerKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef       = useRef<Application | null>(null)
  const resultRef    = useRef<BurstResult | null>(result)
  resultRef.current  = result

  // ── Init Pixi once ──────────────────────────────────────────────────────────
  // Use a `cancelled` flag so that if React Strict Mode fires the cleanup before
  // init resolves, the pending Promise destroys itself instead of leaking a
  // zombie canvas that would sit on top and swallow subsequent bursts.
  useEffect(() => {
    let cancelled = false
    const app = new Application()

    app.init({
      backgroundAlpha: 0,
      antialias: true,
      resizeTo: window,
    }).then(() => {
      if (cancelled) {
        app.destroy(true)
        return
      }
      if (containerRef.current) {
        containerRef.current.appendChild(app.canvas)
      }
      appRef.current = app
    })

    return () => {
      cancelled = true
      appRef.current = null
      // If init already resolved, destroy immediately.
      // If still pending, the .then() above will destroy it.
      if (app.renderer) app.destroy(true)
    }
  }, [])

  // ── Burst on each new round result ──────────────────────────────────────────
  useEffect(() => {
    const r   = resultRef.current
    const app = appRef.current
    if (!r || !app) return

    const colors = r === 'win' ? WIN_COLORS : LOSE_COLORS
    const count  = r === 'win' ? 70 : 60
    const cx     = app.screen.width  / 2
    const cy     = app.screen.height * 0.42

    type Particle = {
      gfx: Graphics
      vx: number; vy: number
      life: number; maxLife: number
    }
    const particles: Particle[] = []

    for (let i = 0; i < count; i++) {
      const angle  = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.9
      const speed  = (r === 'win' ? 7 : 6) + Math.random() * 9
      const radius = 2 + Math.random() * 5
      const color  = colors[Math.floor(Math.random() * colors.length)]
      const life   = 55 + Math.floor(Math.random() * 40)

      const gfx = new Graphics()
      gfx.circle(0, 0, radius).fill({ color })
      gfx.x = cx
      gfx.y = cy
      app.stage.addChild(gfx)

      particles.push({
        gfx,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (r === 'win' ? 4 : 3),
        life,
        maxLife: life,
      })
    }

    const tick = () => {
      let allDead = true
      for (const p of particles) {
        if (p.life <= 0) { p.gfx.visible = false; continue }
        allDead = false
        p.vy    += 0.28
        p.vx    *= 0.98
        p.gfx.x += p.vx
        p.gfx.y += p.vy
        p.gfx.alpha = p.life / p.maxLife
        p.gfx.scale.set(0.3 + 0.7 * (p.life / p.maxLife))
        p.life--
      }
      if (allDead) {
        particles.forEach(p => { app.stage.removeChild(p.gfx); p.gfx.destroy() })
        app.ticker.remove(tick)
      }
    }

    app.ticker.add(tick)

    return () => {
      if (!appRef.current) return   // app was destroyed before this cleanup ran
      app.ticker.remove(tick)
      particles.forEach(p => {
        try { app.stage.removeChild(p.gfx); p.gfx.destroy() } catch { /* already gone */ }
      })
    }
  }, [triggerKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-[60]"
    />
  )
}
