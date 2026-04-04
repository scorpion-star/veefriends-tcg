'use client'

/**
 * RareShineCanvas — Pokémon-style holofoil overlay using Canvas 2D.
 *
 * Switched from Pixi.js (WebGL) to Canvas 2D because browsers cap WebGL
 * contexts at ~8-16. With 7 foil rarity types (Rare + 6 ultra-rares) and
 * many cards visible at once in the collection/store, Pixi.js exhausts the
 * limit, causing "Cannot read properties of null (reading 'split')" crashes
 * from failed shader compilation. Canvas 2D has no context limit.
 *
 * Visual output is identical:
 *   1. Rainbow strips  — 60 prismatic bands, hue cycling over time.
 *   2. Sparkle dots    — 80 pre-seeded twinkling points.
 * mix-blend-mode: screen brightens without washing out the card beneath.
 */

import { useEffect, useRef } from 'react'

// Kept for backward-compat (CoreCard imports this type)
export interface MouseState {
  relX: number
  relY: number
  active: boolean
}

interface Props {
  width: number
  height: number
}

function seedSparkles(n: number, w: number, h: number) {
  return Array.from({ length: n }, () => ({
    x:     Math.random() * w,
    y:     Math.random() * h,
    phase: Math.random() * Math.PI * 2,
    speed: 1.2 + Math.random() * 2.0,
    size:  0.8 + Math.random() * 1.6,
  }))
}

const STRIPS = 60
const N_SPARKLES = 80

export default function RareShineCanvas({ width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const sparkles = seedSparkles(N_SPARKLES, width, height)
    const diag = Math.sqrt(width * width + height * height)
    const stripW = diag / STRIPS
    let time = 0
    let animId: number

    function draw() {
      time += 0.010
      ctx.clearRect(0, 0, width, height)

      const baseHue = (time * 18) % 360
      const angle   = time * 0.05
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)

      // ── 1. Rainbow strips ──────────────────────────────────────────────────
      for (let i = 0; i < STRIPS; i++) {
        const hue    = (baseHue + (i / STRIPS) * 360) % 360
        const offset = (i - STRIPS / 2 + 0.5) * stripW
        const cx = width  / 2 + (-sin) * offset
        const cy = height / 2 + ( cos) * offset
        const hw = stripW * 0.52

        ctx.beginPath()
        ctx.moveTo(cx + cos * diag - sin * hw,  cy + sin * diag + cos * hw)
        ctx.lineTo(cx - cos * diag - sin * hw,  cy - sin * diag + cos * hw)
        ctx.lineTo(cx - cos * diag + sin * hw,  cy - sin * diag - cos * hw)
        ctx.lineTo(cx + cos * diag + sin * hw,  cy + sin * diag - cos * hw)
        ctx.closePath()
        ctx.fillStyle  = `hsl(${hue},100%,62%)`
        ctx.globalAlpha = 0.20
        ctx.fill()
      }

      // ── 2. Sparkle dots ────────────────────────────────────────────────────
      for (const sp of sparkles) {
        const pulse = Math.sin(time * sp.speed + sp.phase)
        if (pulse < 0.35) continue
        const a   = (pulse - 0.35) / 0.65
        const hue = (baseHue + (sp.x / width) * 200) % 360
        ctx.beginPath()
        ctx.arc(sp.x, sp.y, sp.size * a, 0, Math.PI * 2)
        ctx.fillStyle   = `hsl(${hue},70%,95%)`
        ctx.globalAlpha = a * 0.55
        ctx.fill()
      }

      ctx.globalAlpha = 1
      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animId)
  }, [width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position:      'absolute',
        inset:         0,
        mixBlendMode:  'screen',
        pointerEvents: 'none',
        zIndex:        12,
        borderRadius:  'inherit',
      }}
    />
  )
}
