import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import {
  GameState, GameAction, PlayerKey, Attribute, TieBank, EMPTY_BANK,
  Card, RARITY_MULTIPLIER, checkWinner, drawCard,
} from '@/lib/game-types'

// Helper: claim all tie bank gems into the winner's points and reset
function claimBank(state: GameState, winner: PlayerKey): TieBank {
  const claimed = { ...state.tieBank }
  state[winner].points.aura += claimed.aura
  state[winner].points.skill += claimed.skill
  state[winner].points.stamina += claimed.stamina
  state.tieBank = { aura: 0, skill: 0, stamina: 0 }
  return claimed
}

export async function POST(req: NextRequest) {
  const authClient = await createAuthClient()
  const admin = createAdminClient()

  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { gameId, action } = await req.json() as { gameId: string; action: GameAction }

  const { data: game } = await admin
    .from('game_sessions')
    .select('*')
    .eq('id', gameId)
    .single()

  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (game.status !== 'active') return NextResponse.json({ error: 'Game is not active' }, { status: 400 })

  const isPlayer1 = game.player1_id === user.id
  const isPlayer2 = game.player2_id === user.id
  if (!isPlayer1 && !isPlayer2) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

  const myKey: PlayerKey = isPlayer1 ? 'player1' : 'player2'
  const state: GameState = JSON.parse(JSON.stringify(game.game_state)) // deep clone

  const isAttacker = state.attacker === myKey
  const isDefender = state.attacker !== myKey

  // ── CHALLENGE ──────────────────────────────────────────────────────────────
  if (action.type === 'challenge') {
    if (state.phase !== 'challenge') return err('Not in challenge phase')
    if (!isAttacker) return err('Not your turn to attack')
    if (state.currentRound.declinedAttributes.includes(action.attribute)) {
      return err('That attribute was already declined this round')
    }

    const opponentKey: PlayerKey = myKey === 'player1' ? 'player2' : 'player1'
    state.currentRound.attribute = action.attribute
    state.currentRound.currentDefender = opponentKey
    state.phase = 'defense'
    return saveAndReturn(admin, game, state)
  }

  // ── SPRINT ────────────────────────────────────────────────────────────────
  if (action.type === 'sprint') {
    const canSprint = (state.phase === 'challenge' && isAttacker) ||
                      (state.phase === 'defense' && state.currentRound.currentDefender === myKey)
    if (!canSprint) return err('Cannot use Sprint Token right now')
    if (state.sprintUsed[myKey]) return err('You have already used your Sprint Token')

    const p1CardId = state.player1.currentCard!
    const p2CardId = state.player2.currentCard!
    const { data: cards } = await admin.from('cards').select('*').in('id', [p1CardId, p2CardId])
    if (!cards || cards.length < 2) return NextResponse.json({ error: 'Card data missing' }, { status: 500 })

    const p1Card = cards.find((c: Card) => c.id === p1CardId)!
    const p2Card = cards.find((c: Card) => c.id === p2CardId)!

    // Sprint Token requires the acting player to hold a Rare or higher card
    const myCard = myKey === 'player1' ? p1Card : p2Card
    if (myCard.rarity === 'Core') return err('Sprint Token requires a Rare or higher card')
    const p1Score = Math.round(p1Card.total_score * RARITY_MULTIPLIER[p1Card.rarity])
    const p2Score = Math.round(p2Card.total_score * RARITY_MULTIPLIER[p2Card.rarity])

    state.sprintUsed = { ...state.sprintUsed, [myKey]: true }

    if (p1Score === p2Score) {
      // Tie: bank 1 of each attribute (sprint is worth 1 each)
      state.tieBank.aura += 1
      state.tieBank.skill += 1
      state.tieBank.stamina += 1
      state.lastRound = { attribute: 'sprint', p1Value: p1Score, p2Value: p2Score, winner: 'tie', p1CardId, p2CardId, pointsAwarded: { ...EMPTY_BANK } }
      advanceRound(state, 'player1', true)
    } else {
      const roundWinner: PlayerKey = p1Score > p2Score ? 'player1' : 'player2'
      // Sprint win: +1 each + claim all tie bank gems
      state[roundWinner].points.aura += 1
      state[roundWinner].points.skill += 1
      state[roundWinner].points.stamina += 1
      const base: TieBank = { aura: 1, skill: 1, stamina: 1 }
      const claimed = claimBank(state, roundWinner)
      const pointsAwarded: TieBank = {
        aura: base.aura + claimed.aura,
        skill: base.skill + claimed.skill,
        stamina: base.stamina + claimed.stamina,
      }
      state.lastRound = { attribute: 'sprint', p1Value: p1Score, p2Value: p2Score, winner: roundWinner, p1CardId, p2CardId, pointsAwarded }
      advanceRound(state, roundWinner)
    }

    return saveAndReturn(admin, game, state)
  }

  // ── ACCEPT ────────────────────────────────────────────────────────────────
  if (action.type === 'accept') {
    if (state.phase !== 'defense') return err('Not in defense phase')
    if (state.currentRound.currentDefender !== myKey) return err('Not your turn to respond')

    const attribute = state.currentRound.attribute!
    const p1CardId = state.player1.currentCard!
    const p2CardId = state.player2.currentCard!
    const { data: cards } = await admin.from('cards').select('*').in('id', [p1CardId, p2CardId])
    if (!cards || cards.length < 2) return NextResponse.json({ error: 'Card data missing' }, { status: 500 })

    const p1Card = cards.find((c: Card) => c.id === p1CardId)!
    const p2Card = cards.find((c: Card) => c.id === p2CardId)!
    const p1Val: number = p1Card[attribute]
    const p2Val: number = p2Card[attribute]

    if (p1Val === p2Val) {
      // Tie: bank the challenge count in the tied attribute
      const challengeCount = state.currentRound.declinedAttributes.length + 1
      state.tieBank[attribute] += challengeCount
      state.lastRound = { attribute, p1Value: p1Val, p2Value: p2Val, winner: 'tie', p1CardId, p2CardId, pointsAwarded: { ...EMPTY_BANK } }
      advanceRound(state, 'player1', true)
    } else {
      const roundWinner: PlayerKey = p1Val > p2Val ? 'player1' : 'player2'
      const challengeCount = state.currentRound.declinedAttributes.length + 1
      // Win: add challenge count to the winning attribute
      state[roundWinner].points[attribute] += challengeCount
      const basePoints: TieBank = { ...EMPTY_BANK, [attribute]: challengeCount }
      // Then claim all tie bank gems
      const claimed = claimBank(state, roundWinner)
      const pointsAwarded: TieBank = {
        aura: basePoints.aura + claimed.aura,
        skill: basePoints.skill + claimed.skill,
        stamina: basePoints.stamina + claimed.stamina,
      }
      state.lastRound = { attribute, p1Value: p1Val, p2Value: p2Val, winner: roundWinner, p1CardId, p2CardId, pointsAwarded }
      advanceRound(state, roundWinner)
    }

    return saveAndReturn(admin, game, state)
  }

  // ── DECLINE ───────────────────────────────────────────────────────────────
  if (action.type === 'decline') {
    if (state.phase !== 'defense') return err('Not in defense phase')
    if (state.currentRound.currentDefender !== myKey) return err('Not your turn to respond')

    const attr = state.currentRound.attribute!
    state.currentRound.declinedAttributes.push(attr)

    // After 3 declines (all attributes declined), force a Score Faceoff
    if (state.currentRound.declinedAttributes.length >= 3) {
      state.currentRound.attribute = null
      const p1CardId = state.player1.currentCard!
      const p2CardId = state.player2.currentCard!
      const { data: cards } = await admin.from('cards').select('*').in('id', [p1CardId, p2CardId])
      if (!cards || cards.length < 2) return NextResponse.json({ error: 'Card data missing' }, { status: 500 })

      const p1Card = cards.find((c: Card) => c.id === p1CardId)!
      const p2Card = cards.find((c: Card) => c.id === p2CardId)!
      const p1Score = Math.round(p1Card.total_score * RARITY_MULTIPLIER[p1Card.rarity])
      const p2Score = Math.round(p2Card.total_score * RARITY_MULTIPLIER[p2Card.rarity])

      if (p1Score === p2Score) {
        state.tieBank.aura += 1
        state.tieBank.skill += 1
        state.tieBank.stamina += 1
        state.lastRound = { attribute: 'sprint', p1Value: p1Score, p2Value: p2Score, winner: 'tie', p1CardId, p2CardId, pointsAwarded: { ...EMPTY_BANK } }
        advanceRound(state, 'player1', true)
      } else {
        const roundWinner: PlayerKey = p1Score > p2Score ? 'player1' : 'player2'
        state[roundWinner].points.aura += 1
        state[roundWinner].points.skill += 1
        state[roundWinner].points.stamina += 1
        const base: TieBank = { aura: 1, skill: 1, stamina: 1 }
        const claimed = claimBank(state, roundWinner)
        const pointsAwarded: TieBank = {
          aura: base.aura + claimed.aura,
          skill: base.skill + claimed.skill,
          stamina: base.stamina + claimed.stamina,
        }
        state.lastRound = { attribute: 'sprint', p1Value: p1Score, p2Value: p2Score, winner: roundWinner, p1CardId, p2CardId, pointsAwarded }
        advanceRound(state, roundWinner)
      }
    } else {
      // Counter-offer: the decliner proposes a new attribute, roles flip
      if (!action.attribute || state.currentRound.declinedAttributes.includes(action.attribute)) {
        return err('Must choose a valid counter attribute that has not been declined')
      }
      state.currentRound.attribute = action.attribute
      state.currentRound.currentDefender = myKey === 'player1' ? 'player2' : 'player1'
      // Phase stays 'defense' — the other player now must accept or decline
    }

    return saveAndReturn(admin, game, state)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// Move cards to graveyard, draw new ones, optionally switch attacker
function advanceRound(state: GameState, _winner: PlayerKey, tie = false) {
  const winner = checkWinner(state)
  if (winner) {
    state.winner = winner
    state.phase = 'game_over'
    return
  }

  if (state.player1.currentCard != null) state.player1.graveyard.push(state.player1.currentCard)
  if (state.player2.currentCard != null) state.player2.graveyard.push(state.player2.currentCard)

  state.player1 = drawCard({ ...state.player1, currentCard: null })
  state.player2 = drawCard({ ...state.player2, currentCard: null })

  if (!tie) state.attacker = state.attacker === 'player1' ? 'player2' : 'player1'
  state.turn += 1
  state.phase = 'challenge'
  state.currentRound = { attribute: null, declinedAttributes: [], tieCount: 0, currentDefender: null }
}

async function saveAndReturn(
  admin: ReturnType<typeof createAdminClient>,
  game: { id: string; player1_id: string; player2_id: string },
  state: GameState,
) {
  const winnerId = state.winner
    ? (state.winner === 'player1' ? game.player1_id : game.player2_id)
    : null

  await admin
    .from('game_sessions')
    .update({
      game_state: state,
      status: state.winner ? 'completed' : 'active',
      winner_id: winnerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', game.id)

  return Response.json({ success: true, gameState: state })
}

function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}
