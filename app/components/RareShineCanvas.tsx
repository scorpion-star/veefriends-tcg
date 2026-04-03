'use client'

/**
 * RareShineCanvas — Pixi.js mouse-reactive foil overlay for Rare cards.
 *
 * Reads real-time mouse position from `mouseRef` (shared with CoreCard's tilt
 * system) and draws two layered effects each frame:
 *   1. Radial glow   — soft warm highlight centered at the "reflection point"
 *                      (opposite side of the tilt, like light bouncing off the card)
 *   2. Diagonal bands — three thin iridescent strips that rotate with the tilt angle
 *
 * The Pixi canvas sits absolutely over the card with mix-blend-mode: screen,
 * so it brightens the underlying card art without washing it out.
 */

import { useEffect, useRef } from 'react'
import { Application, Graphics } from 'pixi.js'

export interface MouseState {
  relX: number   // 0 (left) → 1 (right)
  relY: number   // 0 (top)  → 1 (bottom)
  active: boolean
}

interface Props {
  mouseRef: React.MutableRefObject<MouseState>
  width: number
  height: number
}

// HSL → Pixi hex color (0xRRGGBB)
function hsl(h: number, s: number, l: number): number {
  const a = s * Math.min(l, 1 - l)
  const ch = (n: number) => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }
  return (ch(0) << 16) | (ch(8) << 8) | ch(4)
}

export default function RareShineCanvas({ mouseRef, width, height }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current

    const app = new Application()
    let animId: number
    let mounted = true

    app.init({ backgroundAlpha: 0, width, height, antialias: true }).then(() => {
      if (!mounted) { app.destroy({ removeView: true }); return }

      // Set the canvas to screen blend so it brightens the card beneath
      const canvas = app.canvas as HTMLCanvasElement
      canvas.style.position = 'absolute'
      canvas.style.inset = '0'
      canvas.style.mixBlendMode = 'screen'
      canvas.style.pointerEvents = 'none'
      container.appendChild(canvas)

      const glow = new Graphics()   // radial highlight
      const band = new Graphics()   // diagonal iridescent bands
      app.stage.addChild(glow)
      app.stage.addChild(band)

      let time = 0

      function draw() {
        time += 0.007
        const { relX, relY, active } = mouseRef.current

        // Reflection point — opposite of where the mouse is tilting toward
        const rx = (1 - relX) * width
        const ry = (1 - relY) * height

        // Rare palette: warm gold → copper (hue 28–50)
        const hueShift = relX * 22 + relY * 14 + time * 11
        const baseHue  = 28 + (hueShift % 22)

        // Idle pulse so the card still shimmers softly when not hovered
        const idlePulse = 0.14 + Math.sin(time * 0.85) * 0.05

        // ── Radial glow (10 concentric circles, large → small) ──────────────
        glow.clear()
        const STEPS = 10
        for (let i = STEPS; i >= 1; i--) {
          const t     = i / STEPS
          const r     = t * width * 1.35
          const h     = baseHue + t * 18
          const alpha = (1 - t) * (active ? 0.28 : idlePulse * 0.35)
          glow.circle(rx, ry, r)
          glow.fill({ color: hsl(h, 0.90, 0.74), alpha })
        }

        // ── Diagonal iridescent bands ────────────────────────────────────────
        band.clear()
        // Angle perpendicular to the mouse→center vector, drifts slowly over time
        const angle = Math.atan2(relY - 0.5, relX - 0.5) + Math.PI / 2 + time * 0.035
        const cos   = Math.cos(angle)
        const sin   = Math.sin(angle)
        const diag  = Math.sqrt(width * width + height * height)
        const bandAlpha = active ? 0.18 : idlePulse * 0.22
        const hw    = 32  // half-width of each band strip

        for (let b = -1; b <= 1; b++) {
          // Shift each band laterally along the perpendicular axis
          const bx = width  / 2 + cos * (b * 52)
          const by = height / 2 + sin * (b * 52)
          const h2 = (baseHue + b * 11 + 360) % 360

          // Four corners of the rotated rectangle (infinite along band, hw wide)
          // Along band: (cos, sin)   Perpendicular: (-sin, cos)
          band.moveTo(bx + cos * diag - sin * hw, by + sin * diag + cos * hw)
          band.lineTo(bx - cos * diag - sin * hw, by - sin * diag + cos * hw)
          band.lineTo(bx - cos * diag + sin * hw, by - sin * diag - cos * hw)
          band.lineTo(bx + cos * diag + sin * hw, by + sin * diag - cos * hw)
          band.closePath()
          band.fill({ color: hsl(h2, 0.95, 0.78), alpha: bandAlpha })
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
      app.destroy({ removeView: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 12,
        borderRadius: 'inherit',
        overflow: 'hidden',
      }}
    />
  )
}
