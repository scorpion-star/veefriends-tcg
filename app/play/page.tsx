'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Deck = {
  id: string
  name: string
  card_ids: number[]
}

type MatchStatus = 'idle' | 'queued' | 'matched'
type SelectedMode = 'quick' | 'private' | null

export default function PlayPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [decks, setDecks] = useState<Deck[]>([])
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [selectedMode, setSelectedMode] = useState<SelectedMode>(null)
  const [loading, setLoading] = useState(true)
  const [matchStatus, setMatchStatus] = useState<MatchStatus>('idle')
  const [matchError, setMatchError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Private room state
  const [roomMode, setRoomMode] = useState<'create' | 'join'>('create')
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [roomLoading, setRoomLoading] = useState(false)

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const deckPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('decks')
        .select('id, name, card_ids')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (data) setDecks(data as Deck[])
      setLoading(false)
    }
    load()
  }, [supabase, router])

  // Cleanup queue entry and realtime on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [supabase])

  // Scroll deck picker into view when it appears
  useEffect(() => {
    if (selectedMode && deckPickerRef.current) {
      deckPickerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedMode])

  const validDecks = decks.filter(d => d.card_ids.length === 20)
  const selectedDeck = decks.find(d => d.id === selectedDeckId)

  function selectMode(mode: SelectedMode) {
    setSelectedMode(prev => prev === mode ? null : mode)
    setSelectedDeckId(null)
    setMatchError(null)
    setCreatedRoomCode(null)
    setJoinCode('')
    setRoomMode('create')
  }

  async function handleQuickMatch() {
    if (!selectedDeckId || !userId) return
    setMatchError(null)
    setMatchStatus('queued')

    const res = await fetch('/api/game/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deckId: selectedDeckId, type: 'quick' }),
    })
    const data = await res.json()

    if (!res.ok) {
      setMatchError(data.error || 'Failed to join matchmaking')
      setMatchStatus('idle')
      return
    }

    if (data.status === 'matched') {
      setMatchStatus('matched')
      router.push(`/game/${data.gameId}`)
      return
    }

    // status === 'queued' — subscribe to queue row for game_id update
    const channel = supabase
      .channel('queue_' + userId)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'matchmaking_queue',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const row = payload.new as { game_id: string | null }
        if (row.game_id) {
          setMatchStatus('matched')
          supabase.removeChannel(channel)
          router.push(`/game/${row.game_id}`)
        }
      })
      .subscribe()

    channelRef.current = channel
  }

  async function cancelQueue() {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    if (userId) {
      await fetch('/api/game/cancel-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
    }
    setMatchStatus('idle')
  }

  async function handleCreateRoom() {
    if (!selectedDeckId) return
    setRoomLoading(true)
    setMatchError(null)

    const res = await fetch('/api/game/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deckId: selectedDeckId, type: 'private_create' }),
    })
    const data = await res.json()

    if (!res.ok) {
      setMatchError(data.error || 'Failed to create room')
      setRoomLoading(false)
      return
    }

    setCreatedRoomCode(data.roomCode)
    setRoomLoading(false)

    const channel = supabase
      .channel('room_wait_' + data.gameId)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_sessions',
        filter: `id=eq.${data.gameId}`,
      }, (payload) => {
        const row = payload.new as { status: string; id: string }
        if (row.status === 'active') {
          supabase.removeChannel(channel)
          router.push(`/game/${row.id}`)
        }
      })
      .subscribe()

    channelRef.current = channel
  }

  async function handleJoinRoom() {
    if (!selectedDeckId || !joinCode.trim()) return
    setRoomLoading(true)
    setMatchError(null)

    const res = await fetch('/api/game/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deckId: selectedDeckId, type: 'private_join', roomCode: joinCode.trim() }),
    })
    const data = await res.json()
    setRoomLoading(false)

    if (!res.ok) {
      setMatchError(data.error || 'Room not found')
      return
    }

    router.push(`/game/${data.gameId}`)
  }

  if (loading) {
    return (
      <div className="flex-1 bg-gray-950 flex items-center justify-center text-white">
        <div className="text-4xl animate-pulse">⚔</div>
      </div>
    )
  }

  // Searching for match overlay
  if (matchStatus === 'queued') {
    return (
      <div className="flex-1 bg-gray-950 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-6xl mb-6 animate-spin">⚔</div>
          <h2 className="text-3xl font-bold mb-3">Finding Opponent...</h2>
          <p className="text-gray-400 mb-2">Playing with: <span className="text-white font-semibold">{selectedDeck?.name}</span></p>
          <p className="text-gray-600 text-sm mb-10">Waiting for another player to join the queue</p>
          <button
            onClick={cancelQueue}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 px-8 py-3 rounded-2xl transition"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-950 text-white overflow-hidden min-h-0">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-white text-sm transition">← Home</Link>
          <span className="text-gray-700">|</span>
          <h1 className="text-xl font-bold">⚔ Play</h1>
        </div>
        <Link href="/deck-builder" className="text-sm text-gray-400 hover:text-white transition px-3 py-2">
          Deck Builder
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto min-h-0"><div className="max-w-3xl mx-auto p-8">

        {/* Game mode selection */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
            Choose Game Mode
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Quick Match */}
            <button
              onClick={() => selectMode('quick')}
              className={`p-6 rounded-2xl text-left transition shadow-lg ${
                selectedMode === 'quick'
                  ? 'bg-gradient-to-br from-blue-700 to-purple-700 shadow-blue-500/30 shadow-xl ring-2 ring-blue-400'
                  : 'bg-gradient-to-br from-blue-700/70 to-purple-700/70 hover:from-blue-600 hover:to-purple-600 shadow-blue-900/20 hover:shadow-blue-500/30 hover:shadow-xl'
              }`}
            >
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="text-xl font-bold mb-1">Quick Match</h3>
              <p className="text-blue-200 text-sm">Get matched with a random opponent instantly</p>
            </button>

            {/* Private Room */}
            <button
              onClick={() => selectMode('private')}
              className={`p-6 rounded-2xl text-left transition ${
                selectedMode === 'private'
                  ? 'bg-gray-800 border-2 border-amber-500 shadow-md shadow-amber-900/30'
                  : 'bg-gray-900 hover:bg-gray-800 border-2 border-gray-700 hover:border-amber-600/60 hover:shadow-md hover:shadow-amber-900/20'
              }`}
            >
              <div className="text-3xl mb-3">🔒</div>
              <h3 className="text-xl font-bold mb-1">Private Room</h3>
              <p className="text-gray-400 text-sm">Play with a friend using a room code</p>
            </button>

            {/* Single Player Journey */}
            <Link
              href="/game/journey"
              className="bg-gray-900 hover:bg-gray-800 border-2 border-gray-700 hover:border-yellow-500 hover:shadow-md hover:shadow-yellow-900/30 p-6 rounded-2xl text-left transition block"
            >
              <div className="text-3xl mb-3">🗺</div>
              <h3 className="text-xl font-bold mb-1">Single Player Journey</h3>
              <p className="text-gray-400 text-sm">Face opponents, earn coins, defeat bosses</p>
            </Link>

            {/* Practice vs CPU */}
            <Link
              href="/game/practice"
              className="bg-gray-900 hover:bg-gray-800 border-2 border-gray-700 hover:border-green-500 hover:shadow-md hover:shadow-green-900/30 p-6 rounded-2xl text-left transition block"
            >
              <div className="text-3xl mb-3">🤖</div>
              <h3 className="text-xl font-bold mb-1">Practice vs CPU</h3>
              <p className="text-gray-400 text-sm">Easy · Medium · Hard difficulty</p>
            </Link>
          </div>
        </section>

        {/* Deck picker — shown after selecting Quick Match or Private Room */}
        {selectedMode !== null && (
          <section ref={deckPickerRef} className="border-t border-gray-800 pt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
              Select Your Deck
            </h2>

            {matchError && (
              <div className="mb-4 bg-red-900/40 border border-red-800 text-red-400 rounded-xl px-4 py-3 text-sm">
                {matchError}
              </div>
            )}

            {validDecks.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
                <p className="text-gray-400 mb-4">You don't have any valid decks (20 cards each) yet.</p>
                <Link
                  href="/deck-builder"
                  className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl font-semibold transition"
                >
                  Build a Deck
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {validDecks.map(deck => (
                  <button
                    key={deck.id}
                    onClick={() => { setSelectedDeckId(deck.id); setMatchError(null) }}
                    className={`text-left p-4 rounded-2xl border-2 transition ${
                      selectedDeckId === deck.id
                        ? 'border-blue-500 bg-blue-900/30'
                        : 'border-gray-800 bg-gray-900 hover:border-amber-700/60 hover:shadow-md hover:shadow-amber-900/20'
                    }`}
                  >
                    <p className="font-bold text-lg">{deck.name}</p>
                    <p className="text-sm text-gray-500">{deck.card_ids.length} cards</p>
                  </button>
                ))}
              </div>
            )}

            {/* Quick Match action */}
            {selectedMode === 'quick' && selectedDeckId && (
              <button
                onClick={handleQuickMatch}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 py-4 rounded-2xl font-bold text-lg transition shadow-lg hover:shadow-blue-500/30"
              >
                Find Match
              </button>
            )}

            {/* Private Room action */}
            {selectedMode === 'private' && selectedDeckId && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex gap-3 mb-6">
                  <button
                    onClick={() => { setRoomMode('create'); setCreatedRoomCode(null); setMatchError(null) }}
                    className={`flex-1 py-2 rounded-xl font-medium text-sm transition ${
                      roomMode === 'create' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    Create Room
                  </button>
                  <button
                    onClick={() => { setRoomMode('join'); setCreatedRoomCode(null); setMatchError(null) }}
                    className={`flex-1 py-2 rounded-xl font-medium text-sm transition ${
                      roomMode === 'join' ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    Join Room
                  </button>
                </div>

                {roomMode === 'create' && (
                  <div>
                    {createdRoomCode ? (
                      <div className="text-center">
                        <p className="text-gray-400 mb-3 text-sm">Share this code with your friend:</p>
                        <div className="text-5xl font-black tracking-widest text-blue-400 mb-4 font-mono">
                          {createdRoomCode}
                        </div>
                        <div className="flex items-center justify-center gap-2 text-yellow-400 animate-pulse text-sm">
                          <span className="animate-spin inline-block">⏳</span>
                          Waiting for opponent to join...
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-gray-400 mb-4 text-sm">
                          Create a private room and share the code with a friend.
                        </p>
                        <button
                          onClick={handleCreateRoom}
                          disabled={roomLoading}
                          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-8 py-3 rounded-xl font-semibold transition hover:shadow-blue-400/30 hover:shadow-md"
                        >
                          {roomLoading ? 'Creating...' : 'Create Room'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {roomMode === 'join' && (
                  <div>
                    <p className="text-gray-400 mb-4 text-sm text-center">Enter the 6-letter room code:</p>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={joinCode}
                        onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                        placeholder="XXXXXX"
                        maxLength={6}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest uppercase focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={handleJoinRoom}
                        disabled={roomLoading || joinCode.length < 6}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-6 py-3 rounded-xl font-semibold transition hover:shadow-blue-400/30 hover:shadow-md"
                      >
                        {roomLoading ? 'Joining...' : 'Join'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

      </div></div>
    </div>
  )
}
