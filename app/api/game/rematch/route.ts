import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { GameState, PlayerState, PlayerKey, shuffle, drawCard } from '@/lib/game-types'

function buildPlayerState(userId: string, email: string, cardIds: number[]): PlayerState {
  const deck = shuffle(cardIds)
  const state: PlayerState = { userId, email, deck, graveyard: [], points: { aura: 0, skill: 0, stamina: 0 }, currentCard: null }
  return drawCard(state)
}

export async function POST(req: NextRequest) {
  const authClient = await createAuthClient()
  const admin = createAdminClient()

  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { gameId } = await req.json() as { gameId: string }

  const { data: game } = await admin
    .from('game_sessions')
    .select('*')
    .eq('id', gameId)
    .single()

  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  if (game.status !== 'completed') return NextResponse.json({ error: 'Game is not over' }, { status: 400 })

  const isPlayer1 = game.player1_id === user.id
  const isPlayer2 = game.player2_id === user.id
  if (!isPlayer1 && !isPlayer2) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

  const myKey: PlayerKey = isPlayer1 ? 'player1' : 'player2'
  const state: GameState = JSON.parse(JSON.stringify(game.game_state))

  // Mark this player as wanting a rematch
  state.rematch = state.rematch ?? { player1: false, player2: false }
  state.rematch[myKey] = true

  // If both players want a rematch, create the new game
  if (state.rematch.player1 && state.rematch.player2 && !state.rematch.newGameId) {
    const [{ data: p1Deck }, { data: p2Deck }] = await Promise.all([
      admin.from('decks').select('card_ids').eq('id', game.player1_deck_id).single(),
      admin.from('decks').select('card_ids').eq('id', game.player2_deck_id).single(),
    ])

    if (!p1Deck || !p2Deck) return NextResponse.json({ error: 'Deck data missing' }, { status: 500 })

    const newGameState: GameState = {
      phase: 'challenge',
      attacker: Math.random() < 0.5 ? 'player1' : 'player2',
      turn: 1,
      player1: buildPlayerState(game.player1_id, game.player1_email ?? '', p1Deck.card_ids),
      player2: buildPlayerState(game.player2_id, game.player2_email ?? '', p2Deck.card_ids),
      currentRound: { attribute: null, declinedAttributes: [], tieCount: 0, currentDefender: null },
      sprintUsed: { player1: false, player2: false },
      tieBank: { aura: 0, skill: 0, stamina: 0 },
      winner: null,
      lastRound: null,
    }

    const { data: newGame, error: gameErr } = await admin
      .from('game_sessions')
      .insert({
        player1_id: game.player1_id,
        player1_email: game.player1_email,
        player2_id: game.player2_id,
        player2_email: game.player2_email,
        player1_deck_id: game.player1_deck_id,
        player2_deck_id: game.player2_deck_id,
        status: 'active',
        game_state: newGameState,
      })
      .select()
      .single()

    if (gameErr || !newGame) return NextResponse.json({ error: 'Failed to create rematch' }, { status: 500 })

    state.rematch.newGameId = newGame.id
  }

  await admin.from('game_sessions').update({ game_state: state }).eq('id', gameId)

  return NextResponse.json({ success: true, gameState: state })
}
