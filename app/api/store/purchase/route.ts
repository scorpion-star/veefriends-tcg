import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

const RARITY_PRICES: Record<string, number> = {
  Core:         50,
  Rare:        150,
  'Very Rare': 300,
  Epic:        600,
  Spectacular: 1200,
}

export async function POST(req: NextRequest) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cardId } = await req.json()
  if (!cardId) return NextResponse.json({ error: 'cardId required' }, { status: 400 })

  const admin = createAdminClient()

  // Fetch card
  const { data: card } = await admin
    .from('cards')
    .select('id, name, rarity')
    .eq('id', cardId)
    .single()

  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  const price = RARITY_PRICES[card.rarity]
  if (!price) return NextResponse.json({ error: 'Card not available for purchase' }, { status: 400 })

  // Fetch user coins
  const { data: profile } = await admin
    .from('user_profiles')
    .select('coins')
    .eq('user_id', user.id)
    .maybeSingle()

  const currentCoins = profile?.coins ?? 0
  if (currentCoins < price) {
    return NextResponse.json({ error: `Not enough coins. Need ${price}, have ${currentCoins}.` }, { status: 402 })
  }

  // Deduct coins
  const { error: coinErr } = await admin
    .from('user_profiles')
    .upsert({ user_id: user.id, coins: currentCoins - price }, { onConflict: 'user_id' })

  if (coinErr) return NextResponse.json({ error: coinErr.message }, { status: 500 })

  // Add card to inventory
  const { data: existing } = await admin
    .from('user_inventory')
    .select('quantity')
    .eq('user_id', user.id)
    .eq('card_id', cardId)
    .maybeSingle()

  if (existing) {
    await admin
      .from('user_inventory')
      .update({ quantity: existing.quantity + 1 })
      .eq('user_id', user.id)
      .eq('card_id', cardId)
  } else {
    await admin
      .from('user_inventory')
      .insert({ user_id: user.id, card_id: cardId, quantity: 1 })
  }

  return NextResponse.json({ success: true, coinsSpent: price, coinsRemaining: currentCoins - price })
}
