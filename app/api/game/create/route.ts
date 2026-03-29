import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'
import { GameState, PlayerState, shuffle, drawCard } from '@/lib/game-types'

function buildPlayerState(userId: string, email: string, cardIds: number[]): PlayerState {
  const deck = shuffle(cardIds)
  const state: PlayerState = {
    userId,
    email,
    deck,
    graveyard: [],
    points: { aura: 0, skill: 0, stamina: 0 },
    currentCard: null,
  }
  return drawCard(state)
}

export async function POST(req: NextRequest) {
  const authClient = await createAuthClient()
  const admin = createAdminClient()

  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { deckId, type, roomCode } = body as {
    deckId: string
    type: 'quick' | 'private_create' | 'private_join'
    roomCode?: string
  }

  // Validate deck belongs to this user and has exactly 20 cards
  const { data: deck } = await admin
    .from('decks')
    .select('*')
    .eq('id', deckId)
    .eq('user_id', user.id)
    .single()

  if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
  if ((deck.card_ids as number[]).length !== 20) {
    return NextResponse.json({ error: 'Deck must have exactly 20 cards' }, { status: 400 })
  }

  // ── QUICK MATCH ──────────────────────────────────────────────────────────
  if (type === 'quick') {
    // Look for someone already waiting
    const { data: waiting } = await admin
      .from('matchmaking_queue')
      .select('*')
      .neq('user_id', user.id)
      .is('game_id', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (waiting) {
      const { data: opponentDeck } = await admin
        .from('decks')
        .select('*')
        .eq('id', waiting.deck_id)
        .single()

      if (!opponentDeck || (opponentDeck.card_ids as number[]).length !== 20) {
        // Opponent deck is invalid — remove them and queue ourselves
        await admin.from('matchmaking_queue').delete().eq('user_id', waiting.user_id)
        await admin.from('matchmaking_queue').upsert(
          { user_id: user.id, deck_id: deckId, game_id: null },
          { onConflict: 'user_id' }
        )
        return NextResponse.json({ status: 'queued' })
      }

      const gameState: GameState = {
        phase: 'challenge',
        attacker: Math.random() < 0.5 ? 'player1' : 'player2',
        turn: 1,
        player1: buildPlayerState(waiting.user_id, waiting.user_email ?? '', opponentDeck.card_ids),
        player2: buildPlayerState(user.id, user.email ?? '', deck.card_ids),
        currentRound: { attribute: null, declinedAttributes: [], tieCount: 0, currentDefender: null },
        sprintUsed: { player1: false, player2: false },
        tieBank: { aura: 0, skill: 0, stamina: 0 },
        winner: null,
        lastRound: null,
      }

      const { data: game, error: gameErr } = await admin
        .from('game_sessions')
        .insert({
          player1_id: waiting.user_id,
          player1_email: waiting.user_email ?? '',
          player2_id: user.id,
          player2_email: user.email ?? '',
          player1_deck_id: waiting.deck_id,
          player2_deck_id: deckId,
          status: 'active',
          game_state: gameState,
        })
        .select()
        .single()

      if (gameErr || !game) {
        return NextResponse.json({ error: 'Failed to create game' }, { status: 500 })
      }

      // Notify waiting player via their queue row
      await admin
        .from('matchmaking_queue')
        .update({ game_id: game.id })
        .eq('user_id', waiting.user_id)

      return NextResponse.json({ status: 'matched', gameId: game.id })
    }

    // No opponent found — enter queue
    await admin.from('matchmaking_queue').upsert(
      { user_id: user.id, deck_id: deckId, game_id: null, user_email: user.email },
      { onConflict: 'user_id' }
    )
    return NextResponse.json({ status: 'queued' })
  }

  // ── PRIVATE ROOM: CREATE ─────────────────────────────────────────────────
  if (type === 'private_create') {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()

    const p1State = buildPlayerState(user.id, user.email ?? '', deck.card_ids)
    const partialState = {
      phase: 'challenge',
      attacker: 'player1',
      turn: 1,
      player1: p1State,
      player2: null,
      currentRound: { attribute: null, declinedAttributes: [], tieCount: 0, currentDefender: null },
      sprintUsed: { player1: false, player2: false },
      tieBank: { aura: 0, skill: 0, stamina: 0 },
      winner: null,
      lastRound: null,
    }

    const { data: game, error: gameErr } = await admin
      .from('game_sessions')
      .insert({
        player1_id: user.id,
        player1_email: user.email ?? '',
        player1_deck_id: deckId,
        status: 'waiting',
        room_code: code,
        game_state: partialState,
      })
      .select()
      .single()

    if (gameErr || !game) {
      return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
    }

    return NextResponse.json({ status: 'waiting', gameId: game.id, roomCode: code })
  }

  // ── PRIVATE ROOM: JOIN ───────────────────────────────────────────────────
  if (type === 'private_join') {
    if (!roomCode) return NextResponse.json({ error: 'Room code required' }, { status: 400 })

    const { data: game } = await admin
      .from('game_sessions')
      .select('*')
      .eq('room_code', roomCode.trim().toUpperCase())
      .eq('status', 'waiting')
      .single()

    if (!game) {
      return NextResponse.json({ error: 'Room not found or already started' }, { status: 404 })
    }
    if (game.player1_id === user.id) {
      return NextResponse.json({ error: 'You cannot join your own room' }, { status: 400 })
    }

    const existing = game.game_state as { player1: PlayerState }
    const p2State = buildPlayerState(user.id, user.email ?? '', deck.card_ids)
    // Re-draw player1's first card now that game is starting
    const p1State = drawCard({ ...existing.player1, deck: shuffle(existing.player1.deck), currentCard: null })

    const gameState: GameState = {
      phase: 'challenge',
      attacker: Math.random() < 0.5 ? 'player1' : 'player2',
      turn: 1,
      player1: p1State,
      player2: p2State,
      currentRound: { attribute: null, declinedAttributes: [], tieCount: 0, currentDefender: null },
      sprintUsed: { player1: false, player2: false },
      tieBank: { aura: 0, skill: 0, stamina: 0 },
      winner: null,
      lastRound: null,
    }

    await admin
      .from('game_sessions')
      .update({
        player2_id: user.id,
        player2_email: user.email ?? '',
        player2_deck_id: deckId,
        status: 'active',
        game_state: gameState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', game.id)

    return NextResponse.json({ status: 'matched', gameId: game.id })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
