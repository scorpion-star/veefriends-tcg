// app/components/PixiCanvas.tsx
'use client'
import { useEffect, useRef } from 'react'
import { Application } from 'pixi.js'

type SetupFn = (app: Application) => (() => void) | void

export default function PixiCanvas({
  setup,
  className,
}: {
  setup: SetupFn
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const app = new Application()
    let cleanup: (() => void) | void

    app.init({ backgroundAlpha: 0, resizeTo: containerRef.current, antialias: true }).then(() => {
      containerRef.current?.appendChild(app.canvas)
      cleanup = setup(app)
    })

    return () => {
      cleanup?.()
      app.destroy(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className={className} />
}
