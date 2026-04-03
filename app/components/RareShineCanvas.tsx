'use client'

/**
 * RareShineCanvas — Pokémon-style holofoil overlay for Rare cards.
 *
 * Three layered effects rendered each frame:
 *   1. Rainbow strips  — 60 thin prismatic bands covering the full card.
 *                        baseHue sweeps 0–360° as the mouse moves left→right,
 *                        producing the characteristic full-spectrum flash.
 *   2. Sparkle dots    — 80 pre-seeded positions that twinkle in/out at
 *                        varying speeds, coloured to match the current hue.
 *   3. Soft vignette   — faint dark edge so the foil reads as "on" the card
 *                        rather than floating above it.
 *
 * mix-blend-mode: screen brightens the card beneath without washing it out.
 */

import { useEffect, useRef } from 'react'
import { Application, Graphics } from 'pixi.js'

export interface MouseState {
  relX: number   // 0 (left) → 1 (right)
  relY: number   // 0 (top)  → 1 (bottom)
  active: boolean
}

interface Props {
  width: number
  height: number
}

// HSL → Pixi hex (0xRRGGBB)
function hsl(h: number, s: number, l: number): number {
  h = ((h % 360) + 360) % 360
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }
  return (f(0) << 16) | (f(8) << 8) | f(4)
}

// Pre-seed sparkle positions so they don't change between frames
function seedSparkles(n: number, w: number, h: number) {
  return Array.from({ length: n }, () => ({
    x:     Math.random() * w,
    y:     Math.random() * h,
    phase: Math.random() * Math.PI * 2,
    speed: 1.2 + Math.random() * 2.0,
    size:  0.8 + Math.random() * 1.6,
  }))
}

const STRIPS = 60   // rainbow band count — more = smoother gradient
const N_SPARKLES = 80

export default function RareShineCanvas({ width, height }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current

    const app = new Application()
    let animId: number
    let mounted = true
    let initialized = false

    const sparkles = seedSparkles(N_SPARKLES, width, height)
    const diag = Math.sqrt(width * width + height * height)
    const stripW = diag / STRIPS

    app.init({ backgroundAlpha: 0, width, height, antialias: true }).then(() => {
      initialized = true
      if (!mounted) { app.destroy({ removeView: true }); return }

      const canvas = app.canvas as HTMLCanvasElement
      canvas.style.position    = 'absolute'
      canvas.style.inset       = '0'
      canvas.style.mixBlendMode = 'screen'
      canvas.style.pointerEvents = 'none'
      container.appendChild(canvas)

      const rainbow  = new Graphics()
      const sparkleG = new Graphics()
      app.stage.addChild(rainbow)
      app.stage.addChild(sparkleG)

      let time = 0

      function draw() {
        time += 0.010

        // ── Base hue — slow automatic cycle through the full spectrum ─────────
        const baseHue = (time * 18) % 360

        // ── Band angle — drifts slowly over time ─────────────────────────────
        const angle = time * 0.05
        const cos   = Math.cos(angle)
        const sin   = Math.sin(angle)

        // ── 1. Rainbow strips ────────────────────────────────────────────────
        rainbow.clear()
        for (let i = 0; i < STRIPS; i++) {
          const t   = i / STRIPS
          const hue = (baseHue + t * 360) % 360
          const offset = (i - STRIPS / 2 + 0.5) * stripW
          const cx = width  / 2 + (-sin) * offset
          const cy = height / 2 + ( cos) * offset
          const hw = stripW * 0.52   // tiny overlap removes hairline gaps

          rainbow.moveTo(cx + cos * diag - sin * hw,  cy + sin * diag + cos * hw)
          rainbow.lineTo(cx - cos * diag - sin * hw,  cy - sin * diag + cos * hw)
          rainbow.lineTo(cx - cos * diag + sin * hw,  cy - sin * diag - cos * hw)
          rainbow.lineTo(cx + cos * diag + sin * hw,  cy + sin * diag - cos * hw)
          rainbow.closePath()
          rainbow.fill({ color: hsl(hue, 1.0, 0.62), alpha: 0.20 })
        }

        // ── 2. Sparkle dots ──────────────────────────────────────────────────
        sparkleG.clear()
        for (const sp of sparkles) {
          const pulse = Math.sin(time * sp.speed + sp.phase)
          if (pulse < 0.35) continue
          const a   = (pulse - 0.35) / 0.65
          const hue = (baseHue + (sp.x / width) * 200) % 360
          sparkleG.circle(sp.x, sp.y, sp.size * a)
          sparkleG.fill({ color: hsl(hue, 0.7, 0.95), alpha: a * 0.55 })
        }
      }

      function loop() {
        draw()
        animId = requestAnimationFrame(loop)
      }
      loop()
    })

    return () => {
      mounted = false
      cancelAnimationFrame(animId!)
      if (initialized) app.destroy({ removeView: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      style={{
        position:     'absolute',
        inset:        0,
        pointerEvents:'none',
        zIndex:       12,
        borderRadius: 'inherit',
        overflow:     'hidden',
      }}
    />
  )
}
