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
  section: number
  position_x: number
  position_y: number
}

type Deck = { id: string; name: string; card_ids: number[] }
type Status = 'completed' | 'available' | 'locked'

const DIFF_ICON: Record<Difficulty, string> = { easy: '🟢', medium: '🟡', hard: '🔴' }
const DIFF_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

export default function JourneyPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [opponents, setOpponents] = useState<Opponent[]>([])
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [decks, setDecks] = useState<Deck[]>([])
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [mapImageUrl, setMapImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Opponent | null>(null)
  const [showDeckPicker, setShowDeckPicker] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const [opponentsRes, progressRes, settingsRes, decksRes] = await Promise.all([
        fetch('/api/admin/journey'),
        fetch('/api/game/journey/progress'),
        fetch('/api/admin/journey/settings'),
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
      if (settingsRes.ok) {
        const d = await settingsRes.json()
        if (d.map_image_url) setMapImageUrl(d.map_image_url)
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

  function getStatus(opponent: Opponent, flatIndex: number): Status {
    if (completedIds.includes(opponent.id)) return 'completed'
    if (flatIndex === 0) return 'available'
    const prev = opponents[flatIndex - 1]
    if (prev && completedIds.includes(prev.id)) return 'available'
    return 'locked'
  }

  function handleNodeClick(opponent: Opponent, status: Status) {
    if (status === 'locked') return
    setSelected(opponent)
  }

  function handleBattle() {
    if (!selected) return
    if (!selectedDeckId) { setShowDeckPicker(true); return }
    launch(selected, selectedDeckId)
  }

  function launch(opponent: Opponent, deckId: string) {
    setSelected(null)
    setShowDeckPicker(false)
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

  const totalCoins = opponents.filter(o => completedIds.includes(o.id)).reduce((s, o) => s + o.coins_reward, 0)

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

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-900/90 border-b border-gray-800 px-6 py-3 flex items-center gap-4 shrink-0 z-20 relative">
        <Link href="/play" className="text-gray-400 hover:text-white text-sm transition">← Back</Link>
        <h1 className="text-xl font-bold flex-1">Single Player Journey</h1>
        <div className="flex items-center gap-1.5 text-yellow-300 text-sm font-semibold">
          <CoinIcon size={16} />
          <span>{totalCoins} earned</span>
        </div>
      </header>

      {/* Deck selector bar (only when multiple decks) */}
      {decks.length > 1 && (
        <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center gap-3 shrink-0 z-20 relative overflow-x-auto">
          <span className="text-xs text-gray-500 uppercase tracking-wider shrink-0">Deck:</span>
          {decks.map(d => (
            <button
              key={d.id}
              onClick={() => setSelectedDeckId(d.id)}
              className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition shrink-0 ${
                selectedDeckId === d.id ? 'border-blue-500 bg-blue-900/30 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      {decks.length === 0 && (
        <div className="bg-amber-950/60 border-b border-amber-800 px-6 py-3 text-sm text-amber-300 flex items-center gap-3 shrink-0">
          <span>You need a 20-card deck to play.</span>
          <Link href="/deck-builder" className="underline font-semibold hover:text-white transition">Build one →</Link>
        </div>
      )}

      {/* Map area */}
      <div className="flex-1 overflow-auto relative">
        <div className="relative w-full" style={{ minHeight: '100%' }}>
          {/* Map background */}
          {mapImageUrl ? (
            <img
              src={mapImageUrl}
              alt="Journey Map"
              className="w-full h-auto block"
              draggable={false}
            />
          ) : (
            <div className="w-full bg-gray-900 flex items-center justify-center text-gray-600" style={{ minHeight: '70vh' }}>
              <div className="text-center">
                <p className="text-5xl mb-3">🗺</p>
                <p className="text-gray-500 text-sm">Map coming soon</p>
              </div>
            </div>
          )}

          {/* Opponent nodes */}
          {opponents.map((opponent, flatIndex) => {
            const status = getStatus(opponent, flatIndex)
            const x = opponent.position_x ?? 50
            const y = opponent.position_y ?? 50

            return (
              <button
                key={opponent.id}
                onClick={() => handleNodeClick(opponent, status)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 group transition-transform ${
                  status === 'locked' ? 'cursor-default' : 'hover:scale-110 active:scale-95'
                }`}
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                {/* Avatar ring */}
                <div className={`relative rounded-full border-4 overflow-hidden shadow-xl transition ${
                  status === 'completed' ? 'border-green-400 shadow-green-500/40' :
                  status === 'available' ? opponent.is_boss
                    ? 'border-yellow-400 shadow-yellow-500/60 animate-pulse-slow'
                    : 'border-white shadow-blue-400/40'
                  : 'border-gray-600 opacity-50'
                }`}
                  style={{ width: opponent.is_boss ? 64 : 52, height: opponent.is_boss ? 64 : 52 }}
                >
                  {opponent.avatar_url ? (
                    <img src={opponent.avatar_url} alt={opponent.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center text-sm font-black text-gray-300">
                      {opponent.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  {/* Status overlay */}
                  {status === 'completed' && (
                    <div className="absolute inset-0 bg-green-900/60 flex items-center justify-center text-xl">✅</div>
                  )}
                  {status === 'locked' && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-lg">🔒</div>
                  )}
                  {opponent.is_boss && status !== 'locked' && status !== 'completed' && (
                    <div className="absolute -top-1 -right-1 text-base leading-none">👑</div>
                  )}
                </div>

                {/* Name label */}
                <div className={`px-2 py-0.5 rounded-full text-xs font-bold shadow-lg max-w-[90px] text-center leading-tight ${
                  status === 'locked' ? 'bg-gray-800/80 text-gray-500' :
                  status === 'completed' ? 'bg-green-900/80 text-green-300' :
                  opponent.is_boss ? 'bg-yellow-900/90 text-yellow-200' :
                  'bg-gray-900/90 text-white'
                }`}>
                  {opponent.name}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Battle confirmation modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => { setSelected(null); setShowDeckPicker(false) }}
        >
          <div
            className={`bg-gray-900 rounded-3xl border-2 p-8 max-w-sm w-full text-center shadow-2xl ${
              selected.is_boss ? 'border-yellow-500 shadow-yellow-900/50' : 'border-gray-700'
            }`}
            onClick={e => e.stopPropagation()}
          >
            {/* Opponent avatar */}
            <div className="flex justify-center mb-4">
              <div className={`relative rounded-full overflow-hidden border-4 shadow-xl ${
                selected.is_boss ? 'border-yellow-400 shadow-yellow-500/40' : 'border-gray-500'
              }`} style={{ width: 96, height: 96 }}>
                {selected.avatar_url ? (
                  <img src={selected.avatar_url} alt={selected.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center text-2xl font-black text-gray-300">
                    {selected.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                )}
                {selected.is_boss && (
                  <div className="absolute -top-1 -right-1 text-2xl leading-none">👑</div>
                )}
              </div>
            </div>

            <h2 className="text-2xl font-black mb-1">{selected.name}</h2>
            {selected.is_boss && (
              <p className="text-yellow-400 text-sm font-bold mb-2 uppercase tracking-widest">Boss Battle</p>
            )}
            <div className="flex items-center justify-center gap-4 text-sm text-gray-400 mb-6">
              <span>{DIFF_ICON[selected.difficulty]} {DIFF_LABEL[selected.difficulty]}</span>
              <span className="flex items-center gap-1">
                <CoinIcon size={13} />
                {selected.coins_reward} coin{selected.coins_reward !== 1 ? 's' : ''}
              </span>
            </div>

            <p className={`text-lg font-semibold mb-6 ${selected.is_boss ? 'text-yellow-300' : 'text-gray-200'}`}>
              Ready for the challenge?
            </p>

            {/* Deck picker (shown inline when needed) */}
            {showDeckPicker && (
              <div className="mb-6 space-y-2 text-left">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Choose your deck</p>
                {decks.map(d => (
                  <button
                    key={d.id}
                    onClick={() => { setSelectedDeckId(d.id); launch(selected, d.id) }}
                    className="w-full text-left px-4 py-3 rounded-xl border-2 border-gray-700 bg-gray-800 hover:border-blue-500 transition"
                  >
                    <p className="font-bold text-sm">{d.name}</p>
                    <p className="text-xs text-gray-500">{d.card_ids.length} cards</p>
                  </button>
                ))}
              </div>
            )}

            {!showDeckPicker && (
              <div className="flex gap-3">
                <button
                  onClick={() => setSelected(null)}
                  className="flex-1 py-3 rounded-2xl bg-gray-800 hover:bg-gray-700 font-semibold transition text-gray-300"
                >
                  Not Yet
                </button>
                <button
                  onClick={handleBattle}
                  disabled={decks.length === 0}
                  className={`flex-1 py-3 rounded-2xl font-black text-lg transition disabled:opacity-40 ${
                    selected.is_boss
                      ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg shadow-yellow-900/50'
                      : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/50'
                  }`}
                >
                  ⚔ Battle!
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
