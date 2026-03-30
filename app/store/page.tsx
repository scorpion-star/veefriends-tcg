'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CardStats from '@/app/components/CardStats'

type Card = {
  id: number
  name: string
  rarity: string
  image_url: string | null
  aura: number
  skill: number
  stamina: number
  total_score: number
}

const RARITY_PRICES: Record<string, number> = {
  Core:         50,
  Rare:        150,
  'Very Rare': 300,
  Epic:        600,
  Spectacular: 1200,
}

const RARITY_ORDER = ['Core', 'Rare', 'Very Rare', 'Epic', 'Spectacular']

const RARITY_COLOR: Record<string, string> = {
  Core:         'text-gray-400  border-gray-600',
  Rare:         'text-amber-400 border-amber-600',
  'Very Rare':  'text-orange-400 border-orange-600',
  Epic:         'text-green-400 border-green-600',
  Spectacular:  'text-blue-400  border-blue-500',
}

export default function StorePage() {
  const router = useRouter()

  const [coins, setCoins] = useState<number | null>(null)
  const [canClaim, setCanClaim] = useState(false)
  const [hoursLeft, setHoursLeft] = useState(0)
  const [claiming, setClaiming] = useState(false)
  const [claimMsg, setClaimMsg] = useState<string | null>(null)

  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [rarityFilter, setRarityFilter] = useState<string>('All')
  const [search, setSearch] = useState('')
  const [purchasing, setPurchasing] = useState<number | null>(null)
  const [purchaseMsg, setPurchaseMsg] = useState<{ id: number; msg: string; ok: boolean } | null>(null)

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
      setPurchaseMsg({ id: card.id, msg: `${card.name} added to your collection!`, ok: true })
    } else {
      setPurchaseMsg({ id: card.id, msg: data.error, ok: false })
    }
    setPurchasing(null)
  }

  const filtered = cards.filter(c => {
    const matchRarity = rarityFilter === 'All' || c.rarity === rarityFilter
    const matchSearch = !search.trim() || c.name.toLowerCase().includes(search.toLowerCase())
    return matchRarity && matchSearch
  })

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-white transition text-sm">← Home</Link>
          <h1 className="text-xl font-bold">🪙 Store</h1>
        </div>
        <div className="flex items-center gap-2 bg-amber-900/40 border border-amber-700/60 px-4 py-2 rounded-xl">
          <span className="text-amber-400 font-black text-lg">🪙</span>
          <span className="text-amber-300 font-bold text-lg">{coins ?? '…'}</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6 space-y-6">

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
            {claiming ? 'Claiming…' : canClaim ? '🪙 Claim 10 Coins' : '⏳ Claimed'}
          </button>
        </section>

        {/* Rarity prices legend */}
        <section className="flex flex-wrap gap-2">
          {RARITY_ORDER.map(r => (
            <div key={r} className={`text-xs border px-3 py-1.5 rounded-full font-semibold ${RARITY_COLOR[r]}`}>
              {r} — {RARITY_PRICES[r]} 🪙
            </div>
          ))}
        </section>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search cards…"
            className="flex-1 min-w-48 bg-gray-900 border border-gray-700 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none transition"
          />
          <div className="flex gap-2 flex-wrap">
            {['All', ...RARITY_ORDER].map(r => (
              <button
                key={r}
                onClick={() => setRarityFilter(r)}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition ${
                  rarityFilter === r
                    ? 'bg-amber-500 text-black'
                    : 'bg-gray-900 border border-gray-700 text-gray-400 hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Cards grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 text-center py-16">No cards found.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filtered.map(card => {
              const price = RARITY_PRICES[card.rarity]
              const canAfford = (coins ?? 0) >= price
              const isBuying = purchasing === card.id
              const msg = purchaseMsg?.id === card.id ? purchaseMsg : null

              return (
                <div key={card.id} className={`bg-gray-900 border rounded-2xl overflow-hidden flex flex-col ${RARITY_COLOR[card.rarity].split(' ')[1] || 'border-gray-700'}`}>
                  {card.image_url && (
                    <img src={card.image_url} alt={card.name} className="w-full h-36 object-cover" />
                  )}
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <p className="font-bold text-sm leading-tight">{card.name}</p>
                    <p className={`text-xs font-semibold ${RARITY_COLOR[card.rarity].split(' ')[0]}`}>{card.rarity}</p>
                    <CardStats totalScore={card.total_score} aura={card.aura} skill={card.skill} stamina={card.stamina} size="sm" />
                    {msg && (
                      <p className={`text-xs font-semibold ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.msg}</p>
                    )}
                    <button
                      onClick={() => purchaseCard(card)}
                      disabled={isBuying || !canAfford}
                      className="mt-auto w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-2 rounded-xl text-sm transition"
                    >
                      {isBuying ? '…' : `🪙 ${price}`}
                    </button>
                    {!canAfford && !isBuying && (
                      <p className="text-xs text-gray-600 text-center">Need {price - (coins ?? 0)} more</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
