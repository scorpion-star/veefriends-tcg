'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CoreCard from '@/app/components/CoreCard'
import { getCardArtUrl } from '@/lib/card-art'
import CoinIcon from '@/app/components/CoinIcon'

type Card = {
  id: number
  name: string
  rarity: string
  aura: number
  skill: number
  stamina: number
  total_score: number
  image_url?: string | null
}

const RARITY_PRICES: Record<string, number> = {
  Core:         50,
  Rare:        150,
  'Very Rare': 300,
  Epic:        600,
  Spectacular: 1200,
}

const RARITY_ORDER = ['Core', 'Rare', 'Very Rare', 'Epic', 'Spectacular']

const RARITY_STYLE: Record<string, { label: string; card: string; badge: string }> = {
  Core:         { label: 'text-gray-300',   card: 'border-gray-600',  badge: 'bg-gray-800 text-gray-300' },
  Rare:         { label: 'text-amber-400',  card: 'border-amber-600', badge: 'bg-amber-900/50 text-amber-300' },
  'Very Rare':  { label: 'text-orange-400', card: 'border-orange-600',badge: 'bg-orange-900/50 text-orange-300' },
  Epic:         { label: 'text-green-400',  card: 'border-green-600', badge: 'bg-green-900/50 text-green-300' },
  Spectacular:  { label: 'text-blue-400',   card: 'border-blue-500',  badge: 'bg-blue-900/50 text-blue-300' },
}

function hoursUntilRefresh(refreshedAt: string): number {
  const elapsed = (Date.now() - new Date(refreshedAt).getTime()) / (1000 * 60 * 60)
  return Math.max(0, Math.ceil(24 - elapsed))
}

export default function StorePage() {
  const router = useRouter()

  const [coins, setCoins] = useState<number | null>(null)
  const [canClaim, setCanClaim] = useState(false)
  const [hoursLeft, setHoursLeft] = useState(0)
  const [claiming, setClaiming] = useState(false)
  const [claimMsg, setClaimMsg] = useState<string | null>(null)

  const [cards, setCards] = useState<Card[]>([])
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<number | null>(null)
  const [purchaseMsg, setPurchaseMsg] = useState<{ id: number; msg: string; ok: boolean } | null>(null)
  const [preview, setPreview] = useState<{ card: Card; rect: DOMRect } | null>(null)
  const [previewVisible, setPreviewVisible] = useState(false)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleCardEnter(card: Card, e: React.MouseEvent<HTMLDivElement>) {
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null }
    const rect = e.currentTarget.getBoundingClientRect()
    // If switching cards: update rect+card instantly, stay visible — no gap
    setPreview({ card, rect })
    setPreviewVisible(true)
  }

  function handleCardLeave() {
    setPreviewVisible(false)
    leaveTimer.current = setTimeout(() => setPreview(null), 250)
  }

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/coins/status')
    if (res.status === 401) { router.push('/'); return }
    const data = await res.json()
    setCoins(data.coins)
    setCanClaim(data.canClaim)
    setHoursLeft(data.hoursLeft)
  }, [router])

  useEffect(() => {
    const load = async () => {
      await loadStatus()
      const res = await fetch('/api/store/cards')
      if (res.ok) {
        const data = await res.json()
        setCards(data.cards)
        setRefreshedAt(data.refreshedAt)
      }
      setLoading(false)
    }
    load()
  }, [loadStatus])

  async function claimCoins() {
    setClaiming(true)
    setClaimMsg(null)
    const res = await fetch('/api/coins/claim', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setCoins(data.coins)
      setCanClaim(false)
      setHoursLeft(24)
      setClaimMsg(`+${data.claimed} coins added!`)
    } else {
      setClaimMsg(data.error)
    }
    setClaiming(false)
  }

  async function purchaseCard(card: Card) {
    setPurchasing(card.id)
    setPurchaseMsg(null)
    const res = await fetch('/api/store/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId: card.id }),
    })
    const data = await res.json()
    if (res.ok) {
      setCoins(data.coinsRemaining)
      setPurchaseMsg({ id: card.id, msg: 'Added to collection!', ok: true })
    } else {
      setPurchaseMsg({ id: card.id, msg: data.error, ok: false })
    }
    setPurchasing(null)
  }

  // Group cards by rarity
  const byRarity = RARITY_ORDER.reduce<Record<string, Card[]>>((acc, r) => {
    acc[r] = cards.filter(c => c.rarity === r)
    return acc
  }, {})

  const refreshHours = refreshedAt ? hoursUntilRefresh(refreshedAt) : null

  return (
    <div className="flex-1 flex flex-col bg-gray-950 text-white overflow-hidden min-h-0">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-white transition text-sm">← Home</Link>
          <h1 className="text-xl font-bold flex items-center gap-2"><CoinIcon size={22} /> Store</h1>
        </div>
        <div className="flex items-center gap-3">
          {refreshHours !== null && (
            <span className="text-xs text-gray-500">
              Refreshes in {refreshHours}h
            </span>
          )}
          <div className="flex items-center gap-2 bg-amber-900/40 border border-amber-700/60 px-4 py-2 rounded-xl">
            <CoinIcon size={22} />
            <span className="text-amber-300 font-bold text-lg">{coins ?? '…'}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto min-h-0"><div className="max-w-5xl mx-auto p-6 space-y-8">

        {/* Free Coins */}
        <section className="bg-gradient-to-br from-amber-900/40 to-yellow-900/20 border border-amber-700/50 rounded-2xl p-6 flex items-center justify-between gap-6">
          <div>
            <h2 className="text-lg font-bold text-amber-300 mb-1">Daily Free Coins</h2>
            <p className="text-gray-400 text-sm">
              {canClaim
                ? 'Your daily coins are ready to collect!'
                : `Come back in ${hoursLeft} hour${hoursLeft === 1 ? '' : 's'}`}
            </p>
            {claimMsg && (
              <p className={`text-sm mt-2 font-semibold ${claimMsg.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                {claimMsg}
              </p>
            )}
          </div>
          <button
            onClick={claimCoins}
            disabled={!canClaim || claiming}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black px-6 py-3 rounded-xl transition text-lg shrink-0 hover:shadow-amber-400/30 hover:shadow-lg"
          >
            {claiming ? 'Claiming…' : canClaim ? <span className="flex items-center gap-1.5 justify-center"><CoinIcon size={16} /> Claim 10 Coins</span> : '⏳ Claimed'}
          </button>
        </section>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
          </div>
        ) : (
          RARITY_ORDER.map(rarity => {
            const rarityCards = byRarity[rarity]
            if (!rarityCards?.length) return null
            const style = RARITY_STYLE[rarity]
            return (
              <section key={rarity}>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className={`text-lg font-bold ${style.label}`}>{rarity}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${style.badge}`}>
                    <span className="flex items-center gap-1"><CoinIcon size={12} /> {RARITY_PRICES[rarity]} each</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-4">
                  {rarityCards.map(card => {
                    const price = RARITY_PRICES[card.rarity]
                    const canAfford = (coins ?? 0) >= price
                    const isBuying = purchasing === card.id
                    const msg = purchaseMsg?.id === card.id ? purchaseMsg : null

                    return (
                      <div key={card.id} className="flex flex-col items-center gap-2">
                        <div
                          onMouseEnter={e => handleCardEnter(card, e)}
                          onMouseLeave={handleCardLeave}
                          style={{
                            opacity: preview?.card.id === card.id ? 0 : 1,
                            transition: 'opacity 0.15s ease',
                          }}
                        >
                          <CoreCard
                            scale={0.55}
                            name={card.name}
                            aura={card.aura}
                            skill={card.skill}
                            stamina={card.stamina}
                            totalScore={card.total_score}
                            imageUrl={getCardArtUrl(card.image_url)}
                            rarity={card.rarity}
                          />
                        </div>
                        <div className="flex flex-col items-center gap-1" style={{ width: 320 * 0.55 }}>
                          {msg && (
                            <p className={`text-xs font-semibold ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.msg}</p>
                          )}
                          <button
                            onClick={() => purchaseCard(card)}
                            disabled={isBuying || !canAfford}
                            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-2 rounded-xl text-sm transition"
                          >
                            {isBuying ? '…' : <span className="flex items-center gap-1 justify-center"><CoinIcon size={14} /> {price}</span>}
                          </button>
                          {!canAfford && !isBuying && (
                            <p className="text-xs text-gray-600 text-center">Need {price - (coins ?? 0)} more</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })
        )}
      </div></div>

      {/* Animated card preview — flies from grid position to viewport center */}
      {preview && (() => {
        const { card, rect } = preview
        // Centre of the grid card in viewport coords
        const cx = rect.left + rect.width  / 2
        const cy = rect.top  + rect.height / 2
        // Clamp so the full-size card (320×448) never leaves the viewport
        const vw = typeof window !== 'undefined' ? window.innerWidth  : 1280
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800
        const clampedCx = Math.min(Math.max(cx, 170), vw - 170)
        const clampedCy = Math.min(Math.max(cy, 234), vh - 234)
        // Position the overlay so its centre aligns with the (clamped) card centre
        const left = clampedCx - 160   // 160 = 320/2
        const top  = clampedCy - 224   // 224 = 448/2

        return (
          <div
            style={{
              position:        'fixed',
              top:             top,
              left:            left,
              pointerEvents:   'none',
              zIndex:          9999,
              transformOrigin: 'center center',
              transform:       previewVisible ? 'scale(1)' : 'scale(0.55)',
              opacity:         previewVisible ? 1 : 0,
              transition:      previewVisible
                ? 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.12s ease'
                : 'transform 0.18s cubic-bezier(0.4, 0, 1, 1), opacity 0.18s ease',
              filter:          previewVisible ? 'drop-shadow(0 24px 48px rgba(0,0,0,0.7))' : 'none',
            }}
          >
            <CoreCard
              scale={1}
              name={card.name}
              aura={card.aura}
              skill={card.skill}
              stamina={card.stamina}
              totalScore={card.total_score}
              imageUrl={getCardArtUrl(card.image_url)}
              rarity={card.rarity}
            />
          </div>
        )
      })()}
    </div>
  )
}
