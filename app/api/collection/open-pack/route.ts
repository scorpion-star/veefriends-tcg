import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

// Rarity weights for pack pulls — Core is most common
const RARITY_WEIGHTS: Record<string, number> = {
  Core: 60,
  Rare: 20,
  'Very Rare': 12,
  Epic: 6,
  Spectacular: 2,
}

type Card = { id: number; rarity: string; name: string }

function weightedPick(pool: Card[]): Card {
  // Build weighted array
  const weighted: Card[] = []
  pool.forEach(card => {
    const w = RARITY_WEIGHTS[card.rarity] ?? 1
    for (let i = 0; i < w; i++) weighted.push(card)
  })
  return weighted[Math.floor(Math.random() * weighted.length)]
}

function pickCards(pool: Card[], count: number): Card[] {
  const picks: Card[] = []
  for (let i = 0; i < count; i++) {
    picks.push(weightedPick(pool))
  }
  return picks
}

// Starter pack: pick unique cards respecting rarity weights, no duplicates
function pickUniqueCards(pool: Card[], count: number): Card[] {
  const remaining = [...pool]
  const picks: Card[] = []
  const actualCount = Math.min(count, remaining.length)
  for (let i = 0; i < actualCount; i++) {
    const pick = weightedPick(remaining)
    picks.push(pick)
    const idx = remaining.findIndex(c => c.id === pick.id)
    if (idx !== -1) remaining.splice(idx, 1)
  }
  return picks
}

const PACK_COOLDOWN_HOURS = 24
const STARTER_PACK_SIZE = 30
const DAILY_PACK_SIZE = 5

export async function POST(req: NextRequest) {
  const authClient = await createAuthClient()
  const admin = createAdminClient()

  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check if user already has inventory (determines starter vs daily pack)
  const { data: inventory } = await admin
    .from('user_inventory')
    .select('card_id')
    .eq('user_id', user.id)
    .limit(1)

  const isStarter = !inventory || inventory.length === 0

  if (!isStarter) {
    // Check cooldown via user_profiles
    const { data: profile } = await admin
      .from('user_profiles')
      .select('last_pack_opened_at')
      .eq('user_id', user.id)
      .single()

    if (profile?.last_pack_opened_at) {
      const lastOpened = new Date(profile.last_pack_opened_at)
      const hoursSince = (Date.now() - lastOpened.getTime()) / (1000 * 60 * 60)
      if (hoursSince < PACK_COOLDOWN_HOURS) {
        const hoursLeft = Math.ceil(PACK_COOLDOWN_HOURS - hoursSince)
        return NextResponse.json({
          error: 'Pack not ready yet',
          hoursLeft,
        }, { status: 429 })
      }
    }
  }

  // Fetch all cards
  const { data: allCards, error: cardErr } = await admin
    .from('cards')
    .select('id, rarity, name, aura, skill, stamina, total_score, image_url')

  if (cardErr || !allCards || allCards.length === 0) {
    return NextResponse.json({ error: 'No cards available' }, { status: 500 })
  }

  const packSize = isStarter ? STARTER_PACK_SIZE : DAILY_PACK_SIZE
  const picked = isStarter
    ? pickUniqueCards(allCards as Card[], packSize)
    : pickCards(allCards as Card[], packSize)

  // Upsert into inventory (increment quantity on duplicates)
  // Group by card_id first to handle duplicates in the same pack
  const counts: Record<number, number> = {}
  picked.forEach(c => { counts[c.id] = (counts[c.id] ?? 0) + 1 })

  for (const [cardIdStr, qty] of Object.entries(counts)) {
    const cardId = Number(cardIdStr)
    const { data: existing } = await admin
      .from('user_inventory')
      .select('quantity')
      .eq('user_id', user.id)
      .eq('card_id', cardId)
      .single()

    if (existing) {
      await admin
        .from('user_inventory')
        .update({ quantity: existing.quantity + qty })
        .eq('user_id', user.id)
        .eq('card_id', cardId)
    } else {
      await admin
        .from('user_inventory')
        .insert({ user_id: user.id, card_id: cardId, quantity: qty })
    }
  }

  // Update last_pack_opened_at in user_profiles
  await admin
    .from('user_profiles')
    .upsert({ user_id: user.id, last_pack_opened_at: new Date().toISOString() })

  return NextResponse.json({ success: true, isStarter, packSize, cards: picked })
}

// GET — returns cooldown status
export async function GET() {
  const authClient = await createAuthClient()
  const admin = createAdminClient()

  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: inventory } = await admin
    .from('user_inventory')
    .select('card_id')
    .eq('user_id', user.id)
    .limit(1)

  const isStarter = !inventory || inventory.length === 0
  if (isStarter) {
    return NextResponse.json({ ready: true, isStarter: true })
  }

  const { data: profile } = await admin
    .from('user_profiles')
    .select('last_pack_opened_at')
    .eq('user_id', user.id)
    .single()

  if (!profile?.last_pack_opened_at) {
    return NextResponse.json({ ready: true, isStarter: false })
  }

  const lastOpened = new Date(profile.last_pack_opened_at)
  const hoursSince = (Date.now() - lastOpened.getTime()) / (1000 * 60 * 60)
  const hoursLeft = Math.max(0, PACK_COOLDOWN_HOURS - hoursSince)

  return NextResponse.json({
    ready: hoursLeft === 0,
    isStarter: false,
    hoursLeft: Math.ceil(hoursLeft),
    lastOpened: profile.last_pack_opened_at,
  })
}
