'use client'

// Gem UI components for the in-game board.
// PlayerScoreRow  — row of 3 score circles (one per attribute) for one player
// TieBankSidebar  — compact left-side fixed panel showing banked gems

import { useEffect, useRef, useState } from 'react'

type AttrKey = 'aura' | 'skill' | 'stamina'
type Points  = { aura: number; skill: number; stamina: number }

const ATTR = {
  aura: {
    label:    'Aura',
    icon:     '♥',
    active:   'bg-red-600 border-red-500 shadow-red-500/50',
    idle:     'bg-red-950/30 border-red-900/40',
    ring:     'ring-red-400',
    text:     'text-red-400',
    floatCls: 'text-red-300',
    bankText: 'text-red-400',
  },
  skill: {
    label:    'Skill',
    icon:     '⚙',
    active:   'bg-green-700 border-green-500 shadow-green-500/50',
    idle:     'bg-green-950/30 border-green-900/40',
    ring:     'ring-green-400',
    text:     'text-green-400',
    floatCls: 'text-green-300',
    bankText: 'text-green-400',
  },
  stamina: {
    label:    'Stamina',
    icon:     '⚡',
    active:   'bg-yellow-600 border-yellow-500 shadow-yellow-500/50',
    idle:     'bg-yellow-950/30 border-yellow-900/40',
    ring:     'ring-yellow-400',
    text:     'text-yellow-400',
    floatCls: 'text-yellow-300',
    bankText: 'text-yellow-400',
  },
} as const

// ─── Single score circle ───────────────────────────────────────────────────────

function ScoreCircle({ attrKey, value }: { attrKey: AttrKey; value: number }) {
  const prevRef             = useRef(value)
  const [animating, setAnim]  = useState(false)
  const [showFloat, setFloat] = useState(false)

  useEffect(() => {
    if (value > prevRef.current) {
      setAnim(true)
      setFloat(true)
      const t1 = setTimeout(() => setAnim(false),  500)
      const t2 = setTimeout(() => setFloat(false), 950)
      prevRef.current = value
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
    prevRef.current = value
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const cfg      = ATTR[attrKey]
  const hasScore = value > 0
  const isMax    = value >= 7

  return (
    <div className="relative flex flex-col items-center gap-1">
      {showFloat && (
        <span className={`absolute -top-3 left-1/2 -translate-x-1/2 text-sm font-black ${cfg.floatCls} gem-float pointer-events-none z-20`}>
          +1
        </span>
      )}
      <div
        style={{ borderStyle: 'dashed' }}
        className={`
          w-[125px] h-[125px] rounded-full border-[3px] flex flex-col items-center justify-center
          transition-all duration-300 shadow-lg select-none
          ${hasScore ? cfg.active : cfg.idle}
          ${isMax ? `ring-4 ring-offset-2 ring-offset-black ${cfg.ring}` : ''}
          ${animating ? 'gem-pop' : ''}
        `}
      >
        <span className={`text-3xl leading-none ${hasScore ? 'text-white' : cfg.text} opacity-80`}>{cfg.icon}</span>
        <span className={`text-3xl font-black leading-tight ${hasScore ? 'text-white' : 'text-gray-600'}`}>{value}</span>
      </div>
      <span className="text-xs text-gray-500 uppercase tracking-wide">{cfg.label}</span>
    </div>
  )
}

// ─── Row of 3 score circles for one player ────────────────────────────────────

export function PlayerScoreRow({ points }: { points: Points }) {
  return (
    <div className="flex justify-center gap-4 shrink-0">
      {(['aura', 'skill', 'stamina'] as AttrKey[]).map(attr => (
        <ScoreCircle key={attr} attrKey={attr} value={points[attr]} />
      ))}
    </div>
  )
}

// ─── Left-side fixed tie bank sidebar ─────────────────────────────────────────

export function TieBankSidebar({ tieBank }: { tieBank: Points }) {
  const hasGems = tieBank.aura > 0 || tieBank.skill > 0 || tieBank.stamina > 0
  return (
    <div className={`rounded-2xl border p-2.5 text-center transition-all duration-300 min-w-[52px] ${
      hasGems
        ? 'bg-amber-900/70 border-amber-600 shadow-lg shadow-amber-900/40'
        : 'bg-gray-900/80 border-gray-700'
    }`}>
      <div className="text-base mb-1">💎</div>
      <div className="text-[10px] font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Bank</div>
      {hasGems ? (
        <div className="space-y-1">
          {tieBank.aura    > 0 && <div className="text-red-400    text-xs font-bold">{tieBank.aura}    Aura</div>}
          {tieBank.skill   > 0 && <div className="text-green-400  text-xs font-bold">{tieBank.skill}   Skill</div>}
          {tieBank.stamina > 0 && <div className="text-yellow-400 text-xs font-bold">{tieBank.stamina} Stamina</div>}
        </div>
      ) : (
        <div className="text-gray-600 text-sm font-bold">—</div>
      )}
    </div>
  )
}
