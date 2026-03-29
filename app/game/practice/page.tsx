'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Card, Attribute, TieBank, EMPTY_BANK, shuffle, RARITY_MULTIPLIER } from '@/lib/game-types'
import { SFX } from '@/lib/sfx'
import RoundBurst from '@/app/components/RoundBurst'
import CardStats from '@/app/components/CardStats'
import { PlayerScoreRow, TieBankSidebar } from '@/app/components/GemBoard'
import AvatarUpload from '@/app/components/AvatarUpload'

// ── Types ──────────────────────────────────────────────────────────────────

type Difficulty = 'easy' | 'medium' | 'hard'
type Side = 'human' | 'cpu'

type SideState = {
  deck: number[]
  graveyard: number[]
  points: { aura: number; skill: number; stamina: number }
  currentCard: number | null
}

type PracticeState = {
  phase: 'challenge' | 'defense' | 'game_over'
  attacker: Side
  turn: number
  human: SideState
  cpu: SideState
  currentRound: {
    attribute: Attribute | null
    declinedAttributes: Attribute[]
    tieCount: number
    currentDefender: Side | null
  }
  sprintUsed: { human: boolean; cpu: boolean }
  tieBank: TieBank
  winner: Side | null
  lastRound: {
    attribute: Attribute | 'sprint'
    humanValue: number
    cpuValue: number
    winner: Side | 'tie'
    humanCardId: number
    cpuCardId: number
    pointsAwarded: TieBank
  } | null
}

type SavedDeck = { id: string; name: string; card_ids: number[] }

// ── Constants ──────────────────────────────────────────────────────────────

const RARITY_BORDER: Record<string, string> = {
  Core: 'border-gray-500',
  Rare: 'border-green-500',
  'Very Rare': 'border-purple-500',
  Epic: 'border-orange-500',
  Spectacular: 'border-yellow-400',
}

const ATTR_BG: Record<Attribute, string> = {
  aura: 'bg-red-700 hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/40',
  skill: 'bg-green-700 hover:bg-green-600 hover:shadow-lg hover:shadow-green-500/40',
  stamina: 'bg-yellow-600 hover:bg-yellow-500 hover:shadow-lg hover:shadow-yellow-500/40',
}

const ATTR_COLOR: Record<Attribute, string> = {
  aura: 'text-red-400',
  skill: 'text-green-400',
  stamina: 'text-yellow-400',
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: '🟢 Easy',
  medium: '🟡 Medium',
  hard: '🔴 Hard',
}

const CPU_THINK_MS: Record<Difficulty, number> = {
  easy: 600,
  medium: 1100,
  hard: 1600,
}

// ── Pure game logic ────────────────────────────────────────────────────────

function drawTop(side: SideState): SideState {
  const s = { ...side, deck: [...side.deck], graveyard: [...side.graveyard] }
  if (s.deck.length === 0) {
    s.deck = shuffle(s.graveyard)
    s.graveyard = []
  }
  s.currentCard = s.deck.shift() ?? null
  return s
}

function checkWinner(state: PracticeState): Side | null {
  const h = state.human.points
  const c = state.cpu.points
  if (h.aura >= 7 || h.skill >= 7 || h.stamina >= 7) return 'human'
  if (c.aura >= 7 || c.skill >= 7 || c.stamina >= 7) return 'cpu'
  return null
}

function claimPracticeBank(state: PracticeState, winner: Side): TieBank {
  const claimed = { ...state.tieBank }
  state[winner].points.aura += claimed.aura
  state[winner].points.skill += claimed.skill
  state[winner].points.stamina += claimed.stamina
  state.tieBank = { aura: 0, skill: 0, stamina: 0 }
  return claimed
}

function advanceAfterWin(
  state: PracticeState,
  winner: Side,
  attribute: Attribute | 'sprint',
  humanValue: number,
  cpuValue: number,
): PracticeState {
  const s: PracticeState = JSON.parse(JSON.stringify(state))

  let pointsAwarded: TieBank
  if (attribute === 'sprint') {
    // Score Faceoff: +1 each + claim all tie bank gems
    s[winner].points.aura += 1
    s[winner].points.skill += 1
    s[winner].points.stamina += 1
    const base: TieBank = { aura: 1, skill: 1, stamina: 1 }
    const claimed = claimPracticeBank(s, winner)
    pointsAwarded = { aura: base.aura + claimed.aura, skill: base.skill + claimed.skill, stamina: base.stamina + claimed.stamina }
  } else {
    // Attribute battle: challenge count in winning attribute + claim all tie bank gems
    const challengeCount = s.currentRound.declinedAttributes.length + 1
    s[winner].points[attribute] += challengeCount
    const base: TieBank = { ...EMPTY_BANK, [attribute]: challengeCount }
    const claimed = claimPracticeBank(s, winner)
    pointsAwarded = { aura: base.aura + claimed.aura, skill: base.skill + claimed.skill, stamina: base.stamina + claimed.stamina }
  }

  s.lastRound = {
    attribute,
    humanValue,
    cpuValue,
    winner,
    humanCardId: s.human.currentCard!,
    cpuCardId: s.cpu.currentCard!,
    pointsAwarded,
  }

  const gameWinner = checkWinner(s)
  if (gameWinner) {
    s.winner = gameWinner
    s.phase = 'game_over'
    return s
  }

  // Move cards to graveyard, draw new ones
  if (s.human.currentCard != null) s.human.graveyard.push(s.human.currentCard)
  if (s.cpu.currentCard != null) s.cpu.graveyard.push(s.cpu.currentCard)
  s.human = drawTop({ ...s.human, currentCard: null })
  s.cpu = drawTop({ ...s.cpu, currentCard: null })

  s.attacker = s.attacker === 'human' ? 'cpu' : 'human'
  s.turn += 1
  s.phase = 'challenge'
  s.currentRound = { attribute: null, declinedAttributes: [], tieCount: 0, currentDefender: null }

  return s
}

function tieReplay(
  state: PracticeState,
  attribute: Attribute | 'sprint',
  humanValue: number,
  cpuValue: number,
): PracticeState {
  const s: PracticeState = JSON.parse(JSON.stringify(state))
  // Bank the challenge count in the tied attribute (or 1 each for sprint)
  if (attribute === 'sprint') {
    s.tieBank.aura += 1
    s.tieBank.skill += 1
    s.tieBank.stamina += 1
  } else {
    const challengeCount = s.currentRound.declinedAttributes.length + 1
    s.tieBank[attribute] += challengeCount
  }
  s.lastRound = {
    attribute, humanValue, cpuValue, winner: 'tie',
    humanCardId: s.human.currentCard!,
    cpuCardId: s.cpu.currentCard!,
    pointsAwarded: { ...EMPTY_BANK },
  }

  // Advance to next cards (no points awarded)
  if (s.human.currentCard != null) s.human.graveyard.push(s.human.currentCard)
  if (s.cpu.currentCard != null) s.cpu.graveyard.push(s.cpu.currentCard)
  s.human = drawTop({ ...s.human, currentCard: null })
  s.cpu = drawTop({ ...s.cpu, currentCard: null })

  s.attacker = s.attacker === 'human' ? 'cpu' : 'human'
  s.turn += 1
  s.phase = 'challenge'
  s.currentRound = { attribute: null, declinedAttributes: [], tieCount: 0, currentDefender: null }
  return s
}

// ── CPU Deck Builder ───────────────────────────────────────────────────────

function buildCpuDeck(allCards: Card[], difficulty: Difficulty): number[] {
  const MAX_RP = 15
  let pool = [...allCards]

  if (difficulty === 'hard') {
    pool.sort((a, b) => b.total_score - a.total_score)
  } else {
    pool = shuffle(pool)
  }

  const selected: Card[] = []
  let rpUsed = 0

  for (const card of pool) {
    if (selected.length >= 20) break
    if (rpUsed + card.rarity_points > MAX_RP) continue
    selected.push(card)
    rpUsed += card.rarity_points
  }

  // Fill remaining slots with Core cards if needed
  if (selected.length < 20) {
    const selectedIds = new Set(selected.map(c => c.id))
    const cores = allCards.filter(c => !selectedIds.has(c.id) && c.rarity_points === 0)
    for (const card of cores) {
      if (selected.length >= 20) break
      selected.push(card)
    }
  }

  return selected.slice(0, 20).map(c => c.id)
}

// ── CPU AI ─────────────────────────────────────────────────────────────────

type CpuDecision =
  | { type: 'challenge'; attribute: Attribute }
  | { type: 'sprint' }
  | { type: 'accept' }
  | { type: 'decline'; counterAttribute: Attribute | null }  // null = 3rd decline (force faceoff)

function cpuDecide(
  state: PracticeState,
  difficulty: Difficulty,
  cardMap: Record<number, Card>,
): CpuDecision {
  const cpuCard = state.cpu.currentCard ? cardMap[state.cpu.currentCard] : null
  const humanCard = state.human.currentCard ? cardMap[state.human.currentCard] : null
  if (!cpuCard) return { type: 'accept' }

  const available = (['aura', 'skill', 'stamina'] as Attribute[]).filter(
    a => !state.currentRound.declinedAttributes.includes(a)
  )
  const fallback = available[0] ?? 'aura'

  // ── CPU is ATTACKING ──────────────────────────────────────────
  if (state.phase === 'challenge') {
    // Sprint logic — CPU card must be Rare or higher to use Sprint Token
    if (!state.sprintUsed.cpu && cpuCard.rarity !== 'Core') {
      const cpuSprint = Math.round(cpuCard.total_score * RARITY_MULTIPLIER[cpuCard.rarity])
      const humanSprint = humanCard
        ? Math.round(humanCard.total_score * RARITY_MULTIPLIER[humanCard.rarity])
        : 0

      if (difficulty === 'hard' && humanCard) {
        // Use sprint if CPU wins it AND human is ahead overall
        const cpuBest = Math.max(...Object.values(state.cpu.points))
        const humanBest = Math.max(...Object.values(state.human.points))
        if (cpuSprint > humanSprint && humanBest > cpuBest + 2) return { type: 'sprint' }
      } else if (difficulty === 'medium') {
        const cpuBest = Math.max(...Object.values(state.cpu.points))
        const humanBest = Math.max(...Object.values(state.human.points))
        if (humanBest >= 5 && cpuBest <= 2) return { type: 'sprint' }
      }
    }

    if (difficulty === 'easy') {
      return { type: 'challenge', attribute: fallback }
    }

    if (difficulty === 'medium') {
      // Pick CPU's highest-value available attribute
      const best = available.reduce((a, b) =>
        cpuCard[a] >= cpuCard[b] ? a : b, fallback)
      return { type: 'challenge', attribute: best }
    }

    // Hard — pick attribute with biggest advantage over human (omniscient)
    if (humanCard) {
      const best = available.reduce((a, b) => {
        const advA = cpuCard[a] - humanCard[a]
        const advB = cpuCard[b] - humanCard[b]
        return advA >= advB ? a : b
      }, fallback)
      return { type: 'challenge', attribute: best }
    }

    const best = available.reduce((a, b) =>
      cpuCard[a] >= cpuCard[b] ? a : b, fallback)
    return { type: 'challenge', attribute: best }
  }

  // ── CPU is DEFENDING ──────────────────────────────────────────
  if (state.phase === 'defense' && state.currentRound.currentDefender === 'cpu') {
    const attr = state.currentRound.attribute!
    const cpuVal = cpuCard[attr]
    const humanVal = humanCard ? humanCard[attr] : 0
    const declined = state.currentRound.declinedAttributes
    const availableCounter = (['aura', 'skill', 'stamina'] as Attribute[]).filter(
      a => a !== attr && !declined.includes(a)
    )
    const isLastDecline = declined.length >= 2

    if (difficulty === 'easy') return { type: 'accept' }

    if (difficulty === 'medium') {
      if (cpuVal >= 5) return { type: 'accept' }
      if (isLastDecline) return { type: 'decline', counterAttribute: null }
      const counter = availableCounter.reduce((a, b) => cpuCard[a] >= cpuCard[b] ? a : b, availableCounter[0])
      return { type: 'decline', counterAttribute: counter }
    }

    // Hard — omniscient: accept only if CPU wins
    if (cpuVal >= humanVal) return { type: 'accept' }
    if (isLastDecline) return { type: 'decline', counterAttribute: null }
    // Pick the counter attribute where CPU has the biggest advantage
    const counter = availableCounter.reduce((a, b) => {
      const advA = cpuCard[a] - (humanCard ? humanCard[a] : 0)
      const advB = cpuCard[b] - (humanCard ? humanCard[b] : 0)
      return advA >= advB ? a : b
    }, availableCounter[0])
    return { type: 'decline', counterAttribute: counter }
  }

  return { type: 'accept' }
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function PracticePage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  // Setup
  const [userDecks, setUserDecks] = useState<SavedDeck[]>([])
  const [allCards, setAllCards] = useState<Card[]>([])
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [loadingSetup, setLoadingSetup] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [username, setUsername] = useState<string>('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  // Game
  const [gameState, setGameState] = useState<PracticeState | null>(null)
  const [cardMap, setCardMap] = useState<Record<number, Card>>({})
  const [cpuThinking, setCpuThinking] = useState(false)
  const [acting, setActing] = useState(false)
  const [isRevealing, setIsRevealing] = useState(false)
  const [shuffling, setShuffling] = useState(false)
  const pendingStateRef = useRef<PracticeState | null>(null)
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevResKeyRef = useRef<number>(-1)

  // Load user decks and card pool
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      setUserId(user.id)
      setUserEmail(user.email ?? '')

      const [{ data: decks }, { data: cards }, { data: profile }] = await Promise.all([
        supabase.from('decks').select('id, name, card_ids').eq('user_id', user.id),
        supabase.from('cards').select('*'),
        supabase.from('user_profiles').select('avatar_url, username').eq('user_id', user.id).single(),
      ])

      if (decks) setUserDecks((decks as SavedDeck[]).filter(d => d.card_ids.length === 20))
      if (cards) setAllCards(cards as Card[])
      if (profile?.avatar_url) setAvatarUrl(profile.avatar_url)
      if (profile?.username) setUsername(profile.username)
      setLoadingSetup(false)
    }
    load()
  }, [supabase, router])

  // Reveal overlay — fires after any round resolution (win or tie)
  useEffect(() => {
    if (!gameState) return
    const key = gameState.turn * 10000 + gameState.currentRound.tieCount

    if (prevResKeyRef.current === -1) {
      prevResKeyRef.current = key
      return
    }
    if (key !== prevResKeyRef.current) {
      prevResKeyRef.current = key
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
      setIsRevealing(true)
      revealTimerRef.current = setTimeout(() => setIsRevealing(false), 2000)
      if (gameState.lastRound && gameState.lastRound.winner !== 'tie') {
        gameState.lastRound.winner === 'human' ? SFX.roundWin() : SFX.roundLose()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.turn, gameState?.currentRound.tieCount])

  // CPU auto-action
  useEffect(() => {
    if (!gameState || gameState.phase === 'game_over' || isRevealing) return

    const isCpuTurn =
      (gameState.phase === 'challenge' && gameState.attacker === 'cpu') ||
      (gameState.phase === 'defense' && gameState.currentRound.currentDefender === 'cpu')

    if (!isCpuTurn) return

    setCpuThinking(true)
    const timer = setTimeout(() => {
      const decision = cpuDecide(gameState, difficulty, cardMap)
      setCpuThinking(false)
      applyDecision(decision)
    }, CPU_THINK_MS[difficulty])

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.phase, gameState?.attacker, gameState?.turn, gameState?.currentRound.attribute, gameState?.currentRound.currentDefender, isRevealing])

  const applyDecision = useCallback((decision: CpuDecision) => {
    setGameState(prev => {
      if (!prev) return prev

      if (decision.type === 'challenge') {
        return {
          ...prev,
          currentRound: { ...prev.currentRound, attribute: decision.attribute, currentDefender: 'human' as Side },
          phase: 'defense',
        }
      }

      if (decision.type === 'sprint') {
        const humanCard = prev.human.currentCard ? cardMap[prev.human.currentCard] : null
        const cpuCard = prev.cpu.currentCard ? cardMap[prev.cpu.currentCard] : null
        if (!humanCard || !cpuCard) return prev

        const humanVal = Math.round(humanCard.total_score * RARITY_MULTIPLIER[humanCard.rarity])
        const cpuVal = Math.round(cpuCard.total_score * RARITY_MULTIPLIER[cpuCard.rarity])
        const next = { ...prev, sprintUsed: { ...prev.sprintUsed, cpu: true } }

        if (humanVal === cpuVal) return tieReplay(next, 'sprint', humanVal, cpuVal)
        const winner: Side = cpuVal > humanVal ? 'cpu' : 'human'
        return advanceAfterWin(next, winner, 'sprint', humanVal, cpuVal)
      }

      if (decision.type === 'accept') {
        if (prev.currentRound.currentDefender !== 'cpu') return prev
        const attr = prev.currentRound.attribute!
        const humanCard = prev.human.currentCard ? cardMap[prev.human.currentCard] : null
        const cpuCard = prev.cpu.currentCard ? cardMap[prev.cpu.currentCard] : null
        if (!humanCard || !cpuCard) return prev

        const humanVal: number = humanCard[attr]
        const cpuVal: number = cpuCard[attr]

        if (humanVal === cpuVal) return tieReplay(prev, attr, humanVal, cpuVal)
        const winner: Side = humanVal > cpuVal ? 'human' : 'cpu'
        return advanceAfterWin(prev, winner, attr, humanVal, cpuVal)
      }

      if (decision.type === 'decline') {
        if (prev.currentRound.currentDefender !== 'cpu') return prev
        const attr = prev.currentRound.attribute!
        const newDeclined = [...prev.currentRound.declinedAttributes, attr]

        if (newDeclined.length >= 3) {
          // Force Score Faceoff — all 3 attributes declined
          const humanCard = prev.human.currentCard ? cardMap[prev.human.currentCard] : null
          const cpuCard = prev.cpu.currentCard ? cardMap[prev.cpu.currentCard] : null
          if (!humanCard || !cpuCard) return prev
          const humanVal = Math.round(humanCard.total_score * RARITY_MULTIPLIER[humanCard.rarity])
          const cpuVal = Math.round(cpuCard.total_score * RARITY_MULTIPLIER[cpuCard.rarity])
          const base = { ...prev, currentRound: { ...prev.currentRound, attribute: null, declinedAttributes: newDeclined, currentDefender: null as Side | null } }
          if (humanVal === cpuVal) return tieReplay(base, 'sprint', humanVal, cpuVal)
          const winner: Side = humanVal > cpuVal ? 'human' : 'cpu'
          return advanceAfterWin(base, winner, 'sprint', humanVal, cpuVal)
        }

        // CPU counter-offer: pick best available attribute, human is now the defender
        const counterAttr = decision.counterAttribute!
        return {
          ...prev,
          phase: 'defense',
          currentRound: { ...prev.currentRound, attribute: counterAttr, declinedAttributes: newDeclined, currentDefender: 'human' as Side },
        }
      }

      return prev
    })
  }, [cardMap])

  // Human actions
  function humanChallenge(attribute: Attribute) {
    if (acting) return
    setGameState(prev => {
      if (!prev || prev.phase !== 'challenge' || prev.attacker !== 'human') return prev
      return {
        ...prev,
        phase: 'defense',
        currentRound: { ...prev.currentRound, attribute, currentDefender: 'cpu' as Side },
      }
    })
  }

  function humanSprint() {
    if (acting) return
    setGameState(prev => {
      if (!prev || prev.sprintUsed.human) return prev
      // Allow sprint when human is attacking (challenge phase) or is the current defender
      const canSprint =
        (prev.phase === 'challenge' && prev.attacker === 'human') ||
        (prev.phase === 'defense' && prev.currentRound.currentDefender === 'human')
      if (!canSprint) return prev

      const humanCard = prev.human.currentCard ? cardMap[prev.human.currentCard] : null
      // Sprint Token requires Rare or higher
      if (!humanCard || humanCard.rarity === 'Core') return prev
      const cpuCard = prev.cpu.currentCard ? cardMap[prev.cpu.currentCard] : null
      if (!cpuCard) return prev

      const humanVal = Math.round(humanCard.total_score * RARITY_MULTIPLIER[humanCard.rarity])
      const cpuVal = Math.round(cpuCard.total_score * RARITY_MULTIPLIER[cpuCard.rarity])
      const next = { ...prev, sprintUsed: { ...prev.sprintUsed, human: true } }

      if (humanVal === cpuVal) return tieReplay(next, 'sprint', humanVal, cpuVal)
      const winner: Side = humanVal > cpuVal ? 'human' : 'cpu'
      return advanceAfterWin(next, winner, 'sprint', humanVal, cpuVal)
    })
  }

  function humanAccept() {
    if (acting) return
    setGameState(prev => {
      if (!prev || prev.phase !== 'defense' || prev.currentRound.currentDefender !== 'human') return prev
      const attr = prev.currentRound.attribute!
      const humanCard = prev.human.currentCard ? cardMap[prev.human.currentCard] : null
      const cpuCard = prev.cpu.currentCard ? cardMap[prev.cpu.currentCard] : null
      if (!humanCard || !cpuCard) return prev

      const humanVal: number = humanCard[attr]
      const cpuVal: number = cpuCard[attr]

      if (humanVal === cpuVal) return tieReplay(prev, attr, humanVal, cpuVal)
      const winner: Side = humanVal > cpuVal ? 'human' : 'cpu'
      return advanceAfterWin(prev, winner, attr, humanVal, cpuVal)
    })
  }

  function humanDecline(counterAttr: Attribute | null) {
    if (acting) return
    setGameState(prev => {
      if (!prev || prev.phase !== 'defense' || prev.currentRound.currentDefender !== 'human') return prev
      const attr = prev.currentRound.attribute!
      const newDeclined = [...prev.currentRound.declinedAttributes, attr]

      if (newDeclined.length >= 3) {
        // Force Score Faceoff — all 3 attributes declined
        const humanCard = prev.human.currentCard ? cardMap[prev.human.currentCard] : null
        const cpuCard = prev.cpu.currentCard ? cardMap[prev.cpu.currentCard] : null
        if (!humanCard || !cpuCard) return prev
        const humanVal = Math.round(humanCard.total_score * RARITY_MULTIPLIER[humanCard.rarity])
        const cpuVal = Math.round(cpuCard.total_score * RARITY_MULTIPLIER[cpuCard.rarity])
        const base = { ...prev, currentRound: { ...prev.currentRound, attribute: null, declinedAttributes: newDeclined, currentDefender: null as Side | null } }
        if (humanVal === cpuVal) return tieReplay(base, 'sprint', humanVal, cpuVal)
        const winner: Side = humanVal > cpuVal ? 'human' : 'cpu'
        return advanceAfterWin(base, winner, 'sprint', humanVal, cpuVal)
      }

      // Counter-offer: human proposes a new attribute, CPU is now the defender
      return {
        ...prev,
        phase: 'defense',
        currentRound: { ...prev.currentRound, attribute: counterAttr!, declinedAttributes: newDeclined, currentDefender: 'cpu' as Side },
      }
    })
  }

  function startGame() {
    const deck = userDecks.find(d => d.id === selectedDeckId)
    if (!deck || allCards.length === 0) return

    const cpuCardIds = buildCpuDeck(allCards, difficulty)
    const allNeededIds = new Set([...deck.card_ids, ...cpuCardIds])
    const map: Record<number, Card> = {}
    allCards.forEach(c => { if (allNeededIds.has(c.id)) map[c.id] = c })
    setCardMap(map)

    const humanDeck = shuffle([...deck.card_ids])
    const cpuDeck = shuffle([...cpuCardIds])

    const humanState: SideState = {
      deck: humanDeck.slice(1),
      graveyard: [],
      points: { aura: 0, skill: 0, stamina: 0 },
      currentCard: humanDeck[0],
    }
    const cpuState: SideState = {
      deck: cpuDeck.slice(1),
      graveyard: [],
      points: { aura: 0, skill: 0, stamina: 0 },
      currentCard: cpuDeck[0],
    }

    const firstAttacker: Side = Math.random() < 0.5 ? 'human' : 'cpu'

    pendingStateRef.current = {
      phase: 'challenge',
      attacker: firstAttacker,
      turn: 1,
      human: humanState,
      cpu: cpuState,
      currentRound: { attribute: null, declinedAttributes: [], tieCount: 0, currentDefender: null },
      sprintUsed: { human: false, cpu: false },
      tieBank: { aura: 0, skill: 0, stamina: 0 },
      winner: null,
      lastRound: null,
    }

    setShuffling(true)
    setTimeout(() => {
      setGameState(pendingStateRef.current)
      pendingStateRef.current = null
      setShuffling(false)
    }, 2400)
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loadingSetup) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading…</p>
        </div>
      </div>
    )
  }

  // ── Shuffle animation ─────────────────────────────────────────────────────

  if (shuffling) return <ShuffleOverlay />

  // ── Setup Screen ──────────────────────────────────────────────────────────

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-4">
          <Link href="/play" className="text-gray-400 hover:text-white text-sm transition">← Back</Link>
          <h1 className="text-xl font-bold">Practice vs CPU</h1>
        </header>

        <div className="max-w-2xl mx-auto p-8 space-y-10">
          {/* Deck selection */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
              1. Select Your Deck
            </h2>
            {userDecks.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
                <p className="text-gray-400 mb-4">No valid decks found. Build a 20-card deck first.</p>
                <Link href="/deck-builder" className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-semibold transition">
                  Deck Builder
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {userDecks.map(deck => (
                  <button
                    key={deck.id}
                    onClick={() => setSelectedDeckId(deck.id)}
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
          </section>

          {/* Difficulty selection */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
              2. Choose Difficulty
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`p-4 rounded-2xl border-2 text-center transition ${
                    difficulty === d
                      ? d === 'easy' ? 'border-green-500 bg-green-900/30'
                        : d === 'medium' ? 'border-yellow-500 bg-yellow-900/20'
                        : 'border-red-500 bg-red-900/30'
                      : d === 'easy' ? 'border-gray-800 bg-gray-900 hover:border-green-700/60 hover:shadow-md hover:shadow-green-900/20'
                        : d === 'medium' ? 'border-gray-800 bg-gray-900 hover:border-yellow-700/60 hover:shadow-md hover:shadow-yellow-900/20'
                        : 'border-gray-800 bg-gray-900 hover:border-red-700/60 hover:shadow-md hover:shadow-red-900/20'
                  }`}
                >
                  <p className="text-2xl mb-1">
                    {d === 'easy' ? '🟢' : d === 'medium' ? '🟡' : '🔴'}
                  </p>
                  <p className="font-bold capitalize">{d}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {d === 'easy' ? 'Always accepts' : d === 'medium' ? 'Plays its best stat' : 'Reads your card'}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {/* Start */}
          <button
            onClick={startGame}
            disabled={!selectedDeckId}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed py-4 rounded-2xl font-bold text-xl transition shadow-lg hover:shadow-blue-500/30 hover:shadow-2xl"
          >
            Start Practice Match
          </button>
        </div>
      </div>
    )
  }

  // ── Game Over Screen ───────────────────────────────────────────────────────

  if (gameState.phase === 'game_over') {
    const iWon = gameState.winner === 'human'
    return (
      <div
        className="min-h-screen flex items-center justify-center text-white p-6 relative"
        style={{ background: "url('/bg.jpg') center/cover fixed, #050510" }}
      >
        <div className="absolute inset-0 bg-black/70" />
        <div className="relative z-10 text-center max-w-md">
          <div className={`text-9xl mb-6 drop-shadow-2xl ${iWon ? 'animate-bounce' : ''}`}>{iWon ? '🏆' : '🤖'}</div>
          <h1 className={`text-6xl font-black mb-3 ${iWon ? 'text-yellow-300 drop-shadow-[0_0_30px_rgba(253,224,71,0.6)]' : 'text-gray-300'}`}>{iWon ? 'You Won!' : 'CPU Wins'}</h1>
          <p className="text-gray-400 mb-2">
            vs CPU {DIFFICULTY_LABEL[difficulty]}
          </p>
          <div className="flex justify-center gap-4 my-8">
            {([
              { label: 'You', pts: gameState.human.points, highlight: iWon },
              { label: 'CPU', pts: gameState.cpu.points, highlight: !iWon },
            ] as const).map(({ label, pts, highlight }) => (
              <div key={label} className={`flex-1 max-w-[180px] rounded-2xl border p-4 ${highlight ? 'bg-amber-900/20 border-amber-600/50' : 'bg-gray-900/60 border-gray-700'}`}>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 text-center">{label}</p>
                {([
                  { attr: 'aura', color: 'bg-red-500', text: 'text-red-400' },
                  { attr: 'skill', color: 'bg-green-500', text: 'text-green-400' },
                  { attr: 'stamina', color: 'bg-yellow-500', text: 'text-yellow-400' },
                ] as const).map(({ attr, color, text }) => (
                  <div key={attr} className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-500 w-14 capitalize">{attr}</span>
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${Math.min(100, (pts[attr] / 7) * 100)}%` }} />
                    </div>
                    <span className={`text-xs font-bold w-4 text-right ${pts[attr] >= 7 ? 'text-yellow-400' : text}`}>{pts[attr]}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-center mt-4">
            <button
              onClick={() => setGameState(null)}
              className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-semibold transition"
            >
              Play Again
            </button>
            <Link
              href="/play"
              className="bg-gray-800 hover:bg-gray-700 px-6 py-3 rounded-xl transition"
            >
              Back to Play
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Game Screen ───────────────────────────────────────────────────────────

  const myCard = gameState.human.currentCard ? cardMap[gameState.human.currentCard] : null
  const declinedAttrs = gameState.currentRound.declinedAttributes
  const challengedAttr = gameState.currentRound.attribute
  const isMyAttack = gameState.phase === 'challenge' && gameState.attacker === 'human'
  const isMyDefense = gameState.phase === 'defense' && gameState.currentRound.currentDefender === 'human'
  const cpuIsActing = cpuThinking ||
    (gameState.phase === 'challenge' && gameState.attacker === 'cpu') ||
    (gameState.phase === 'defense' && gameState.currentRound.currentDefender === 'cpu')

  // Cards for reveal overlay
  const revealHumanCard = gameState.lastRound ? cardMap[gameState.lastRound.humanCardId] : null
  const revealCpuCard = gameState.lastRound ? cardMap[gameState.lastRound.cpuCardId] : null

  const burstResult = !gameState.lastRound || gameState.lastRound.winner === 'tie'
    ? null
    : gameState.lastRound.winner === 'human' ? 'win' : 'lose'

  return (
    <div
      className="min-h-screen text-white flex flex-col"
      style={{
        background: 'url(/bg.jpg) center/cover fixed, radial-gradient(ellipse at 50% 0%, #1a0a2e 0%, #0a0a1a 60%, #000 100%)',
      }}
    >
      <RoundBurst result={burstResult} triggerKey={gameState.turn} />

      {/* ── REVEAL OVERLAY ── */}
      {isRevealing && gameState.lastRound && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6">
          <div className="text-center max-w-lg w-full">
            {/* Result banner */}
            <div className={`text-4xl font-black mb-2 tracking-tight ${
              gameState.lastRound.winner === 'tie' ? 'text-gray-200' :
              gameState.lastRound.winner === 'human' ? 'text-green-300' : 'text-red-400'
            }`}>
              {gameState.lastRound.winner === 'tie' ? '🤝 Tie!' :
               gameState.lastRound.winner === 'human' ? '✓ You Won!' : '✗ CPU Won'}
            </div>
            {gameState.lastRound.winner !== 'tie' && (() => {
              const p = gameState.lastRound!.pointsAwarded
              const parts = [
                p.aura > 0 ? `+${p.aura} Aura` : '',
                p.skill > 0 ? `+${p.skill} Skill` : '',
                p.stamina > 0 ? `+${p.stamina} Stamina` : '',
              ].filter(Boolean).join('  ')
              return <p className="text-sm text-gray-400 mb-6">{parts}</p>
            })()}
            {gameState.lastRound.winner === 'tie' && <p className="text-sm text-gray-400 mb-6">Gems banked for next round</p>}

            {/* Both cards */}
            <div className="flex gap-6 items-center justify-center">
              {/* Human card */}
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-2 font-medium">You</p>
                <div className={`w-44 rounded-2xl border-2 overflow-hidden shadow-xl ${revealHumanCard ? RARITY_BORDER[revealHumanCard.rarity] : 'border-gray-700'} bg-gray-900 ${gameState.lastRound.winner === 'human' ? 'shadow-green-500/30' : gameState.lastRound.winner === 'tie' ? '' : 'shadow-red-500/20'}`}>
                  {revealHumanCard?.image_url && (
                    <img src={revealHumanCard.image_url} alt={revealHumanCard.name} className="w-full h-36 object-cover" />
                  )}
                  <div className="p-3 text-center">
                    <p className="text-sm font-bold truncate mb-1">{revealHumanCard?.name}</p>
                    {gameState.lastRound.attribute !== 'sprint' && (
                      <p className={`text-2xl font-black ${ATTR_COLOR[gameState.lastRound.attribute]}`}>
                        {gameState.lastRound.humanValue}
                      </p>
                    )}
                    {gameState.lastRound.attribute === 'sprint' && (
                      <p className="text-2xl font-black text-yellow-400">⚡ {gameState.lastRound.humanValue}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="text-3xl text-gray-500 font-black">vs</div>
                {gameState.lastRound.winner !== 'tie' && (
                  <div className={`text-sm font-bold px-3 py-1 rounded-full ${gameState.lastRound.winner === 'human' ? 'bg-green-900/60 text-green-300' : 'bg-red-900/60 text-red-300'}`}>
                    {gameState.lastRound.winner === 'human' ? '▲ Win' : '▼ Loss'}
                  </div>
                )}
              </div>

              {/* CPU card */}
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-2 font-medium">CPU</p>
                <div className={`w-44 rounded-2xl border-2 overflow-hidden shadow-xl ${revealCpuCard ? RARITY_BORDER[revealCpuCard.rarity] : 'border-gray-700'} bg-gray-900 ${gameState.lastRound.winner === 'cpu' ? 'shadow-green-500/30' : ''}`}>
                  {revealCpuCard?.image_url && (
                    <img src={revealCpuCard.image_url} alt={revealCpuCard.name} className="w-full h-36 object-cover" />
                  )}
                  <div className="p-3 text-center">
                    <p className="text-sm font-bold truncate mb-1">{revealCpuCard?.name}</p>
                    {gameState.lastRound.attribute !== 'sprint' && (
                      <p className={`text-2xl font-black ${ATTR_COLOR[gameState.lastRound.attribute]}`}>
                        {gameState.lastRound.cpuValue}
                      </p>
                    )}
                    {gameState.lastRound.attribute === 'sprint' && (
                      <p className="text-2xl font-black text-yellow-400">⚡ {gameState.lastRound.cpuValue}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <p className="text-gray-600 text-sm mt-6 capitalize">
              {gameState.lastRound.attribute === 'sprint' ? '⚡ Sprint Token' : gameState.lastRound.attribute}
            </p>
          </div>
        </div>
      )}


      {/* ── FIXED SPRINT BUTTON (right side) — only shown with Rare or higher card ── */}
      {!gameState.sprintUsed.human && !isRevealing && (isMyAttack || isMyDefense) &&
       myCard?.rarity !== 'Core' && (
        <div className="fixed right-3 top-1/2 -translate-y-1/2 z-40">
          <button
            onClick={humanSprint}
            className="bg-yellow-700 hover:bg-yellow-600 border border-yellow-500 rounded-2xl p-3 text-center transition shadow-lg shadow-yellow-900/40 hover:shadow-yellow-400/40 hover:shadow-xl min-w-[56px]"
          >
            <div className="text-base mb-1">⚡</div>
            <div className="text-xs font-bold text-yellow-300 leading-tight">Sprint<br/>Token</div>
            <div className="text-xs text-yellow-500 mt-1">1×</div>
          </button>
        </div>
      )}

      {/* Top bar */}
      <header className="bg-black/50 backdrop-blur border-b border-amber-900/30 px-4 py-2 flex items-center justify-between text-sm shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/play" className="text-gray-500 hover:text-white transition text-xs">← Exit</Link>
          <span className="text-gray-700">|</span>
          <span className="text-gray-400">Turn {gameState.turn}</span>
          <span className="text-gray-700">·</span>
          <span className={gameState.attacker === 'human' ? 'text-yellow-400 font-semibold' : 'text-gray-500'}>
            {gameState.attacker === 'human' ? '⚔ Your attack' : '🛡 Defending'}
          </span>
          {gameState.sprintUsed.human && (
            <span className="text-gray-600 text-xs border border-gray-700 px-2 py-0.5 rounded-full">Your Sprint used</span>
          )}
        </div>
        <span className="text-xs text-gray-600">{username || userEmail.split('@')[0]} · Practice · {DIFFICULTY_LABEL[difficulty]}</span>
      </header>

      {/* ── FIXED LEFT: Tie bank ── */}
      <div className="fixed left-2 top-1/2 -translate-y-1/2 z-40">
        <TieBankSidebar tieBank={gameState.tieBank} />
      </div>

      {/* ── BOARD — no scroll ── */}
      <div className="flex-1 flex flex-col overflow-hidden max-w-lg mx-auto w-full px-3 py-2 gap-2">

        {/* CPU row */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-3 border-gray-600 bg-gray-800 flex items-center justify-center shrink-0">
            <span className="text-5xl">🤖</span>
            <img
              src="/cpu-avatar.png"
              alt="CPU"
              className="absolute inset-0 w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-gray-200">CPU {DIFFICULTY_LABEL[difficulty]}</p>
            <p className="text-sm text-gray-500">{gameState.cpu.deck.length} cards left</p>
            {cpuThinking && <p className="text-sm text-amber-400 animate-pulse">Thinking…</p>}
          </div>
        </div>

        {/* Opponent score circles */}
        <PlayerScoreRow points={gameState.cpu.points} />

        {/* Last round result — compact single line */}
        {gameState.lastRound && (
          <div className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs flex items-center gap-2 ${
            gameState.lastRound.winner === 'tie'   ? 'bg-gray-900/80 border-gray-700 text-gray-400' :
            gameState.lastRound.winner === 'human' ? 'bg-green-950/80 border-green-800 text-green-300' :
                                                     'bg-red-950/80 border-red-900 text-red-300'
          }`}>
            <span>{gameState.lastRound.winner === 'tie' ? '🤝' : gameState.lastRound.winner === 'human' ? '✓' : '✗'}</span>
            <span className="font-semibold truncate">
              {gameState.lastRound.winner === 'tie' ? 'Tie — Gems Banked!' : (() => {
                const p = gameState.lastRound!.pointsAwarded
                const parts = [p.aura > 0 ? `${p.aura}A` : '', p.skill > 0 ? `${p.skill}S` : '', p.stamina > 0 ? `${p.stamina}St` : ''].filter(Boolean).join(' ')
                return gameState.lastRound!.winner === 'human' ? `+${parts} to You` : `+${parts} to CPU`
              })()}
            </span>
            <span className="ml-auto text-gray-500 capitalize shrink-0">
              {gameState.lastRound.attribute === 'sprint' ? '⚡' : gameState.lastRound.attribute}: {gameState.lastRound.humanValue} vs {gameState.lastRound.cpuValue}
            </span>
          </div>
        )}

        {/* Action panel — fills center */}
        <div className="flex-1 min-h-0 bg-black/50 backdrop-blur border border-amber-900/40 rounded-2xl p-2 flex items-center justify-center shadow-lg shadow-black/40">
          {isMyAttack && (
            <div className="w-full">
              <p className="text-base text-gray-400 mb-1 text-center">Choose an attribute to challenge:</p>
              <p className="text-xs text-amber-400 text-center mb-4 font-semibold">
                ⚔ Win earns {declinedAttrs.length + 1} pt + tie bank
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                {(['aura', 'skill', 'stamina'] as Attribute[]).map(attr => {
                  const declined = declinedAttrs.includes(attr)
                  return (
                    <button
                      key={attr}
                      disabled={declined}
                      onClick={() => humanChallenge(attr)}
                      className={`px-6 py-3 rounded-xl font-bold capitalize transition disabled:opacity-30 disabled:cursor-not-allowed ${
                        declined ? 'bg-gray-800 text-gray-600' : ATTR_BG[attr]
                      }`}
                    >
                      {attr}{declined ? ' ✕' : ''}
                      {myCard && (
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

          {isMyDefense && challengedAttr && (
            <div className="text-center">
              <p className="text-base text-gray-400 mb-1">
                {declinedAttrs.length === 0 ? 'CPU challenges:' : 'Counter-challenge:'}
              </p>
              <p className={`text-3xl font-black capitalize mb-1 ${ATTR_COLOR[challengedAttr]}`}>
                {challengedAttr}
              </p>
              <p className="text-xs text-amber-400 font-semibold mb-3">
                ⚔ Win earns {declinedAttrs.length + 1} pt + tie bank
              </p>
              {myCard && (
                <p className="text-sm text-gray-400 mb-3">
                  Your {challengedAttr}:&nbsp;
                  <span className={`text-xl font-bold ${ATTR_COLOR[challengedAttr]}`}>{myCard[challengedAttr]}</span>
                </p>
              )}
              <div className="flex gap-3 justify-center flex-wrap">
                <button onClick={humanAccept} className="bg-green-700 hover:bg-green-600 px-6 py-3 rounded-xl font-bold transition hover:shadow-green-500/40 hover:shadow-md">
                  ✓ Accept
                </button>
                {declinedAttrs.length < 2 ? (
                  (['aura', 'skill', 'stamina'] as Attribute[])
                    .filter(a => a !== challengedAttr && !declinedAttrs.includes(a))
                    .map(a => (
                      <button
                        key={a}
                        onClick={() => humanDecline(a)}
                        className={`px-6 py-3 rounded-xl font-bold capitalize transition ${ATTR_BG[a]}`}
                      >
                        Decline → {a}
                      </button>
                    ))
                ) : (
                  <button
                    onClick={() => humanDecline(null)}
                    className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-xl font-bold transition hover:border-red-600/40 hover:shadow-md"
                  >
                    ✕ Decline → Score Faceoff
                  </button>
                )}
              </div>
            </div>
          )}

          {cpuIsActing && !isMyDefense && (
            <p className="text-gray-400 animate-pulse text-xl">
              {cpuThinking ? 'CPU is thinking…' :
               gameState.attacker === 'cpu' ? 'CPU is choosing an attribute…' :
               'Waiting for CPU response…'}
            </p>
          )}
        </div>

        {/* My score circles */}
        <PlayerScoreRow points={gameState.human.points} />

      </div>

      {/* ── FIXED BOTTOM-RIGHT: My current card ── */}
      {myCard ? (
        <div className={`fixed bottom-3 right-3 z-30 w-[229px] bg-gray-900/95 backdrop-blur border-2 ${RARITY_BORDER[myCard.rarity]} rounded-2xl overflow-hidden shadow-2xl`}>
          <img
            src={myCard.image_url || '/card-back.png'}
            alt={myCard.name}
            className="w-full h-48 object-cover"
          />
          <div className="p-3">
            <div className="flex items-center gap-2 mb-1">
              {userId && (
                <AvatarUpload
                  userId={userId}
                  avatarUrl={avatarUrl}
                  email={userEmail}
                  size="sm"
                  onUpload={setAvatarUrl}
                />
              )}
              <p className="text-[32px] font-bold text-white break-words leading-tight">{myCard.name}</p>
            </div>
            <p className="text-2xl text-gray-500 mb-2.5">{myCard.rarity} · {gameState.human.deck.length} left</p>
            <CardStats totalScore={myCard.total_score} aura={myCard.aura} skill={myCard.skill} stamina={myCard.stamina} size="md" />
          </div>
        </div>
      ) : null}

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

