'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import CoinIcon from '@/app/components/CoinIcon'

type Opponent = {
  id: string
  name: string
  avatar_url: string | null
  difficulty: number
  is_boss: boolean
  coins_reward: number
  stage_order: number
  section: number
  position_x: number
  position_y: number
}

type Deck = { id: string; name: string; card_ids: number[] }
type Status = 'completed' | 'available' | 'locked'

function difficultyLabel(d: number): string {
  if (d <= 2) return '🟢 Novice'
  if (d <= 4) return '🟡 Easy'
  if (d <= 6) return '🟠 Medium'
  if (d <= 8) return '🔴 Hard'
  return '💀 Expert'
}
const TOTAL_MAPS = 10

export default function JourneyPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [opponents, setOpponents] = useState<Opponent[]>([])
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [decks, setDecks] = useState<Deck[]>([])
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [mapImages, setMapImages] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Opponent | null>(null)
  const [showDeckPicker, setShowDeckPicker] = useState(false)
  const [currentSection, setCurrentSection] = useState(1)
  const mapAreaRef = useRef<HTMLDivElement>(null)
  const mapImgRef = useRef<HTMLImageElement>(null)
  const [imgBounds, setImgBounds] = useState<{ offsetLeft: number; offsetTop: number; renderedWidth: number; renderedHeight: number } | null>(null)

  function computeImgBounds() {
    const img = mapImgRef.current
    const area = mapAreaRef.current
    if (!img || !area || !img.naturalWidth) return
    const aW = area.clientWidth, aH = area.clientHeight
    const scale = Math.min(aW / img.naturalWidth, aH / img.naturalHeight)
    setImgBounds({
      offsetLeft: (aW - img.naturalWidth * scale) / 2,
      offsetTop: (aH - img.naturalHeight * scale) / 2,
      renderedWidth: img.naturalWidth * scale,
      renderedHeight: img.naturalHeight * scale,
    })
  }

  useEffect(() => {
    setImgBounds(null)
  }, [currentSection])

  useEffect(() => {
    window.addEventListener('resize', computeImgBounds)
    return () => window.removeEventListener('resize', computeImgBounds)
  }, []) // eslint-disable-line

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

      let loadedOpponents: Opponent[] = []
      let loadedCompleted: string[] = []

      if (opponentsRes.ok) {
        const d = await opponentsRes.json()
        loadedOpponents = d.opponents ?? []
        setOpponents(loadedOpponents)
      }
      if (progressRes.ok) {
        const d = await progressRes.json()
        loadedCompleted = d.completedOpponentIds ?? []
        setCompletedIds(loadedCompleted)
      }
      if (settingsRes.ok) {
        const d = await settingsRes.json()
        const images: Record<number, string> = {}
        for (let i = 1; i <= TOTAL_MAPS; i++) {
          if (d[`map_${i}`]) images[i] = d[`map_${i}`]
        }
        // Fallback: use /journey-map.png for section 1 if no upload yet
        if (!images[1]) images[1] = '/journey-map.png'
        setMapImages(images)
      }
      if (decksRes.data) {
        const valid = (decksRes.data as Deck[]).filter(d => d.card_ids.length === 20)
        setDecks(valid)
        if (valid.length === 1) setSelectedDeckId(valid[0].id)
      }

      // Auto-navigate to the player's current active section
      if (loadedOpponents.length > 0) {
        const activeSection = getActiveSection(loadedOpponents, loadedCompleted)
        setCurrentSection(activeSection)
      }

      setLoading(false)
    }
    load()
  }, [supabase, router]) // eslint-disable-line react-hooks/exhaustive-deps

  function getStatus(opponent: Opponent, flatIndex: number): Status {
    if (completedIds.includes(opponent.id)) return 'completed'
    if (flatIndex === 0) return 'available'
    const prev = opponents[flatIndex - 1]
    if (prev && completedIds.includes(prev.id)) return 'available'
    return 'locked'
  }

  // Returns the lowest section that has any available (not yet beaten) opponent
  function getActiveSection(opps: Opponent[], completed: string[]): number {
    for (let i = 0; i < opps.length; i++) {
      const o = opps[i]
      if (!completed.includes(o.id)) {
        // available if first or previous completed
        if (i === 0 || completed.includes(opps[i - 1].id)) {
          return o.section ?? 1
        }
      }
    }
    // All done — stay on last section
    return opps[opps.length - 1]?.section ?? 1
  }

  function isSectionUnlocked(section: number): boolean {
    if (section === 1) return true
    // Unlocked if all opponents in the previous section are completed
    const prevOpponents = opponents.filter(o => (o.section ?? 1) === section - 1)
    if (prevOpponents.length === 0) return true
    return prevOpponents.every(o => completedIds.includes(o.id))
  }

  function handleNodeClick(opponent: Opponent, status: Status) {
    if (status === 'locked') return
    setShowDeckPicker(false)
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
      difficulty: String(opponent.difficulty),
      coinsReward: String(opponent.coins_reward),
      deckId,
      ...(opponent.avatar_url ? { opponentAvatar: opponent.avatar_url } : {}),
    })
    router.push(`/game/practice?${params.toString()}`)
  }

  const totalCoins = opponents.filter(o => completedIds.includes(o.id)).reduce((s, o) => s + o.coins_reward, 0)
  const sectionOpponents = opponents.filter(o => (o.section ?? 1) === currentSection)
  const mapUrl = mapImages[currentSection] ?? null

  // Section progress
  const sectionCompleted = sectionOpponents.filter(o => completedIds.includes(o.id)).length

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
    <div className="h-screen overflow-hidden bg-gray-950 text-white flex flex-col">
      {/* Top bar: back, map nav, coins, deck picker */}
      <div className="shrink-0 z-20 relative">
        <div className="bg-gray-900/90 backdrop-blur-sm border-b border-gray-800 px-3 py-2 flex items-center gap-2">
          <Link href="/play" className="text-gray-400 hover:text-white text-sm transition px-1">←</Link>

          <button
            onClick={() => setCurrentSection(s => Math.max(1, s - 1))}
            disabled={currentSection === 1}
            className="p-1.5 text-gray-400 hover:text-white disabled:opacity-20 transition text-lg leading-none"
          >‹</button>

          <div className="flex-1 text-center">
            <p className="text-sm font-bold text-white leading-tight">Map {currentSection} <span className="text-gray-500 font-normal">/ {TOTAL_MAPS}</span></p>
            {sectionOpponents.length > 0 && (
              <p className="text-xs text-gray-500 leading-tight">{sectionCompleted}/{sectionOpponents.length} defeated</p>
            )}
          </div>

          <button
            onClick={() => setCurrentSection(s => Math.min(TOTAL_MAPS, s + 1))}
            disabled={currentSection === TOTAL_MAPS || !isSectionUnlocked(currentSection + 1)}
            className="p-1.5 text-gray-400 hover:text-white disabled:opacity-20 transition text-lg leading-none"
          >›</button>

          <div className="flex items-center gap-1 text-yellow-300 text-sm font-semibold px-1">
            <CoinIcon size={14} />
            <span>{totalCoins}</span>
          </div>
        </div>

        {decks.length > 1 && (
          <div className="bg-gray-900 border-b border-gray-800 px-3 py-1.5 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs text-gray-500 uppercase tracking-wider shrink-0">Deck:</span>
            {decks.map(d => (
              <button key={d.id} onClick={() => setSelectedDeckId(d.id)}
                className={`px-3 py-1 rounded-lg border text-xs font-medium transition shrink-0 ${
                  selectedDeckId === d.id ? 'border-blue-500 bg-blue-900/30 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}>
                {d.name}
              </button>
            ))}
          </div>
        )}
        {decks.length === 0 && (
          <div className="bg-amber-950/60 border-b border-amber-800 px-4 py-2 text-xs text-amber-300 flex items-center gap-3">
            <span>You need a 20-card deck to play.</span>
            <Link href="/deck-builder" className="underline font-semibold hover:text-white transition">Build one →</Link>
          </div>
        )}
      </div>

      {/* Map area */}
      <div ref={mapAreaRef} className="flex-1 relative overflow-hidden">
        {mapUrl ? (
          <img
            ref={mapImgRef}
            src={mapUrl}
            alt={`Map ${currentSection}`}
            className="absolute inset-0 w-full h-full object-contain"
            draggable={false}
            onLoad={computeImgBounds}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <p className="text-5xl mb-3">🗺</p>
              <p className="text-gray-500 text-sm">Map {currentSection} coming soon</p>
            </div>
          </div>
        )}

        {/* Opponent nodes */}
        {sectionOpponents.map(opponent => {
          const flatIndex = opponents.findIndex(o => o.id === opponent.id)
          const status = getStatus(opponent, flatIndex)
          const x = opponent.position_x ?? 50
          const y = opponent.position_y ?? 50
          const nodeLeft = imgBounds ? `${imgBounds.offsetLeft + (x / 100) * imgBounds.renderedWidth}px` : `${x}%`
          const nodeTop = imgBounds ? `${imgBounds.offsetTop + (y / 100) * imgBounds.renderedHeight}px` : `${y}%`

          return (
            <button
              key={opponent.id}
              onClick={() => handleNodeClick(opponent, status)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 transition-transform ${
                status === 'locked' ? 'cursor-default' : 'hover:scale-110 active:scale-95'
              }`}
              style={{ left: nodeLeft, top: nodeTop }}
            >
              <div className={`relative rounded-full border-4 overflow-hidden shadow-xl transition ${
                status === 'completed' ? 'border-green-400 shadow-green-500/40' :
                status === 'available'
                  ? opponent.is_boss ? 'border-yellow-400 shadow-yellow-500/60' : 'border-white shadow-blue-400/40'
                  : 'border-gray-600 opacity-50'
              }`} style={{ width: opponent.is_boss ? 64 : 52, height: opponent.is_boss ? 64 : 52 }}>
                {opponent.avatar_url ? (
                  <img src={opponent.avatar_url} alt={opponent.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center text-sm font-black text-gray-300">
                    {opponent.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                )}
                {status === 'completed' && (
                  <div className="absolute inset-0 bg-green-900/60 flex items-center justify-center text-xl">✅</div>
                )}
                {status === 'locked' && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-lg">🔒</div>
                )}
                {opponent.is_boss && status === 'available' && (
                  <div className="absolute -top-1 -right-1 text-base leading-none">👑</div>
                )}
              </div>

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

        {sectionOpponents.length === 0 && mapUrl && (
          <div className="absolute inset-0 flex items-end justify-center pb-8 pointer-events-none">
            <div className="bg-gray-900/80 px-4 py-2 rounded-xl text-sm text-gray-400">
              No opponents placed on this map yet
            </div>
          </div>
        )}
      </div>

      {/* Battle confirmation modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => { setSelected(null); setShowDeckPicker(false) }}>
          <div
            className={`bg-gray-900 rounded-3xl border-2 p-8 max-w-sm w-full text-center shadow-2xl ${
              selected.is_boss ? 'border-yellow-500 shadow-yellow-900/50' : 'border-gray-700'
            }`}
            onClick={e => e.stopPropagation()}
          >
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
              <span>{difficultyLabel(selected.difficulty)}</span>
              <span className="flex items-center gap-1">
                <CoinIcon size={13} />
                {selected.coins_reward} coin{selected.coins_reward !== 1 ? 's' : ''}
              </span>
            </div>

            <p className={`text-lg font-semibold mb-6 ${selected.is_boss ? 'text-yellow-300' : 'text-gray-200'}`}>
              Ready for the challenge?
            </p>

            {showDeckPicker ? (
              <div className="space-y-2 text-left mb-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Choose your deck</p>
                {decks.map(d => (
                  <button key={d.id}
                    onClick={() => { setSelectedDeckId(d.id); launch(selected, d.id) }}
                    className="w-full text-left px-4 py-3 rounded-xl border-2 border-gray-700 bg-gray-800 hover:border-blue-500 transition">
                    <p className="font-bold text-sm">{d.name}</p>
                    <p className="text-xs text-gray-500">{d.card_ids.length} cards</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-3">
                <button onClick={() => setSelected(null)}
                  className="flex-1 py-3 rounded-2xl bg-gray-800 hover:bg-gray-700 font-semibold transition text-gray-300">
                  Not Yet
                </button>
                <button onClick={handleBattle} disabled={decks.length === 0}
                  className={`flex-1 py-3 rounded-2xl font-black text-lg transition disabled:opacity-40 ${
                    selected.is_boss
                      ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg shadow-yellow-900/50'
                      : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/50'
                  }`}>
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
