'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  GameState, Card, Attribute, PlayerKey,
} from '@/lib/game-types'
import { SFX } from '@/lib/sfx'
import RoundBurst from '@/app/components/RoundBurst'
import CoreCard from '@/app/components/CoreCard'
import { PlayerScoreRow, TieBankSidebar } from '@/app/components/GemBoard'
import { useSettings } from '@/app/components/SettingsContext'

const RARITY_BORDER: Record<string, string> = {
  Core: 'border-yellow-500',
  Rare: 'border-amber-500',
  'Very Rare': 'border-orange-500',
  Epic: 'border-green-500',
  Spectacular: 'border-blue-400',
}

const ATTR_COLOR: Record<Attribute, string> = {
  aura: 'text-red-400',
  skill: 'text-green-400',
  stamina: 'text-yellow-400',
}

const ATTR_BG: Record<Attribute, string> = {
  aura: 'bg-red-700 hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/40',
  skill: 'bg-green-700 hover:bg-green-600 hover:shadow-lg hover:shadow-green-500/40',
  stamina: 'bg-yellow-600 hover:bg-yellow-500 hover:shadow-lg hover:shadow-yellow-500/40',
}

type GameSession = {
  id: string
  player1_id: string
  player2_id: string
  player1_email: string
  player2_email: string
  status: string
  game_state: GameState
}

export default function GameRoomPage() {
  const params = useParams()
  const gameId = params.gameId as string
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { background } = useSettings()

  const [session, setSession] = useState<GameSession | null>(null)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [myEmail, setMyEmail] = useState<string>('')
  const [myUsername, setMyUsername] = useState<string>('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [opponentAvatarUrl, setOpponentAvatarUrl] = useState<string | null>(null)
  const [opponentUsername, setOpponentUsername] = useState<string>('')
  const [cardMap, setCardMap] = useState<Record<number, Card>>({})
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRevealing, setIsRevealing] = useState(false)
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevResKeyRef = useRef<number>(-1)
  const cardMapRef = useRef<Record<number, Card>>({})
  const matchStartPlayedRef = useRef(false)

  useEffect(() => {
    if (!loading && !matchStartPlayedRef.current) {
      matchStartPlayedRef.current = true
      // Small delay gives browser time to settle after the loading transition
      setTimeout(() => SFX.matchStart(), 100)
    }
  }, [loading])

  // Determine role
  const myKey: PlayerKey | null = useMemo(() => {
    if (!session || !myUserId) return null
    if (session.player1_id === myUserId) return 'player1'
    if (session.player2_id === myUserId) return 'player2'
    return null
  }, [session, myUserId])

  const state = session?.game_state ?? null
  const me = state && myKey ? state[myKey] : null
  const opponent: PlayerKey | null = myKey === 'player1' ? 'player2' : myKey === 'player2' ? 'player1' : null
  const them = state && opponent ? state[opponent] : null
  const isAttacker = state && myKey ? state.attacker === myKey : false
  const isCurrentDefender = state && myKey ? state.currentRound.currentDefender === myKey : false

  // Load game and cards
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setMyUserId(user.id)
      setMyEmail(user.email ?? '')

      const [{ data: game }, { data: profile }] = await Promise.all([
        supabase.from('game_sessions').select('*').eq('id', gameId).single(),
        supabase.from('user_profiles').select('avatar_url, username').eq('user_id', user.id).single(),
      ])
      if (profile?.avatar_url) setAvatarUrl(profile.avatar_url)
      if (profile?.username) setMyUsername(profile.username)

      if (!game) { router.push('/play'); return }

      const opponentId = game.player1_id === user.id ? game.player2_id : game.player1_id
      const oppRes = await fetch(`/api/profile/${opponentId}`)
      if (oppRes.ok) {
        const oppProfile = await oppRes.json()
        if (oppProfile.avatarUrl) setOpponentAvatarUrl(oppProfile.avatarUrl)
        if (oppProfile.username)  setOpponentUsername(oppProfile.username)
      }

      setSession(game as GameSession)
      await loadCards(game as GameSession)
      setLoading(false)
    }
    init()
  }, [supabase, gameId, router])

  const loadCards = useCallback(async (game: GameSession) => {
    const gs = game.game_state as GameState
    const ids = new Set<number>()
    gs.player1.deck.forEach(id => ids.add(id))
    gs.player2.deck.forEach(id => ids.add(id))
    gs.player1.graveyard.forEach(id => ids.add(id))
    gs.player2.graveyard.forEach(id => ids.add(id))
    if (gs.player1.currentCard) ids.add(gs.player1.currentCard)
    if (gs.player2.currentCard) ids.add(gs.player2.currentCard)
    if (gs.lastRound) {
      ids.add(gs.lastRound.p1CardId)
      ids.add(gs.lastRound.p2CardId)
    }

    if (ids.size === 0) return

    const { data: cards } = await supabase
      .from('cards')
      .select('*')
      .in('id', [...ids])

    if (cards) {
      const map: Record<number, Card> = {}
      cards.forEach((c: Card) => { map[c.id] = c })
      cardMapRef.current = map
      setCardMap(map)
    }
  }, [supabase])

  // Reveal overlay — fires after any round resolution (win or tie)
  useEffect(() => {
    if (!state) return
    const key = state.turn * 10000 + state.currentRound.tieCount

    if (prevResKeyRef.current === -1) {
      prevResKeyRef.current = key
      return
    }
    if (key !== prevResKeyRef.current) {
      prevResKeyRef.current = key
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
      setIsRevealing(true)
      revealTimerRef.current = setTimeout(() => setIsRevealing(false), 2000)
      if (state.lastRound) {
        if (state.lastRound.winner === 'tie') SFX.tie()
        else state.lastRound.winner === myKey ? SFX.roundWin() : SFX.roundLose()
      }
    }
  }, [state?.turn, state?.currentRound.tieCount]) // eslint-disable-line react-hooks/exhaustive-deps

  // Match over sound
  useEffect(() => {
    if (state?.phase === 'game_over' && myKey) {
      state.winner === myKey ? SFX.matchWin() : SFX.matchLoss()
    }
  }, [state?.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Polling fallback — keeps game in sync if realtime subscription drops
  useEffect(() => {
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('id', gameId)
        .single()
      if (data) {
        setSession(prev => {
          if (!prev) return data as GameSession
          // Never allow a stale read to revert out of game_over
          if (prev.game_state?.phase === 'game_over' && (data as GameSession).game_state?.phase !== 'game_over') return prev
          return data as GameSession
        })
      }
    }, 1500)
    return () => clearInterval(poll)
  }, [supabase, gameId])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('game_' + gameId)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_sessions',
        filter: `id=eq.${gameId}`,
      }, async (payload) => {
        const updated = payload.new as GameSession
        setSession(prev => {
          // Never allow a stale realtime event to revert out of game_over
          if (prev?.game_state?.phase === 'game_over' && updated.game_state?.phase !== 'game_over') return prev
          return updated
        })
        // Load any new cards not yet in our map
        const gs = updated.game_state
        const missing = new Set<number>()
        const allIds = [
          ...gs.player1.deck, ...gs.player2.deck,
          ...gs.player1.graveyard, ...gs.player2.graveyard,
          gs.player1.currentCard, gs.player2.currentCard,
          gs.lastRound?.p1CardId, gs.lastRound?.p2CardId,
        ].filter((id): id is number => id != null)
        allIds.forEach(id => { if (!cardMapRef.current[id]) missing.add(id) })

        if (missing.size > 0) {
          const { data: cards } = await supabase.from('cards').select('*').in('id', [...missing])
          if (cards) {
            setCardMap(prev => {
              const next = { ...prev }
              cards.forEach((c: Card) => { next[c.id] = c })
              cardMapRef.current = next
              return next
            })
          }
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, gameId]) // cardMap intentionally excluded — use cardMapRef to avoid subscription churn

  const doAction = useCallback(async (action: object) => {
    if (acting) return
    setActing(true)
    setError(null)
    try {
      const res = await fetch('/api/game/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, action }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Action failed')
      else if (data.gameState) setSession(prev => prev ? { ...prev, game_state: data.gameState } : prev)
    } finally {
      setActing(false)
    }
  }, [acting, gameId])

  if (loading || !state || !myKey) {
    return <ShuffleOverlay />
  }

  const myCard = me?.currentCard ? cardMap[me.currentCard] : null
  const opponentLabel = opponentUsername || 'Opponent'

  const revealMyCard = state.lastRound ? cardMap[myKey === 'player1' ? state.lastRound.p1CardId : state.lastRound.p2CardId] : null
  const revealTheirCard = state.lastRound ? cardMap[myKey === 'player1' ? state.lastRound.p2CardId : state.lastRound.p1CardId] : null
  const revealMyVal = state.lastRound ? (myKey === 'player1' ? state.lastRound.p1Value : state.lastRound.p2Value) : 0
  const revealTheirVal = state.lastRound ? (myKey === 'player1' ? state.lastRound.p2Value : state.lastRound.p1Value) : 0
  const revealIWon = state.lastRound?.winner === myKey
  const revealTied = state.lastRound?.winner === 'tie'

  // ── GAME OVER ──────────────────────────────────────────────────────────────
  if (state.phase === 'game_over') {
    const iWon = state.winner === myKey
    const rematch = state.rematch
    const iRequested = myKey ? rematch?.[myKey] ?? false : false
    const theyRequested = opponent ? rematch?.[opponent] ?? false : false
    const newGameId = rematch?.newGameId

    // Auto-redirect both players once the new game is ready
    if (newGameId) {
      router.push(`/game/${newGameId}`)
      return null
    }

    const doRematch = async () => {
      if (acting) return
      setActing(true)
      try {
        const res = await fetch('/api/game/rematch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId }),
        })
        const data = await res.json()
        if (res.ok && data.gameState) {
          setSession(prev => prev ? { ...prev, game_state: data.gameState } : prev)
          if (data.gameState.rematch?.newGameId) {
            router.push(`/game/${data.gameState.rematch.newGameId}`)
          }
        }
      } finally {
        setActing(false)
      }
    }

    return (
      <div
        className="min-h-screen flex items-center justify-center text-white p-6 relative"
        style={{ background: background.css }}
      >
        <div className="absolute inset-0 bg-black/35" />
        <div className="relative z-10 text-center max-w-md">
          <div className={`text-9xl mb-6 drop-shadow-2xl ${iWon ? 'animate-bounce' : ''}`}>{iWon ? '🏆' : '💀'}</div>
          <h1 className={`text-6xl font-black mb-4 ${iWon ? 'text-yellow-300 drop-shadow-[0_0_30px_rgba(253,224,71,0.6)]' : 'text-gray-300'}`}>
            {iWon ? 'Victory!' : 'Defeated'}
          </h1>
          <p className="text-gray-400 mb-8 text-lg">
            {iWon ? 'You won the match!' : `${opponentLabel} won the match.`}
          </p>

          {/* Rematch status */}
          {iRequested && !newGameId && (
            <p className="text-amber-400 text-sm mb-4 animate-pulse">
              Waiting for {opponentLabel} to accept rematch…
            </p>
          )}
          {theyRequested && !iRequested && (
            <p className="text-green-400 text-sm mb-4">
              {opponentLabel} wants a rematch!
            </p>
          )}

          <div className="flex gap-3 justify-center flex-wrap">
            {!iRequested && (
              <button
                disabled={acting}
                onClick={doRematch}
                className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-6 py-3 rounded-xl font-bold transition shadow-lg shadow-amber-900/40"
              >
                {theyRequested ? 'Accept Rematch' : 'Rematch'}
              </button>
            )}
            <button
              onClick={() => router.push('/play')}
              className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-semibold transition"
            >
              Play Again
            </button>
            <button
              onClick={() => router.push('/')}
              className="bg-gray-800 hover:bg-gray-700 px-6 py-3 rounded-xl transition"
            >
              Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  const declinedAttrs = state.currentRound.declinedAttributes
  const challengedAttr = state.currentRound.attribute

  const burstResult = !state.lastRound || state.lastRound.winner === 'tie'
    ? null
    : state.lastRound.winner === myKey ? 'win' : 'lose'

  return (
    <div
      className="flex-1 flex flex-col text-white overflow-hidden min-h-0 select-none"
      style={{
        background: background.css,
      }}
    >
      <RoundBurst result={burstResult} triggerKey={state.turn} />

      {/* ── REVEAL OVERLAY ── */}
      {isRevealing && state.lastRound && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6">
          <div className="text-center max-w-lg w-full">
            <div className={`text-4xl font-black mb-2 tracking-tight ${
              revealTied ? 'text-gray-200' : revealIWon ? 'text-green-300' : 'text-red-400'
            }`}>
              {revealTied ? '🤝 Tie!' : revealIWon ? '✓ You Won!' : '✗ They Won'}
            </div>
            {!revealTied && (() => {
              const p = state.lastRound.pointsAwarded
              const parts = [
                p.aura > 0 ? `+${p.aura} Aura` : '',
                p.skill > 0 ? `+${p.skill} Skill` : '',
                p.stamina > 0 ? `+${p.stamina} Stamina` : '',
              ].filter(Boolean).join('  ')
              return <p className="text-sm text-gray-400 mb-6">{parts}</p>
            })()}
            {revealTied && <p className="text-sm text-gray-400 mb-6">Gems banked for next round</p>}

            <div className="flex gap-8 items-start justify-center">
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-gray-400 font-medium">You</p>
                {revealMyCard && <CoreCard scale={0.5} name={revealMyCard.name} aura={revealMyCard.aura} skill={revealMyCard.skill} stamina={revealMyCard.stamina} totalScore={revealMyCard.total_score} imageUrl={revealMyCard.image_url} rarity={revealMyCard.rarity} />}
                {state.lastRound.attribute === 'sprint'
                  ? <p className="text-6xl font-black text-yellow-400 drop-shadow-lg tabular-nums">⚡ {revealMyVal}</p>
                  : <p className={`text-6xl font-black drop-shadow-lg tabular-nums ${ATTR_COLOR[state.lastRound.attribute]}`}>{revealMyVal}</p>
                }
              </div>

              <div className="flex flex-col items-center gap-2 pt-24">
                <div className="text-2xl text-gray-500 font-black">vs</div>
                {!revealTied && (
                  <div className={`text-xs font-bold px-3 py-1 rounded-full ${revealIWon ? 'bg-green-900/60 text-green-300' : 'bg-red-900/60 text-red-300'}`}>
                    {revealIWon ? '▲ Win' : '▼ Loss'}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-gray-400 font-medium">{opponentLabel}</p>
                {revealTheirCard && <CoreCard scale={0.5} name={revealTheirCard.name} aura={revealTheirCard.aura} skill={revealTheirCard.skill} stamina={revealTheirCard.stamina} totalScore={revealTheirCard.total_score} imageUrl={revealTheirCard.image_url} rarity={revealTheirCard.rarity} />}
                {state.lastRound.attribute === 'sprint'
                  ? <p className="text-6xl font-black text-yellow-400 drop-shadow-lg tabular-nums">⚡ {revealTheirVal}</p>
                  : <p className={`text-6xl font-black drop-shadow-lg tabular-nums ${ATTR_COLOR[state.lastRound.attribute]}`}>{revealTheirVal}</p>
                }
              </div>
            </div>

            <p className="text-gray-600 text-sm mt-6 capitalize">
              {state.lastRound.attribute === 'sprint' ? '⚡ Sprint Token' : state.lastRound.attribute}
            </p>
          </div>
        </div>
      )}


      {/* ── FIXED SPRINT BUTTON (right side) ── */}
      {myKey && !state.sprintUsed[myKey] && !isRevealing && (
        (() => {
          const canSprint = ((state.phase === 'challenge' && isAttacker) || (state.phase === 'defense' && isCurrentDefender))
            && myCard?.rarity !== 'Core'
          if (!canSprint) return null
          return (
            <div className="fixed right-3 top-1/2 -translate-y-1/2 z-40">
              <button
                disabled={acting}
                onClick={() => doAction({ type: 'sprint' })}
                className="bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 border border-yellow-500 rounded-2xl p-3 text-center transition shadow-lg shadow-yellow-900/40 hover:shadow-yellow-400/40 hover:shadow-xl min-w-[56px]"
              >
                <div className="text-base mb-1">⚡</div>
                <div className="text-xs font-bold text-yellow-300 leading-tight">Sprint<br/>Token</div>
                <div className="text-xs text-yellow-500 mt-1">1×</div>
              </button>
            </div>
          )
        })()
      )}

      {/* ── TOP BAR ── */}
      <header className="bg-black/50 backdrop-blur border-b border-amber-900/30 px-4 py-2 flex items-center justify-between text-sm shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-gray-500">Turn {state.turn}</span>
          <span className="text-gray-700">·</span>
          <span className={isAttacker ? 'text-yellow-400 font-semibold' : 'text-gray-400'}>
            {isAttacker ? '⚔ Your attack' : '🛡 Defending'}
          </span>
          {myKey && state.sprintUsed[myKey] && (
            <span className="text-gray-600 text-xs border border-gray-700 px-2 py-0.5 rounded-full">Sprint Token used</span>
          )}
        </div>
        <div className="text-gray-400 text-sm font-semibold">{myUsername || myEmail.split('@')[0]}</div>
      </header>

      {/* ── FIXED LEFT: Tie bank ── */}
      <div className="fixed left-2 top-1/2 -translate-y-1/2 z-40">
        <TieBankSidebar tieBank={state.tieBank} />
      </div>

      {/* ── BOARD — no scroll ── */}
      <div className="flex-1 flex flex-col overflow-hidden max-w-lg mx-auto w-full px-3 py-2 gap-2">

        {/* ── OPPONENT ROW ── */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-gray-600 bg-gray-800 flex items-center justify-center shrink-0">
            {opponentAvatarUrl ? (
              <img src={opponentAvatarUrl} alt="Opponent" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-black text-gray-500">
                {opponentLabel.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-gray-200 truncate">
              {opponentLabel}
            </p>
            <p className="text-sm text-gray-500">{them ? `${them.deck.length} cards left` : ''}</p>
          </div>
        </div>

        {/* ── OPPONENT score circles ── */}
        {them && <PlayerScoreRow points={them.points} />}

        {/* ── LAST ROUND RESULT — compact ── */}
        {state.lastRound && (() => {
          const lr = state.lastRound
          const iWon = lr.winner === myKey
          const tied = lr.winner === 'tie'
          const p = lr.pointsAwarded
          const parts = [p.aura > 0 ? `${p.aura}A` : '', p.skill > 0 ? `${p.skill}S` : '', p.stamina > 0 ? `${p.stamina}St` : ''].filter(Boolean).join(' ')
          return (
            <div className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs flex items-center gap-2 ${
              tied ? 'bg-gray-900/80 border-gray-700 text-gray-400' :
              iWon ? 'bg-green-950/80 border-green-800 text-green-300' :
                     'bg-red-950/80 border-red-900 text-red-300'
            }`}>
              <span>{tied ? '🤝' : iWon ? '✓' : '✗'}</span>
              <span className="font-semibold truncate">
                {tied ? 'Tie — Gems Banked!' : iWon ? `+${parts} to You` : `+${parts} to Opp`}
              </span>
              <span className="ml-auto text-gray-500 capitalize shrink-0">
                {lr.attribute === 'sprint' ? '⚡' : lr.attribute}
              </span>
            </div>
          )
        })()}

        {/* ── ERROR ── */}
        {error && (
          <div className="shrink-0 bg-red-900/40 border border-red-800 text-red-400 rounded-xl px-3 py-1.5 text-xs text-center">
            {error}
          </div>
        )}

        {/* ── ACTION PANEL — flex-1 fills center ── */}
        <div className="flex-1 min-h-0 max-h-[35vh] bg-black/50 backdrop-blur border border-amber-900/40 rounded-2xl p-2 shadow-lg shadow-black/40 flex items-center justify-center">
          {state.phase === 'challenge' && isAttacker && (
            <div>
              <p className="text-base text-gray-400 mb-1 text-center">
                Choose an attribute to challenge
              </p>
              <p className="text-xs text-amber-400 text-center mb-4 font-semibold">
                ⚔ Win earns {declinedAttrs.length + 1} pt + tie bank
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                {(['aura', 'skill', 'stamina'] as Attribute[]).map(attr => {
                  const declined = declinedAttrs.includes(attr)
                  return (
                    <button
                      key={attr}
                      disabled={declined || acting}
                      onClick={() => doAction({ type: 'challenge', attribute: attr })}
                      className={`px-6 py-3 rounded-xl font-bold capitalize transition disabled:opacity-30 disabled:cursor-not-allowed ${
                        declined ? 'bg-gray-800 text-gray-600' : ATTR_BG[attr]
                      }`}
                    >
                      {attr}{declined ? ' ✕' : ''}
                      {myCard && !declined && (
                        <span className="block text-xs font-normal opacity-80 mt-0.5">
                          Your {attr.slice(0,1).toUpperCase()}: {myCard[attr]}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {state.phase === 'challenge' && !isAttacker && (
            <p className="text-center text-gray-400 text-xl animate-pulse">
              Waiting for opponent to choose an attribute…
            </p>
          )}

          {state.phase === 'defense' && isCurrentDefender && challengedAttr && (
            <div className="text-center">
              <p className="text-base text-gray-400 mb-2">
                {declinedAttrs.length === 0 ? 'Opponent challenges:' : 'Counter-challenge:'}
              </p>
              <p className={`text-3xl font-black capitalize mb-1 ${ATTR_COLOR[challengedAttr]}`}>
                {challengedAttr}
              </p>
              <p className="text-xs text-amber-400 font-semibold mb-3">
                ⚔ Win earns {declinedAttrs.length + 1} pt + tie bank
              </p>
              {myCard && (
                <p className="text-sm text-gray-400 mb-3">
                  Your {challengedAttr}: <span className={`text-xl font-bold ${ATTR_COLOR[challengedAttr]}`}>{myCard[challengedAttr]}</span>
                </p>
              )}
              <div className="flex gap-3 justify-center flex-wrap">
                <button
                  disabled={acting}
                  onClick={() => doAction({ type: 'accept' })}
                  className="bg-green-700 hover:bg-green-600 disabled:opacity-50 px-6 py-3 rounded-xl font-bold transition hover:shadow-green-500/40 hover:shadow-md"
                >
                  ✓ Accept
                </button>
                {declinedAttrs.length < 2 ? (
                  (['aura', 'skill', 'stamina'] as Attribute[])
                    .filter(a => a !== challengedAttr && !declinedAttrs.includes(a))
                    .map(a => (
                      <button
                        key={a}
                        disabled={acting}
                        onClick={() => doAction({ type: 'decline', attribute: a })}
                        className={`px-6 py-3 rounded-xl font-bold capitalize transition disabled:opacity-50 ${ATTR_BG[a]}`}
                      >
                        Decline → {a}
                        {myCard && (
                          <span className="block text-xs font-normal opacity-80 mt-0.5">
                            Your {a.slice(0,1).toUpperCase()}: {myCard[a]}
                          </span>
                        )}
                      </button>
                    ))
                ) : (
                  <button
                    disabled={acting}
                    onClick={() => doAction({ type: 'decline', attribute: null })}
                    className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-6 py-3 rounded-xl font-bold transition hover:border-red-600/40 hover:shadow-red-900/20 hover:shadow-md"
                  >
                    ✕ Decline → Score Faceoff
                  </button>
                )}
              </div>
            </div>
          )}

          {state.phase === 'defense' && !isCurrentDefender && (
            <p className="text-center text-gray-400 text-xl animate-pulse">
              Waiting for opponent to respond…
            </p>
          )}
        </div>

        {/* ── MY score circles ── */}
        {me && <PlayerScoreRow points={me.points} />}

      </div>

      {/* ── FIXED BOTTOM-RIGHT: My current card ── */}
      {myCard && (
        <div className="fixed bottom-3 right-3 z-30 drop-shadow-2xl">
          <CoreCard
            scale={0.72}
            name={myCard.name}
            aura={myCard.aura}
            skill={myCard.skill}
            stamina={myCard.stamina}
            totalScore={myCard.total_score}
            imageUrl={myCard.image_url}
            rarity={myCard.rarity}
          />
        </div>
      )}

    </div>
  )
}

function ShuffleOverlay() {
  const cards = [
    { tx: -100, tr: -22 },
    { tx: -52,  tr: -11 },
    { tx: 0,    tr:   0 },
    { tx: 52,   tr:  11 },
    { tx: 100,  tr:  22 },
  ]
  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur flex flex-col items-center justify-center gap-10">
      <div className="relative h-40 flex items-end justify-center w-64">
        {cards.map((c, i) => (
          <div
            key={i}
            className="absolute w-20 h-28 rounded-xl overflow-hidden shadow-2xl"
            style={{
              '--tx': `${c.tx}px`,
              '--tr': `${c.tr}deg`,
              animation: `shuffle-card 1.6s ease-in-out ${i * 0.07}s infinite`,
              zIndex: i,
            } as React.CSSProperties}
          >
            <img src="/card-back.png" alt="" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
      <div className="text-center space-y-2">
        <p className="text-white text-2xl font-bold tracking-wide">Shuffling Deck…</p>
        <p className="text-amber-400 text-sm animate-pulse">Preparing your cards</p>
      </div>
    </div>
  )
}
