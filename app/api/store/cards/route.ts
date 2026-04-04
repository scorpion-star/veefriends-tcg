import { NextResponse } from 'next/server'
import { createAuthClient, createAdminClient } from '@/lib/supabase-server'

const CARDS_PER_RARITY = 5
const RARITIES = ['Core', 'Rare', 'Very Rare', 'Epic', 'Spectacular']
const SPECTACULAR_VARIANTS = new Set(['Diamond', 'Lava', 'Holo', 'Gold', 'Bubblegum', 'Emerald'])
const REFRESH_HOURS = 24

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function GET() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Check existing rotation
  const { data: rotation } = await admin
    .from('store_rotation')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  const needsRefresh = !rotation ||
    (Date.now() - new Date(rotation.refreshed_at).getTime()) > REFRESH_HOURS * 60 * 60 * 1000

  let cardIds: Record<string, number[]>

  if (needsRefresh) {
    // Fetch all cards grouped by rarity
    const { data: allCards } = await admin
      .from('cards')
      .select('id, rarity')

    if (!allCards) return NextResponse.json({ error: 'No cards available' }, { status: 500 })

    cardIds = {}
    for (const rarity of RARITIES) {
      const pool = rarity === 'Spectacular'
        ? allCards.filter(c => c.rarity === 'Spectacular' || SPECTACULAR_VARIANTS.has(c.rarity))
        : allCards.filter(c => c.rarity === rarity)
      cardIds[rarity] = shuffle(pool).slice(0, CARDS_PER_RARITY).map(c => c.id)
    }

    // Save rotation
    await admin
      .from('store_rotation')
      .upsert({ id: 1, card_ids: cardIds, refreshed_at: new Date().toISOString() })
  } else {
    cardIds = rotation.card_ids
    // Enforce cap in case rotation was saved before CARDS_PER_RARITY was introduced
    let needsResave = false
    for (const rarity of RARITIES) {
      if ((cardIds[rarity]?.length ?? 0) > CARDS_PER_RARITY) {
        cardIds[rarity] = cardIds[rarity].slice(0, CARDS_PER_RARITY)
        needsResave = true
      }
    }
    if (needsResave) {
      await admin
        .from('store_rotation')
        .update({ card_ids: cardIds })
        .eq('id', 1)
    }
  }

  // Fetch full card data for the rotation
  const allIds = Object.values(cardIds).flat()
  if (allIds.length === 0) return NextResponse.json({ cards: [], refreshedAt: rotation?.refreshed_at })

  const { data: cards, error } = await admin
    .from('cards')
    .select('id, name, rarity, aura, skill, stamina, total_score, image_url')
    .in('id', allIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sort by rarity order then name
  const rarityOrder = Object.fromEntries(RARITIES.map((r, i) => [r, i]))
  const normalizeR = (r: string) => (SPECTACULAR_VARIANTS.has(r) ? 'Spectacular' : r)
  const sorted = (cards ?? []).sort((a, b) =>
    rarityOrder[normalizeR(a.rarity)] - rarityOrder[normalizeR(b.rarity)] || a.name.localeCompare(b.name)
  )

  const refreshedAt = needsRefresh ? new Date().toISOString() : rotation!.refreshed_at

  return NextResponse.json({ cards: sorted, refreshedAt })
}
