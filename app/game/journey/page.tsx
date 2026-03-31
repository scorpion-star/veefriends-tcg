'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import CoinIcon from '@/app/components/CoinIcon'

type Difficulty = 'easy' | 'medium' | 'hard'

type Opponent = {
  id: string
  name: string
  avatar_url: string | null
  difficulty: Difficulty
  is_boss: boolean
  coins_reward: number
  stage_order: number
}

type Deck = {
  id: string
  name: string
  card_ids: number[]
}

const DIFF_ICON: Record<Difficulty, string> = { easy: '🟢', medium: '🟡', hard: '🔴' }
const DIFF_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

function AvatarOrFallback({ url, name, size = 80, isBoss = false }: { url: string | null; name: string; size?: number; isBoss?: boolean }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div
      className={`relative flex items-center justify-center rounded-full overflow-hidden bg-gray-800 border-2 shrink-0 ${isBoss ? 'border-yellow-400 shadow-lg shadow-yellow-500/40' : 'border-gray-600'}`}
      style={{ width: size, height: size }}
    >
      {url ? (
        <img src={url} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="font-black text-gray-300" style={{ fontSize: size * 0.35 }}>{initials}</span>
      )}
      {isBoss && (
        <div className="absolute -top-1 -right-1 text-lg leading-none">👑</div>
      )}
    </div>
  )
}

export default function JourneyPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [opponents, setOpponents] = useState<Opponent[]>([])
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [decks, setDecks] = useState<Deck[]>([])
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pickingFor, setPickingFor] = useState<Opponent | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const [opponentsRes, progressRes, decksRes] = await Promise.all([
        fetch('/api/admin/journey'),
        fetch('/api/game/journey/progress'),
        supabase.from('decks').select('id, name, card_ids').eq('user_id', user.id).order('created_at', { ascending: false }),
      ])

      if (opponentsRes.ok) {
        const d = await opponentsRes.json()
        setOpponents(d.opponents ?? [])
      }
      if (progressRes.ok) {
        const d = await progressRes.json()
        setCompletedIds(d.completedOpponentIds ?? [])
      }
      if (decksRes.data) {
        const valid = (decksRes.data as Deck[]).filter(d => d.card_ids.length === 20)
        setDecks(valid)
        if (valid.length === 1) setSelectedDeckId(valid[0].id)
      }

      setLoading(false)
    }
    load()
  }, [supabase, router])

  function handlePlay(opponent: Opponent) {
    if (!selectedDeckId) {
      setPickingFor(opponent)
      return
    }
    launch(opponent, selectedDeckId)
  }

  function launch(opponent: Opponent, deckId: string) {
    const params = new URLSearchParams({
      journeyOpponentId: opponent.id,
      opponentName: opponent.name,
      difficulty: opponent.difficulty,
      coinsReward: String(opponent.coins_reward),
      deckId,
      ...(opponent.avatar_url ? { opponentAvatar: opponent.avatar_url } : {}),
    })
    router.push(`/game/practice?${params.toString()}`)
  }

  function getStageStatus(opponent: Opponent, index: number): 'completed' | 'available' | 'locked' {
    if (completedIds.includes(opponent.id)) return 'completed'
    if (index === 0) return 'available'
    const prev = opponents[index - 1]
    if (prev && completedIds.includes(prev.id)) return 'available'
    return 'locked'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading journey…</p>
        </div>
      </div>
    )
  }

  const totalCoins = opponents
    .filter(o => completedIds.includes(o.id))
    .reduce((sum, o) => sum + o.coins_reward, 0)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-4">
        <Link href="/play" className="text-gray-400 hover:text-white text-sm transition">← Back</Link>
        <h1 className="text-xl font-bold flex-1">Single Player Journey</h1>
        <div className="flex items-center gap-1.5 text-yellow-300 text-sm font-semibold">
          <CoinIcon size={16} />
          <span>{totalCoins} earned</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-6 pb-24">

        {/* Deck selector */}
        {decks.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center mb-8">
            <p className="text-gray-400 mb-4">Build a 20-card deck to play the journey.</p>
            <Link href="/deck-builder" className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-semibold transition">
              Deck Builder
            </Link>
          </div>
        ) : decks.length > 1 && (
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Your Deck</p>
            <div className="flex gap-2 flex-wrap">
              {decks.map(d => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDeckId(d.id)}
                  className={`px-4 py-2 rounded-xl border-2 text-sm font-medium transition ${
                    selectedDeckId === d.id ? 'border-blue-500 bg-blue-900/30 text-white' : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {opponents.length === 0 && (
          <div className="text-center text-gray-500 py-16">
            <p className="text-5xl mb-4">🗺</p>
            <p className="text-lg font-semibold text-gray-400">Journey coming soon!</p>
            <p className="text-sm mt-1">No opponents have been set up yet.</p>
          </div>
        )}

        {/* Stage path */}
        <div className="relative">
          {opponents.map((opponent, index) => {
            const status = getStageStatus(opponent, index)
            const isLocked = status === 'locked'
            const isCompleted = status === 'completed'
            const isAvailable = status === 'available'

            return (
              <div key={opponent.id} className="relative">
                {/* Connector line */}
                {index < opponents.length - 1 && (
                  <div className="absolute left-10 top-full w-0.5 h-6 z-0"
                    style={{ background: isCompleted ? '#22c55e' : '#374151' }}
                  />
                )}

                <div className={`relative z-10 flex items-center gap-4 mb-6 p-4 rounded-2xl border-2 transition ${
                  isCompleted ? 'border-green-700 bg-green-950/30' :
                  isAvailable ? opponent.is_boss ? 'border-yellow-500 bg-yellow-950/20 shadow-lg shadow-yellow-900/30' : 'border-gray-600 bg-gray-900 hover:border-blue-600 hover:bg-gray-800' :
                  'border-gray-800 bg-gray-900/50 opacity-50'
                }`}>
                  {/* Stage number */}
                  <div className="absolute -left-3 -top-3 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10"
                    style={{ background: isCompleted ? '#16a34a' : isAvailable ? '#2563eb' : '#374151' }}>
                    {index + 1}
                  </div>

                  <AvatarOrFallback url={opponent.avatar_url} name={opponent.name} size={64} isBoss={opponent.is_boss} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-lg leading-tight">{opponent.name}</p>
                      {opponent.is_boss && <span className="text-xs bg-yellow-800/60 text-yellow-300 px-2 py-0.5 rounded-full font-semibold">BOSS</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                      <span>{DIFF_ICON[opponent.difficulty]} {DIFF_LABEL[opponent.difficulty]}</span>
                      <span className="flex items-center gap-1">
                        <CoinIcon size={13} />
                        {opponent.coins_reward}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isCompleted ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-2xl">✅</span>
                        <button
                          onClick={() => handlePlay(opponent)}
                          disabled={decks.length === 0}
                          className="text-xs text-gray-500 hover:text-gray-300 transition"
                        >
                          Replay
                        </button>
                      </div>
                    ) : isAvailable ? (
                      <button
                        onClick={() => handlePlay(opponent)}
                        disabled={decks.length === 0}
                        className={`px-4 py-2 rounded-xl font-bold text-sm transition disabled:opacity-40 ${
                          opponent.is_boss
                            ? 'bg-yellow-600 hover:bg-yellow-500 text-black shadow-lg shadow-yellow-900/40'
                            : 'bg-blue-600 hover:bg-blue-500'
                        }`}
                      >
                        {opponent.is_boss ? '⚔ Fight!' : 'Play'}
                      </button>
                    ) : (
                      <span className="text-2xl text-gray-700">🔒</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Deck picker modal for when no deck is pre-selected */}
        {pickingFor && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setPickingFor(null)}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-4">Choose a deck to face {pickingFor.name}</h2>
              <div className="space-y-2">
                {decks.map(d => (
                  <button
                    key={d.id}
                    onClick={() => { setSelectedDeckId(d.id); launch(pickingFor, d.id); setPickingFor(null) }}
                    className="w-full text-left p-4 rounded-xl border-2 border-gray-700 bg-gray-800 hover:border-blue-500 transition"
                  >
                    <p className="font-bold">{d.name}</p>
                    <p className="text-xs text-gray-500">{d.card_ids.length} cards</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
