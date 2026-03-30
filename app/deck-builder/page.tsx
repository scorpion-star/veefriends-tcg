'use client'

import { useState, useEffect, useMemo } from 'react'
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
  rarity: 'Core' | 'Rare' | 'Very Rare' | 'Epic' | 'Spectacular'
  rarity_points: number
  image_url: string | null
}

type Deck = {
  id: string
  user_id: string
  name: string
  card_ids: number[]
  created_at: string
}

const RARITY_BORDER: Record<string, string> = {
  Core: 'border-gray-500',
  Rare: 'border-green-500',
  'Very Rare': 'border-purple-500',
  Epic: 'border-orange-500',
  Spectacular: 'border-yellow-400',
}

const RARITY_BADGE: Record<string, string> = {
  Core: 'bg-gray-700 text-gray-300',
  Rare: 'bg-green-800 text-green-300',
  'Very Rare': 'bg-purple-800 text-purple-300',
  Epic: 'bg-orange-800 text-orange-300',
  Spectacular: 'bg-yellow-800 text-yellow-300',
}

const MAX_CARDS = 20
const MAX_RP = 15

export default function DeckBuilder() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [collection, setCollection] = useState<Card[]>([])
  const [deckCardIds, setDeckCardIds] = useState<number[]>([])
  const [savedDecks, setSavedDecks] = useState<Deck[]>([])
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null)
  const [deckName, setDeckName] = useState('My Deck')
  const [search, setSearch] = useState('')
  const [rarityFilter, setRarityFilter] = useState<string>('All')
  const [minScore, setMinScore] = useState<string>('')
  const [maxScore, setMaxScore] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUserId(user.id)

      // Load collection
      const { data: inv } = await supabase
        .from('user_inventory')
        .select('card_id')
        .eq('user_id', user.id)

      if (inv && inv.length > 0) {
        const cardIds = inv.map((i: { card_id: number }) => i.card_id)
        const { data: cards } = await supabase
          .from('cards')
          .select('*')
          .in('id', cardIds)
          .order('name')
        if (cards) setCollection(cards as Card[])
      }

      // Load saved decks
      const { data: decks } = await supabase
        .from('decks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (decks) setSavedDecks(decks as Deck[])

      setLoading(false)
    }
    load()
  }, [supabase, router])

  // Derived state
  const deckCards = useMemo(
    () => deckCardIds.map(id => collection.find(c => c.id === id)).filter(Boolean) as Card[],
    [deckCardIds, collection]
  )
  const totalRP = useMemo(() => deckCards.reduce((sum, c) => sum + c.rarity_points, 0), [deckCards])
  const isValid = deckCards.length === MAX_CARDS && totalRP <= MAX_RP

  const validationErrors = useMemo(() => {
    const errs: string[] = []
    if (deckCards.length < MAX_CARDS) errs.push(`Add ${MAX_CARDS - deckCards.length} more card${MAX_CARDS - deckCards.length !== 1 ? 's' : ''}`)
    else if (deckCards.length > MAX_CARDS) errs.push(`Remove ${deckCards.length - MAX_CARDS} card${deckCards.length - MAX_CARDS !== 1 ? 's' : ''}`)
    if (totalRP > MAX_RP) errs.push(`Over RP limit by ${totalRP - MAX_RP}`)
    return errs
  }, [deckCards, totalRP])

  const filteredCollection = useMemo(() => {
    const min = minScore !== '' ? Number(minScore) : null
    const max = maxScore !== '' ? Number(maxScore) : null
    const filtered = collection.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase())
      const matchesRarity = rarityFilter === 'All' || c.rarity === rarityFilter
      const matchesMin = min === null || c.total_score >= min
      const matchesMax = max === null || c.total_score <= max
      return matchesSearch && matchesRarity && matchesMin && matchesMax
    })
    // Push already-added cards to the bottom
    return filtered.sort((a, b) => {
      const aIn = deckCardIds.includes(a.id) ? 1 : 0
      const bIn = deckCardIds.includes(b.id) ? 1 : 0
      return aIn - bIn
    })
  }, [collection, deckCardIds, search, rarityFilter, minScore, maxScore])

  function addCard(card: Card) {
    if (deckCardIds.includes(card.id)) return
    if (deckCardIds.length >= MAX_CARDS) return
    setDeckCardIds(prev => [...prev, card.id])
  }

  function removeCard(cardId: number) {
    setDeckCardIds(prev => prev.filter(id => id !== cardId))
  }

  function loadDeck(deck: Deck) {
    setActiveDeckId(deck.id)
    setDeckName(deck.name)
    setDeckCardIds([...deck.card_ids])
  }

  function newDeck() {
    setActiveDeckId(null)
    setDeckName('My Deck')
    setDeckCardIds([])
  }

  async function saveDeck() {
    if (!userId || !deckName.trim()) return
    if (!activeDeckId && savedDecks.length >= 10) {
      alert('You can only save up to 10 decks. Delete one to make room.')
      return
    }
    setSaving(true)

    if (activeDeckId) {
      const { error } = await supabase
        .from('decks')
        .update({ name: deckName.trim(), card_ids: deckCardIds })
        .eq('id', activeDeckId)
      if (!error) {
        setSavedDecks(prev =>
          prev.map(d => d.id === activeDeckId ? { ...d, name: deckName.trim(), card_ids: deckCardIds } : d)
        )
      }
    } else {
      const { data, error } = await supabase
        .from('decks')
        .insert({ user_id: userId, name: deckName.trim(), card_ids: deckCardIds })
        .select()
        .single()
      if (!error && data) {
        setSavedDecks(prev => [data as Deck, ...prev])
        setActiveDeckId(data.id)
      }
    }

    setSaving(false)
  }

  function requestDelete(deckId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setConfirmDeleteId(deckId)
  }

  async function confirmDelete() {
    if (!confirmDeleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/decks/${confirmDeleteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        alert(json.error ?? 'Failed to delete deck.')
        return
      }
      setSavedDecks(prev => prev.filter(d => d.id !== confirmDeleteId))
      if (activeDeckId === confirmDeleteId) newDeck()
    } catch {
      alert('Network error. Try again.')
    } finally {
      setDeleting(false)
      setConfirmDeleteId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🃏</div>
          <p className="text-gray-400">Loading your collection...</p>
        </div>
      </div>
    )
  }

  const cardCountPct = Math.min(100, (deckCards.length / MAX_CARDS) * 100)
  const rpPct = Math.min(100, (totalRP / MAX_RP) * 100)

  const deckToDelete = savedDecks.find(d => d.id === confirmDeleteId)

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* ── Delete confirmation dialog ── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center p-6">
          <div className="bg-gray-900 border border-red-900/60 rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center">
            <div className="text-4xl mb-4">🗑️</div>
            <h2 className="text-xl font-bold text-white mb-2">Delete Deck?</h2>
            <p className="text-gray-400 text-sm mb-6">
              Are you sure you want to delete <span className="text-white font-semibold">{deckToDelete?.name}</span>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition disabled:opacity-40"
              >
                No, Keep It
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold transition disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top nav */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-white text-sm transition">← Home</Link>
          <span className="text-gray-700">|</span>
          <h1 className="text-xl font-bold">Deck Builder</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/collection" className="text-sm text-gray-400 hover:text-white transition px-3 py-2">
            Collection
          </Link>
          <Link
            href="/play"
            className="bg-blue-600 hover:bg-blue-700 text-sm font-semibold px-4 py-2 rounded-xl transition"
          >
            Play →
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT SIDEBAR ── */}
        <aside className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
          {/* Saved decks section */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Saved Decks</h2>
              <button
                onClick={newDeck}
                className="text-xs text-blue-400 hover:text-blue-300 transition font-medium"
              >
                + New Deck
              </button>
            </div>

            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {savedDecks.length === 0 && (
                <p className="text-xs text-gray-600 italic">No decks saved yet</p>
              )}
              {savedDecks.map(deck => (
                <div
                  key={deck.id}
                  onClick={() => loadDeck(deck)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition text-sm ${
                    activeDeckId === deck.id
                      ? 'bg-blue-900/60 border border-blue-600'
                      : 'bg-gray-800 border border-transparent hover:border-amber-700/50 hover:shadow-sm hover:shadow-amber-900/20'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{deck.name}</p>
                    <p className="text-xs text-gray-500">{deck.card_ids.length}/20 cards</p>
                  </div>
                  <button
                    onClick={(e) => requestDelete(deck.id, e)}
                    className="text-gray-600 hover:text-red-400 transition ml-2 shrink-0 text-base"
                    title="Delete deck"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Collection filter/search */}
          <div className="p-4 border-b border-gray-800 space-y-2">
            <input
              type="text"
              placeholder="Search cards..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder-gray-600"
            />
            <select
              value={rarityFilter}
              onChange={e => setRarityFilter(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-gray-300"
            >
              {['All', 'Core', 'Rare', 'Very Rare', 'Epic', 'Spectacular'].map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="flex gap-1.5 items-center">
              <input
                type="number"
                value={minScore}
                onChange={e => setMinScore(e.target.value)}
                placeholder="Min score"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none focus:border-yellow-500 placeholder-gray-600 text-yellow-400 w-0"
              />
              <span className="text-gray-600 text-xs shrink-0">–</span>
              <input
                type="number"
                value={maxScore}
                onChange={e => setMaxScore(e.target.value)}
                placeholder="Max score"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none focus:border-yellow-500 placeholder-gray-600 text-yellow-400 w-0"
              />
            </div>
          </div>

          {/* Collection cards list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            <p className="text-xs text-gray-600 uppercase tracking-wider px-1 mb-2">
              Collection ({filteredCollection.length})
            </p>
            {filteredCollection.length === 0 && (
              <p className="text-xs text-gray-600 italic px-1">No cards match filters</p>
            )}
            {filteredCollection.map(card => {
              const inDeck = deckCardIds.includes(card.id)
              const deckFull = deckCardIds.length >= MAX_CARDS
              const disabled = inDeck || deckFull
              return (
                <button
                  key={card.id}
                  onClick={() => addCard(card)}
                  disabled={disabled}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition border text-sm ${
                    inDeck
                      ? 'bg-gray-900 border-gray-800 opacity-40 cursor-not-allowed'
                      : deckFull
                      ? 'bg-gray-800 border-gray-700 opacity-60 cursor-not-allowed'
                      : 'bg-gray-800 border-gray-700 hover:border-blue-500 hover:bg-gray-700 active:scale-95'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg overflow-hidden shrink-0 border ${RARITY_BORDER[card.rarity]}`}>
                    {card.image_url ? (
                      <img src={card.image_url} alt={card.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-700 flex items-center justify-center text-base">🃏</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate leading-tight">{card.name}</p>
                    <div className="mt-1">
                      <CardStats totalScore={card.total_score} aura={card.aura} skill={card.skill} stamina={card.stamina} size="sm" />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* ── MAIN: DECK AREA ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Deck header / stats */}
          <div className="bg-gray-900/50 border-b border-gray-800 p-5 shrink-0">
            <div className="flex flex-wrap items-start gap-4">
              {/* Deck name input */}
              <div className="flex-1 min-w-48">
                <input
                  type="text"
                  value={deckName}
                  onChange={e => setDeckName(e.target.value)}
                  placeholder="Deck name..."
                  className="bg-transparent text-2xl font-bold focus:outline-none border-b-2 border-gray-700 focus:border-blue-500 pb-1 w-full transition placeholder-gray-700"
                />
                {activeDeckId && (
                  <p className="text-xs text-gray-600 mt-1">Editing saved deck</p>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-5">
                {/* Card count meter */}
                <div className="text-center">
                  <div className={`text-3xl font-black tabular-nums ${
                    deckCards.length === MAX_CARDS ? 'text-green-400' :
                    deckCards.length > MAX_CARDS ? 'text-red-400' : 'text-blue-400'
                  }`}>
                    {deckCards.length}
                    <span className="text-base font-normal text-gray-600">/{MAX_CARDS}</span>
                  </div>
                  <div className="w-24 h-1.5 bg-gray-800 rounded-full mt-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        deckCards.length > MAX_CARDS ? 'bg-red-500' :
                        deckCards.length === MAX_CARDS ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${cardCountPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Cards</p>
                </div>

                {/* RP meter */}
                <div className="text-center">
                  <div className={`text-3xl font-black tabular-nums ${
                    totalRP > MAX_RP ? 'text-red-400' :
                    totalRP === MAX_RP ? 'text-yellow-400' : 'text-purple-400'
                  }`}>
                    {totalRP}
                    <span className="text-base font-normal text-gray-600">/{MAX_RP}</span>
                  </div>
                  <div className="w-24 h-1.5 bg-gray-800 rounded-full mt-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        totalRP > MAX_RP ? 'bg-red-500' : 'bg-purple-500'
                      }`}
                      style={{ width: `${rpPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">RP</p>
                </div>

                {/* Validation status */}
                <div className="flex flex-col gap-1.5 min-w-36">
                  {validationErrors.length > 0 ? (
                    validationErrors.map(err => (
                      <div key={err} className="text-xs bg-red-900/40 border border-red-800/60 text-red-400 px-2.5 py-1 rounded-lg">
                        ⚠ {err}
                      </div>
                    ))
                  ) : (
                    <div className="text-xs bg-green-900/40 border border-green-800/60 text-green-400 px-2.5 py-1 rounded-lg">
                      ✓ Deck is valid!
                    </div>
                  )}
                </div>
              </div>

              {/* Save button */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={saveDeck}
                  disabled={saving || !deckName.trim() || (!activeDeckId && savedDecks.length >= 10)}
                  className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    isValid
                      ? 'bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/30 hover:shadow-green-500/40 hover:shadow-lg'
                      : 'bg-blue-700 hover:bg-blue-600 hover:shadow-blue-500/30 hover:shadow-md'
                  }`}
                  title={!activeDeckId && savedDecks.length >= 10 ? 'Deck limit reached (10/10)' : undefined}
                >
                  {saving ? 'Saving...' : isValid ? '✓ Save Deck' : 'Save Draft'}
                </button>
                {!activeDeckId && savedDecks.length >= 10 && (
                  <p className="text-xs text-red-400 text-center">Deck limit reached (10/10)</p>
                )}
                {deckCards.length > 0 && (
                  <button
                    onClick={() => setDeckCardIds([])}
                    className="px-5 py-1.5 rounded-xl text-xs text-gray-500 hover:text-red-400 hover:bg-gray-800 transition"
                  >
                    Clear deck
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Deck cards grid */}
          <div className="flex-1 overflow-y-auto p-5">
            {deckCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-7xl mb-5 opacity-20">🃏</div>
                <h3 className="text-xl font-semibold text-gray-500 mb-2">Your deck is empty</h3>
                <p className="text-gray-600 text-sm max-w-xs">
                  Click any card from your collection on the left to add it. Build a 20-card deck with max 15 Rarity Points.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                  {deckCards.map((card) => (
                    <div
                      key={card.id}
                      className={`relative group cursor-pointer rounded-2xl overflow-hidden border-2 ${RARITY_BORDER[card.rarity]} hover:scale-105 hover:shadow-xl transition-all`}
                      onClick={() => removeCard(card.id)}
                      title={`Remove ${card.name}`}
                    >
                      {/* Remove overlay */}
                      <div className="absolute inset-0 z-10 bg-red-950/0 group-hover:bg-red-950/70 transition-colors rounded-2xl flex items-center justify-center">
                        <span className="text-white font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          Remove
                        </span>
                      </div>

                      {/* Card image */}
                      <div className="aspect-[3/4] bg-gray-800 overflow-hidden">
                        {card.image_url ? (
                          <img
                            src={card.image_url}
                            alt={card.name}
                            className="w-full h-full object-cover"
                            onError={e => { e.currentTarget.style.display = 'none' }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl bg-gray-800">🃏</div>
                        )}
                      </div>

                      {/* Card info */}
                      <div className="bg-gray-900 p-1.5">
                        <p className="text-xs font-bold truncate leading-tight">{card.name}</p>
                        <div className="mt-1">
                          <CardStats totalScore={card.total_score} aura={card.aura} skill={card.skill} stamina={card.stamina} size="sm" />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Empty card slots */}
                  {Array.from({ length: Math.max(0, MAX_CARDS - deckCards.length) }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="rounded-2xl border-2 border-dashed border-gray-800 aspect-[3/4] flex items-center justify-center opacity-30"
                    >
                      <span className="text-gray-700 text-xl">+</span>
                    </div>
                  ))}
                </div>

                {/* Rarity breakdown */}
                <div className="mt-6 flex gap-3 flex-wrap">
                  {(['Core', 'Rare', 'Very Rare', 'Epic', 'Spectacular'] as const).map(rarity => {
                    const count = deckCards.filter(c => c.rarity === rarity).length
                    if (count === 0) return null
                    return (
                      <div
                        key={rarity}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-medium ${RARITY_BADGE[rarity]} bg-opacity-20 border-opacity-40`}
                        style={{ borderColor: 'currentColor' }}
                      >
                        {rarity}: {count}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
