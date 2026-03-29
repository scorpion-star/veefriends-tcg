'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CardStats from '../components/CardStats'

type Card = {
  id: number
  name: string
  aura: number
  skill: number
  stamina: number
  total_score: number
  rarity: string
  rarity_points: number
  image_url: string | null
  quantity: number
}

type PackStatus = {
  ready: boolean
  isStarter: boolean
  hoursLeft?: number
  lastOpened?: string   // ISO timestamp — used for the live countdown
}

type RevealedCard = { id: number; name: string; rarity: string; image_url?: string | null }

type AnimState = {
  cards: RevealedCard[]
  cardIndex: number     // which card is currently on stage
  isFlipped: boolean    // whether the current card is face-up
  allDone: boolean      // all cards revealed, show summary
}

const RARITY_STYLE: Record<string, { border: string; badge: string; glow: string; glowColor: string }> = {
  Core:        { border: 'border-gray-500',   badge: 'bg-gray-700 text-gray-200',     glow: '',                         glowColor: '' },
  Rare:        { border: 'border-green-500',  badge: 'bg-green-700 text-green-100',   glow: 'shadow-green-500/50',      glowColor: 'rgba(34,197,94,0.6)' },
  'Very Rare': { border: 'border-purple-500', badge: 'bg-purple-700 text-purple-100', glow: 'shadow-purple-500/50',     glowColor: 'rgba(168,85,247,0.6)' },
  Epic:        { border: 'border-orange-500', badge: 'bg-orange-700 text-orange-100', glow: 'shadow-orange-500/50',     glowColor: 'rgba(249,115,22,0.6)' },
  Spectacular: { border: 'border-yellow-400', badge: 'bg-yellow-600 text-yellow-100', glow: 'shadow-yellow-400/60',     glowColor: 'rgba(250,204,21,0.8)' },
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function Collection() {
  const [cards, setCards]             = useState<Card[]>([])
  const [loading, setLoading]         = useState(true)
  const [packStatus, setPackStatus]   = useState<PackStatus | null>(null)
  const [opening, setOpening]         = useState(false)
  const [packError, setPackError]     = useState<string | null>(null)
  const [anim, setAnim]               = useState<AnimState | null>(null)
  const [countdown, setCountdown]     = useState('')

  const supabase = createClient()
  const router   = useRouter()

  // ── Live countdown ────────────────────────────────────────────────────────
  // Single effect watching packStatus directly — avoids the useMemo→useEffect
  // two-render-cycle delay that can leave countdown empty on first paint.
  useEffect(() => {
    if (!packStatus?.lastOpened || packStatus.ready) {
      setCountdown('')
      return
    }
    const nextPackAt = new Date(packStatus.lastOpened).getTime() + 24 * 60 * 60 * 1000
    const tick = () => {
      const ms = nextPackAt - Date.now()
      setCountdown(formatCountdown(ms))
      if (ms <= 0) loadPackStatus()
    }
    tick()                                   // set immediately, no wait
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [packStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadCollection = useCallback(async (userId: string) => {
    const { data: inventoryData } = await supabase
      .from('user_inventory')
      .select('quantity, card_id')
      .eq('user_id', userId)

    if (!inventoryData || inventoryData.length === 0) { setCards([]); return }

    const cardIds = inventoryData.map(item => item.card_id)
    const { data: cardsData } = await supabase.from('cards').select('*').in('id', cardIds)

    if (cardsData) {
      const qtyMap: Record<number, number> = {}
      inventoryData.forEach(item => { qtyMap[item.card_id] = item.quantity })
      const formatted = cardsData.map(card => ({ ...card, quantity: qtyMap[card.id] ?? 1 }))
      formatted.sort((a, b) => {
        const order = ['Spectacular', 'Epic', 'Very Rare', 'Rare', 'Core']
        return order.indexOf(a.rarity) - order.indexOf(b.rarity)
      })
      setCards(formatted)
    }
  }, [supabase])

  const loadPackStatus = useCallback(async () => {
    const res = await fetch('/api/collection/open-pack')
    if (res.ok) setPackStatus(await res.json())
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      await Promise.all([loadCollection(user.id), loadPackStatus()])
      setLoading(false)
    }
    init()
  }, [supabase, router, loadCollection, loadPackStatus])

  // ── Pack opening ──────────────────────────────────────────────────────────
  async function openPack() {
    setOpening(true)
    setPackError(null)

    const res  = await fetch('/api/collection/open-pack', { method: 'POST' })
    const data = await res.json()

    if (!res.ok) {
      setPackError(res.status === 429
        ? `Your next pack is ready in ${data.hoursLeft}h`
        : data.error || 'Failed to open pack')
      setOpening(false)
      return
    }

    // Kick off the animation overlay
    setAnim({ cards: data.cards, cardIndex: 0, isFlipped: false, allDone: false })

    // Reload data in the background
    const { data: { user } } = await supabase.auth.getUser()
    if (user) loadCollection(user.id)
    loadPackStatus()
    setOpening(false)
  }

  // ── Animation controls ────────────────────────────────────────────────────
  function handlePackClick() {
    setAnim(prev => {
      if (!prev || prev.allDone) return prev
      if (!prev.isFlipped) {
        return { ...prev, isFlipped: true }
      }
      if (prev.cardIndex < prev.cards.length - 1) {
        return { ...prev, cardIndex: prev.cardIndex + 1, isFlipped: false }
      }
      return { ...prev, allDone: true }
    })
  }

  function dismissAnim() { setAnim(null) }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-4xl animate-pulse">🃏</div>
      </div>
    )
  }

  const totalCards = cards.reduce((sum, c) => sum + c.quantity, 0)

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── PACK ANIMATION OVERLAY ── */}
      {anim && (
        <div className="fixed inset-0 z-50 bg-black/96 flex flex-col items-center justify-center select-none">

          {!anim.allDone ? (() => {
            const card  = anim.cards[anim.cardIndex]
            const style = RARITY_STYLE[card.rarity] ?? RARITY_STYLE.Core
            const isRare = card.rarity !== 'Core'

            return (
              <>
                {/* Progress */}
                <div className="flex gap-2 mb-10">
                  {anim.cards.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 w-8 rounded-full transition-all duration-300 ${
                        i < anim.cardIndex ? 'bg-amber-400' :
                        i === anim.cardIndex ? 'bg-white' : 'bg-gray-700'
                      }`}
                    />
                  ))}
                </div>

                <p className="text-gray-500 text-sm mb-6 tracking-widest uppercase">
                  Card {anim.cardIndex + 1} of {anim.cards.length}
                </p>

                {/* Card — remount on cardIndex change to re-trigger entrance animation */}
                <div
                  key={anim.cardIndex}
                  className="pack-card-container card-entrance w-44 h-64 cursor-pointer mb-8"
                  onClick={handlePackClick}
                >
                  <div className={`pack-card-inner ${anim.isFlipped ? 'flipped' : ''}`}>

                    {/* Back */}
                    <div className="pack-card-back bg-gradient-to-br from-indigo-950 to-purple-950 border-2 border-indigo-700 flex items-center justify-center overflow-hidden">
                      <img src="/card-back.png" alt="Card back" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                    </div>

                    {/* Front */}
                    <div
                      className={`pack-card-front border-2 ${style.border} bg-gray-900 flex flex-col overflow-hidden ${isRare ? 'rare-glow' : ''}`}
                      style={isRare ? { '--glow': style.glowColor } as React.CSSProperties : undefined}
                    >
                      <div className="flex-1 bg-gray-800 flex items-center justify-center overflow-hidden">
                        {card.image_url
                          ? <img src={card.image_url} alt={card.name} className="w-full h-full object-cover" />
                          : <span className="text-4xl opacity-20">🃏</span>
                        }
                      </div>
                      <div className="p-3 text-center">
                        <p className="text-xs font-bold truncate mb-1.5">{card.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${style.badge}`}>{card.rarity}</span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Hint */}
                <p className="text-sm animate-pulse text-gray-400">
                  {!anim.isFlipped
                    ? 'Tap card to reveal'
                    : anim.cardIndex < anim.cards.length - 1
                      ? 'Tap card for next'
                      : 'Tap card to finish'}
                </p>
              </>
            )
          })() : (
            // ── All-cards summary ──
            <>
              <h2 className="text-2xl font-black mb-2">You got {anim.cards.length} cards!</h2>
              <p className="text-gray-500 text-sm mb-8">Here's what you pulled</p>
              <div className="flex gap-3 flex-wrap justify-center max-w-lg px-6 mb-10">
                {anim.cards.map((card, i) => {
                  const style = RARITY_STYLE[card.rarity] ?? RARITY_STYLE.Core
                  return (
                    <div
                      key={i}
                      className={`border-2 ${style.border} rounded-xl px-4 py-2.5 text-center min-w-[100px] bg-gray-900 ${style.glow ? `shadow-lg ${style.glow}` : ''}`}
                    >
                      <p className="text-xs font-bold truncate mb-1">{card.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${style.badge}`}>{card.rarity}</span>
                    </div>
                  )
                })}
              </div>
              <button
                onClick={dismissAnim}
                className="bg-amber-600 hover:bg-amber-500 px-10 py-3 rounded-2xl font-bold text-lg transition shadow-lg shadow-amber-900/40 hover:shadow-amber-400/30"
              >
                Collect!
              </button>
            </>
          )}
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-white text-sm transition">← Home</Link>
          <span className="text-gray-700">|</span>
          <h1 className="text-xl font-bold">🃏 My Collection</h1>
          <span className="text-gray-600 text-sm">{totalCards} cards</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/deck-builder" className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl font-medium text-sm transition">
            Deck Builder
          </Link>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.push('/'))}
            className="text-gray-500 hover:text-white text-sm transition px-3 py-2"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">

        {/* ── PACK OPENER ── */}
        <div className="mb-8">
          {packStatus?.isStarter && cards.length === 0 ? (
            <div className="bg-gradient-to-br from-indigo-900/60 to-purple-900/60 border border-indigo-700/50 rounded-3xl p-8 text-center">
              <div className="text-6xl mb-4">🎁</div>
              <h2 className="text-3xl font-black mb-2">Welcome!</h2>
              <p className="text-gray-300 mb-6">Open your starter pack to get 20 cards and begin building your collection.</p>
              <button
                onClick={openPack}
                disabled={opening}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 px-10 py-4 rounded-2xl font-bold text-xl transition shadow-lg hover:shadow-indigo-500/40 hover:shadow-2xl"
              >
                {opening ? 'Opening…' : '✨ Open Starter Pack (20 cards)'}
              </button>
            </div>
          ) : (
            <div className={`rounded-2xl border p-5 flex items-center gap-6 ${
              packStatus?.ready ? 'bg-amber-900/30 border-amber-700/50' : 'bg-gray-900 border-gray-800'
            }`}>
              <div className="text-4xl">{packStatus?.ready ? '📦' : '⏳'}</div>

              <div className="flex-1">
                {packStatus?.ready ? (
                  <>
                    <p className="font-bold text-lg text-amber-300">Daily Pack Ready!</p>
                    <p className="text-gray-400 text-sm">5 cards — Core most common</p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-lg">Next pack in</p>
                    <p className="font-mono text-2xl font-black text-amber-400 tracking-widest mt-0.5">
                      {countdown || `${packStatus?.hoursLeft ?? '?'}h`}
                    </p>
                    <p className="text-gray-600 text-xs mt-0.5">Come back tomorrow for 5 more cards</p>
                  </>
                )}
              </div>

              {packStatus?.ready && (
                <button
                  onClick={openPack}
                  disabled={opening}
                  className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-6 py-3 rounded-xl font-bold transition shadow-lg shadow-amber-900/40 hover:shadow-amber-400/40 hover:shadow-xl"
                >
                  {opening ? 'Opening…' : 'Open Pack'}
                </button>
              )}
            </div>
          )}

          {packError && (
            <p className="mt-3 text-red-400 text-sm text-center">{packError}</p>
          )}
        </div>

        {/* ── COLLECTION GRID ── */}
        {cards.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-2xl mb-2">No cards yet</p>
            <p className="text-sm">Open your starter pack above to get started</p>
          </div>
        ) : (
          <>
            <div className="flex gap-3 mb-6 flex-wrap">
              {(['Spectacular', 'Epic', 'Very Rare', 'Rare', 'Core'] as const).map(rarity => {
                const count = cards.filter(c => c.rarity === rarity).reduce((s, c) => s + c.quantity, 0)
                if (count === 0) return null
                const style = RARITY_STYLE[rarity]
                return (
                  <span key={rarity} className={`border ${style.border} text-xs px-3 py-1 rounded-full ${style.badge}`}>
                    {rarity}: {count}
                  </span>
                )
              })}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {cards.map(card => {
                const style = RARITY_STYLE[card.rarity] ?? RARITY_STYLE.Core
                return (
                  <div
                    key={card.id}
                    className={`bg-gray-900 border-2 ${style.border} rounded-2xl overflow-hidden cursor-default hover:scale-[1.02] hover:shadow-xl hover:brightness-110 transition-all duration-200 ${style.glow ? `shadow-lg ${style.glow}` : ''}`}
                  >
                    <div className="h-48 bg-gray-800 relative overflow-hidden">
                      {card.image_url
                        ? <img src={card.image_url} alt={card.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">🃏</div>
                      }
                      {card.quantity > 1 && (
                        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded-full">
                          ×{card.quantity}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-1 mb-2">
                        <h3 className="font-bold text-sm leading-tight">{card.name}</h3>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${style.badge}`}>
                          {card.rarity === 'Very Rare' ? 'VR' : card.rarity === 'Spectacular' ? '★' : card.rarity[0]}
                        </span>
                      </div>
                      <CardStats totalScore={card.total_score} aura={card.aura} skill={card.skill} stamina={card.stamina} size="sm" />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
