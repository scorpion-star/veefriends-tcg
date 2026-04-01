'use client'

const SPARKLES = [
  { left: '2%',   top: '10%',  size: 18, dur: '2.2s', delay: '0.0s' },
  { left: '18%',  top: '-30%', size: 14, dur: '1.8s', delay: '0.5s' },
  { left: '38%',  top: '-40%', size: 22, dur: '2.6s', delay: '1.1s' },
  { left: '58%',  top: '-35%', size: 16, dur: '2.0s', delay: '0.3s' },
  { left: '78%',  top: '-25%', size: 20, dur: '2.4s', delay: '0.8s' },
  { left: '96%',  top: '5%',   size: 14, dur: '1.9s', delay: '1.4s' },
  { left: '88%',  top: '80%',  size: 12, dur: '2.1s', delay: '0.6s' },
  { left: '10%',  top: '75%',  size: 16, dur: '2.3s', delay: '1.7s' },
]

export default function SparkleTitle({ children, textSize = 'text-7xl' }: { children: React.ReactNode; textSize?: string }) {
  return (
    <div className="w-full text-center">
    <div className="relative inline-block">
      {SPARKLES.map((s, i) => (
        <span
          key={i}
          className="sparkle"
          style={{
            left: s.left,
            top: s.top,
            fontSize: s.size,
            '--dur': s.dur,
            '--delay': s.delay,
          } as React.CSSProperties}
        >
          ✦
        </span>
      ))}
      <h1 className={`menu-title ${textSize} font-black tracking-tight drop-shadow-2xl whitespace-nowrap`}>
        {children}
      </h1>
    </div>
    </div>
  )
}
